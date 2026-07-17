"use client"
import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Search, CheckCircle2, ChevronDown, ChevronRight, Check } from "lucide-react";
import { useRouter } from "next/navigation"
import { fetchQueue, fetchLabel, updateLabel, formatDate, formatDateFromISO, fetchDefectCodes, fetchAllUsers, type ApiLabel, type DefectCode, type User } from "../../../services/reworkApi"

type Status = ApiLabel["status"];

const BADGE: Record<Status, { label: string; bg: string; color: string }> = {
  ISSUED:      { label: "Issued",      bg: "#FEE2E2", color: "#991B1B" },
  IN_PROGRESS: { label: "In Progress", bg: "#FEF3C7", color: "#92400E" },
  RETURNED:    { label: "Returned",    bg: "#DCFCE7", color: "#166534" },
  CLOSED:      { label: "Closed",      bg: "#EDE9FE", color: "#4C1D95" },
};

type ColKey = "label_id" | "order_id" | "material_id" | "description" | "line_post" | "input_qty" | "status";

const COLS: { key: ColKey; label: string; width: string; center?: boolean }[] = [
  { key: "label_id",    label: "Label ID",    width: "140px"              },
  { key: "order_id",    label: "Order",       width: "120px"              },
  { key: "material_id", label: "Material ID", width: "120px"              },
  { key: "description", label: "Description", width: "1fr"                },
  { key: "line_post",   label: "Line Post",   width: "80px",  center: true },
  { key: "input_qty",   label: "RW Qty",      width: "60px",  center: true },
  { key: "status",      label: "Status",      width: "120px"              },
];

const GRID = COLS.map(c => c.width).join(" ") + " 20px";

type Filters = Partial<Record<ColKey, Set<string>>>;

const labelCss: React.CSSProperties = { fontSize: 10, color: "#8C8985", marginBottom: 3 };

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: 11, fontWeight: 600, color: "#000000", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>{children}</p>;
}

function DetailField({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p style={labelCss}>{label}</p>
      <p style={{ fontSize: 13, color: color ?? "#000000" }}>{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  const badgeInfo = BADGE[status] || { label: status, bg: "#E5E7EB", color: "#374151" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: 999, background: badgeInfo.bg, color: badgeInfo.color, fontSize: 11, fontWeight: 500 }}>
      {badgeInfo.label}
    </span>
  );
}

function Cell({ children, center }: { children: React.ReactNode; center?: boolean }) {
  return (
    <div style={{ padding: "0 10px", height: 44, minWidth: 0, display: "flex", alignItems: "center", justifyContent: center ? "center" : "flex-start" }}>
      {children}
    </div>
  );
}

function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label
      style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 5, cursor: "pointer", fontSize: 12, color: "#000000", fontFamily: "Inter, sans-serif" }}
      onMouseEnter={e => (e.currentTarget.style.background = "#F0EEE4")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      <input type="checkbox" checked={checked} onChange={onChange} style={{ accentColor: "#8DBAED", width: 13, height: 13, cursor: "pointer" }} />
      {label}
    </label>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ReworkStation() {
  const [labelId,      setLabelId]      = useState("");
  const [label,        setLabel]        = useState<ApiLabel | null>(null);
  const [queue,        setQueue]        = useState<ApiLabel[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [receivedId,   setReceivedId]   = useState<string | null>(null);
  const [showReceived, setShowReceived] = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [openCol,      setOpenCol]      = useState<ColKey | null>(null);
  const [filters,      setFilters]      = useState<Filters>({});
  const [draft,        setDraft]        = useState<Set<string>>(new Set());
  const [search,       setSearch]       = useState("");
  const [queueSearchText, setQueueSearchText] = useState("");
  const tableRef = useRef<HTMLDivElement>(null);
  const router   = useRouter();
  const [defectOptions, setDefectOptions] = useState<DefectCode[]>([]);

  // ── Users (for "Received By") ───────────────────────────────────────────────
  const [users,       setUsers]       = useState<User[]>([]);
  const [receivedBy,  setReceivedBy]  = useState(""); // holds selected user id (as string, from <select>)

  const loadQueue = () => {
    setLoading(true);
    fetchQueue()
      .then(data => { setQueue(data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadQueue();
  }, []);

  useEffect(() => {
    if (!labelId) { setLabel(null); return; }
    fetchLabel(labelId).then(setLabel).catch(() => setLabel(null));
    setReceivedBy(""); // reset user selection on new lookup
  }, [labelId]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (tableRef.current && !tableRef.current.contains(e.target as Node)) setOpenCol(null);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    fetchDefectCodes().then(setDefectOptions).catch(console.error);
  }, []);

  useEffect(() => {
    fetchAllUsers()
      .then(data => {
        if (Array.isArray(data)) {
          setUsers(data);
        } else {
          setUsers([]);
        }
      })
      .catch(err => {
        console.error("Error fetching users:", err);
        setUsers([]);
      });
  }, []);

  // ── Filter helpers ──────────────────────────────────────────────────────────

function uniqueValues(col: ColKey): string[] {
  const activeQueue = queue.filter(row => row.status === "ISSUED" || row.status === "IN_PROGRESS");
  return Array.from(new Set(activeQueue.map(r => r[col] != null ? String(r[col]) : "–"))).sort();
}
  function openFilter(col: ColKey) {
    if (openCol === col) { setOpenCol(null); return; }
    setDraft(filters[col] ? new Set(filters[col]) : new Set(uniqueValues(col)));
    setSearch(""); 
    setOpenCol(col);
  }

  function applyFilter() {
    const vals  = uniqueValues(openCol!);
    const isAll = vals.every(v => draft.has(v));
    setFilters(prev => {
      const next = { ...prev };
      if (isAll) delete next[openCol!]; else next[openCol!] = new Set(draft);
      return next;
    });
    setOpenCol(null);
  }

  function toggleDraft(val: string) {
    setDraft(prev => { const n = new Set(prev); n.has(val) ? n.delete(val) : n.add(val); return n; });
  }

  function toggleAll() {
    const vals = uniqueValues(openCol!);
    setDraft(vals.every(v => draft.has(v)) ? new Set() : new Set(vals));
  }

  const filteredQueue = queue
    .filter(row => row.status === "ISSUED" || row.status === "IN_PROGRESS") 
    .filter(row =>
      (Object.entries(filters) as [ColKey, Set<string>][]).every(([col, allowed]) => {
        const rowVal = row[col] != null ? String(row[col]) : "–";
        return allowed.has(rowVal);
      })
    )
    .filter(row => {
      if (!queueSearchText) return true;
      const q = queueSearchText.toLowerCase();
            return (
        String(row.order_id || "").toLowerCase().includes(q) ||
        String(row.material_id || "").toLowerCase().includes(q) ||
        String(row.description || "").toLowerCase().includes(q)
      );
    });

  const isActive = (col: ColKey) => !!filters[col];

  // ── Action handlers ─────────────────────────────────────────────────────────

  async function handleReceive() {
    if (!receivedBy) {
      alert("กรุณาเลือกชื่อผู้รับงานก่อนดำเนินการ");
      return;
    }
    const receivedByIdNum   = Number(receivedBy);
    const receivedByName    = users.find(u => u.id === receivedByIdNum)?.username ?? "";
    try {
      await updateLabel(labelId, {
        status:        "IN_PROGRESS",
        receivedDate:  formatDate(),
        receivedById:  receivedByIdNum,
        receivedBy:    receivedByName,
      });
      
      setLabel(prev => prev ? { 
        ...prev, 
        status: "IN_PROGRESS", 
        received_at: new Date().toISOString(), 
        received_by_id: receivedByIdNum,
        received_by: receivedByName
      } : prev);
      
      setQueue(prev => prev.map(r => r.label_id === labelId ? { ...r, status: "IN_PROGRESS" } : r));
      setReceivedId(labelId);
      setShowReceived(true);
      setTimeout(() => setShowReceived(false), 2000);
    } catch (err) {
      console.error("Error on receiving label:", err);
    }
  }

  async function handleCompleteReturn() {
    if (!receivedBy) {
      alert("กรุณาเลือกชื่อผู้ส่งคืนงานก่อนดำเนินการ");
      return;
    }
    
    const returnedByIdNum = Number(receivedBy);
    const returnedByName  = users.find(u => u.id === returnedByIdNum)?.username ?? "";

    try {
      await updateLabel(labelId, { 
        status: "RETURNED", 
        returnedDate: formatDate(),
        returnedById: returnedByIdNum,
        returnedBy: returnedByName
      });
      
      setShowConfirm(false);
      setLabel(null); 
      setReceivedBy(""); 
      setLabelId(""); // Clear Lookup view so it goes back to clean default.
      
      // Update queue locally & reload latest items from Server API directly
      setQueue(prev => prev.filter(r => r.label_id !== labelId));
      if (typeof fetchQueue === 'function') {
        fetchQueue().then(setQueue).catch(console.error);
      }

    } catch (err) {
      console.error("Error on completing label:", err);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ width: "100%", minHeight: "100vh", background: "#F0EEE4", fontFamily: "Inter, sans-serif" }}>

      {/* App bar */}
      <div style={{ height: 56, background: "#fff", borderBottom: "0.5px solid #E5E7EB", display: "flex", alignItems: "center", padding: "0 32px", gap: 12 }}>
        <button
          onClick={() => router.push("/rework")}
          style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", borderRadius: 8, color: "#8C8985" }}
        >
          <ArrowLeft size={18} />
        </button>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#000000" }}>Rework Station</span>
      </div>

      <div style={{ maxWidth: 1536, margin: "0 auto", padding: "32px 32px 60px" }}>

        {/* ── Label lookup ── */}
        <div style={{ background: "#fff", border: "0.5px solid #E5E7EB", borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <SectionLabel>Label lookup</SectionLabel>

          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input
              value={labelId}
              onChange={e => setLabelId(e.target.value.toUpperCase())}
              placeholder="Enter label ID"
              style={{ flex: 1, height: 44, padding: "0 14px", fontSize: 13, color: "#000000", background: "#fff", border: "0.5px solid #8DBAED", borderRadius: 8, outline: "none", boxSizing: "border-box", fontFamily: "Inter, sans-serif" }}
              onFocus={e => (e.target.style.borderColor = "#8DBAED")}
              onBlur={e  => (e.target.style.borderColor = "#E5E7EB")}
            />
            <button style={{ width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", border: "0.5px solid #8DBAED", borderRadius: 8, cursor: "pointer", color: "#8DBAED", flexShrink: 0 }}>
              <Search size={16} />
            </button>
          </div>

          {label && (() => {
            const isJustReceived = receivedId === labelId;
            const status         = label.status;
            const receivedByName = users.find(u => u.id === label.received_by_id)?.username || label.received_by || "–";
            const returnedByName = users.find(u => u.id === label.returned_by_id)?.username || label.returned_by || "–";

            return (
              <div style={{ background: "#F9FAFB", border: "0.5px solid #E5E7EB", borderRadius: 8, padding: 16, display: "flex", gap: 24 }}>

                {/* Detail grid */}
                <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "10px 24px" }}>
                  <DetailField label="Label ID"    value={label.label_id}                                    />
                  <DetailField label="Order no."   value={label.order_id}                                    />
                  <DetailField label="Material ID" value={label.material_id ?? "–"}                         />
                  <DetailField label="Description" value={label.description  ?? "–"}                        />
                  <DetailField label="Line Post"   value={label.line_post  ?? "–"}                          />
                  <DetailField label="Prog Plan"   value={label.prog_plan  ?? "–"}                          />
                  <DetailField label="QC After P"  value={label.qc_after_p  ?? "–"}                         />
                  <DetailField label="Pack WK"     value={label.pack_wk  ?? "–"}                          />
                  <DetailField label="RW Qty"      value={String(label.input_qty)} color="#DC2626" />
                  <DetailField label="Round"       value={String(label.round_no)}                                    />
                  <div><p style={labelCss}>Status</p><StatusPill status={status} /></div>

                  <div style={{ gridColumn: "1 / -1", display: "flex", flexWrap: "wrap", gap: 4 }}>
                    <p style={{ ...labelCss, width: "100%", marginBottom: 4 }}>Defect Codes</p>
                    {label.defect_codes.length
                      ? label.defect_codes.map(code => (
                          <span key={code} style={{ padding: "2px 10px", borderRadius: 999, background: "#000000", color: "#fff", fontSize: 11, fontWeight: 500 }}>
                            {code}{defectOptions.find(d => d.defect_code === code) ? ` · ${defectOptions.find(d => d.defect_code === code)!.description_th}` : ""}
                          </span>
                        ))
                      : <span style={{ fontSize: 12, color: "#000000" }}>–</span>
                    }
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <DetailField label="Remark" value={label.remark || "–"} />
                  </div>
                  <DetailField label="QC Name"       value={label.qc_name || "–"} />
                  <DetailField label="Issued Date"   value={formatDateFromISO(label.issued_at)   || "–"} />
                  <DetailField label="Received By"   value={receivedByName} />
                  <DetailField label="Received Date" value={formatDateFromISO(label.received_at) || "–"} />
                  <DetailField label="Returned By"   value={returnedByName} />
                  <DetailField label="Returned Date" value={formatDateFromISO(label.returned_at) || "–"} />
                </div>

                <div style={{ width: "0.5px", background: "#E5E7EB", alignSelf: "stretch", flexShrink: 0 }} />

                {/* Action buttons */}
                <div style={{ width: 180, display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>

                  {showReceived && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#F0FDF4", border: "0.5px solid #BBF7D0", borderRadius: 8 }}>
                      <Check size={14} color="#16A34A" />
                      <p style={{ fontSize: 12, fontWeight: 500, color: "#16A34A" }}>Received {labelId}</p>
                    </div>
                  )}

                  {/* Dropdown Select (Disabled only if layout status is closed or returned) */}
                  {(status === "ISSUED" || status === "IN_PROGRESS" || isJustReceived) && status !== "RETURNED" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <p style={{ fontSize: 11, color: "#000000", fontWeight: 500 }}>
                        {status === "ISSUED" ? "Received By" : "Returned By"}
                      </p>
                      <div style={{ position: "relative" }}>
                        <select
                          value={receivedBy}
                          onChange={e => setReceivedBy(e.target.value)}
                          disabled={status !== "ISSUED" && status !== "IN_PROGRESS" && !isJustReceived}
                          style={{ 
                            width: "100%", 
                            height: 38, 
                            padding: "0 32px 0 10px", 
                            fontSize: 13, 
                            color: receivedBy ? "#000000" : "#8C8985", 
                            background: (status === "ISSUED" || status === "IN_PROGRESS" || isJustReceived) ? "#fff" : "#F3F4F6", 
                            border: "0.5px solid #E5E7EB", 
                            borderRadius: 8, 
                            outline: "none", 
                            appearance: "none", 
                            boxSizing: "border-box", 
                            fontFamily: "Inter, sans-serif", 
                            cursor: (status === "ISSUED" || status === "IN_PROGRESS" || isJustReceived) ? "pointer" : "not-allowed" 
                          }}
                          onFocus={e => (e.target.style.borderColor = "#8DBAED")}
                          onBlur={e  => (e.target.style.borderColor = "#E5E7EB")}
                        >
                          <option value="">-</option>
                          {users.filter(u => u.role === "rw_station").map(u => (
                            <option key={u.id} value={u.id}>{u.username}</option>
                          ))}
                        </select>
                        <ChevronDown size={12} color="#8C8985" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                      </div>
                    </div>
                  )}

                  {/* Button: Receive */}
                  {status !== "RETURNED" && (
                    <button
                      onClick={status === "ISSUED" && !isJustReceived && receivedBy ? handleReceive : undefined}
                      disabled={status !== "ISSUED" || isJustReceived || !receivedBy}
                      style={{ width: "100%", height: 44, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif",
                        background: status === "ISSUED" && !isJustReceived && receivedBy ? "#FCCF61" : "#E5E7EB",
                        color:      status === "ISSUED" && !isJustReceived && receivedBy ? "#fff"    : "#9CA3AF",
                        cursor:     status === "ISSUED" && !isJustReceived && receivedBy ? "pointer" : "not-allowed",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      }}
                    >
                      {(status !== "ISSUED" || isJustReceived) && <CheckCircle2 size={15} color="#9CA3AF" />}
                      {status === "ISSUED" && !isJustReceived ? "Receive" : "Received"}
                    </button>
                  )}

                  {/* Button: Complete & Return */}
                  <button
                    onClick={(status === "IN_PROGRESS" || isJustReceived) && receivedBy && status !== "RETURNED" ? () => setShowConfirm(true) : undefined}
                    disabled={(status !== "IN_PROGRESS" && !isJustReceived) || !receivedBy || status === "RETURNED"}
                    style={{ width: "100%", height: 44, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: "Inter, sans-serif",
                      background: (status === "IN_PROGRESS" || isJustReceived) && receivedBy && status !== "RETURNED" ? "#77BB78" : "#E5E7EB",
                      color:      (status === "IN_PROGRESS" || isJustReceived) && receivedBy && status !== "RETURNED" ? "#fff"    : "#9CA3AF",
                      cursor:     (status === "IN_PROGRESS" || isJustReceived) && receivedBy && status !== "RETURNED" ? "pointer" : "not-allowed",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    }}
                  >
                    {status !== "IN_PROGRESS" && !isJustReceived && <CheckCircle2 size={15} color="#9CA3AF" />}
                    {status === "RETURNED" ? "Completed & Returned" : "Complete & Return"}
                  </button>

                  {/* Status hint text */}
                  {status === "ISSUED"       && !isJustReceived && !receivedBy && <p style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", marginTop: 2 }}>เลือกชื่อผู้รับ</p>}
                  {status === "ISSUED"       && !isJustReceived && receivedBy  && <p style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", marginTop: 2 }}>Complete available after receiving</p>}
                  {status === "IN_PROGRESS"  && !receivedBy && <p style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", marginTop: 2 }}>เลือกชื่อผู้ส่งคืนงาน</p>}
                  {status === "IN_PROGRESS"  && receivedBy && <p style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", marginTop: 2 }}>Complete & return to QC</p>}
                  {status === "RETURNED"     && <p style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", marginTop: 2 }}>Waiting for QC re-inspection</p>}
                  {status === "CLOSED"       && <p style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", marginTop: 2 }}>Order closed</p>}
                </div>
              </div>
            );
          })()}
        </div>

        {/* ── Queue ── */}
        <div ref={tableRef} style={{ background: "#fff", border: "0.5px solid #E5E7EB", borderRadius: 12, overflow: "visible", position: "relative" }}>

          {/* Table top bar */}
          <div style={{ padding: "14px 20px", borderBottom: "0.5px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            
            {/* ฝั่งซ้าย: Title + Badge ตัวเลข */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#000000", letterSpacing: "0.06em" }}>QUEUE</span>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: 999, background: "#DC2626", color: "#fff", fontSize: 9, fontWeight: 700 }}>
                {filteredQueue.length}
              </span>
            </div>

            {/* ฝั่งขวา: Search Box + Clear all */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              
              {/* Container ของ Search Box */}
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <input
                  value={queueSearchText} // ⚠️ ตรวจสอบและเปลี่ยนชื่อตัวแปร State ค้นหาของหน้านี้ให้ถูกต้อง (เช่น queueSearchText หรือ searchText)
                  onChange={e => setQueueSearchText(e.target.value)} // ⚠️ เปลี่ยนให้ตรงกับคำสั่ง set ของหน้านี้
                  placeholder="Search..."
                  style={{ width: 240, height: 32, padding: "0 32px 0 12px", fontSize: 13, color: "#000000", background: "#fff", border: "0.5px solid #E5E7EB", borderRadius: 8, outline: "none", boxSizing: "border-box", fontFamily: "Inter, sans-serif" }}
                  onFocus={e => (e.target.style.borderColor = "#8DBAED")}
                  onBlur={e  => (e.target.style.borderColor = "#E5E7EB")}
                />
                {/* ปุ่มกากบาทลบคำค้นหา (โชว์เมื่อมีข้อความพิมพ์อยู่) */}
                {queueSearchText && (
                  <button 
                    onClick={() => setQueueSearchText("")} 
                    style={{ position: "absolute", right: 8, background: "none", border: "none", color: "#8C8985", cursor: "pointer", fontSize: 14, fontWeight: "bold", padding: 4, display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    ×
                  </button>
                )}
              </div>

              {/* ปุ่ม Clear all แบบไม่มีขอบ (โชว์เมื่อมีการกรองฟิลเตอร์ไว้) */}
              {Object.keys(filters).length > 0 && (
                <button 
                  onClick={() => setFilters({})} 
                  style={{ fontSize: 12, color: "#8C8985", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", padding: "0 4px" }}
                >
                  Clear all
                </button>
              )}
            </div>
          </div>


          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: GRID, background: "#ADCFF1", borderBottom: "1px solid #8DBAED" }}>
            {COLS.map(col => {
              const active = isActive(col.key);
              const isOpen = openCol === col.key;
              return (
                <div key={col.key} style={{ position: "relative" }}>
                  <button
                    onClick={() => openFilter(col.key)}
                    style={{ width: "100%", height: 36, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px", gap: 4, background: isOpen ? "#E5E7EB" : "transparent", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", borderRight: "0.5px solid #E5E7EB" }}
                  >
                    <span style={{ fontSize: 10, fontWeight: 600, color: active ? "#fff" : "#000000", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{col.label}</span>
                    <ChevronDown size={12} color={active || isOpen ? "#fff" : "#000000"} style={{ flexShrink: 0 }} />
                  </button>

                  {isOpen && (
                    <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 100, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, minWidth: 200, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", overflow: "hidden" }}>
                      <div style={{ padding: "10px 12px 8px" }}>
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ width: "100%", height: 30, padding: "0 10px", fontSize: 12, color: "#000000", background: "#F9FAFB", border: "0.5px solid #E5E7EB", borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "Inter, sans-serif" }} />
                      </div>
                      <div style={{ padding: "0 4px 4px", maxHeight: 200, overflowY: "auto" }}>
                        <CheckRow label="All" checked={uniqueValues(col.key).every(v => draft.has(v))} onChange={toggleAll} />
                        {uniqueValues(col.key).filter(v => v.toLowerCase().includes(search.toLowerCase())).map(val => (
                          <CheckRow key={val} label={val} checked={draft.has(val)} onChange={() => toggleDraft(val)} />
                        ))}
                      </div>
                      <div style={{ padding: "8px 12px 10px", borderTop: "0.5px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <button onClick={() => setDraft(new Set(uniqueValues(openCol!)))} style={{ fontSize: 12, color: "#8C8985", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "Inter, sans-serif" }}>Clear</button>
                        <button onClick={applyFilter} style={{ height: 28, padding: "0 14px", background: "#8DBAED", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>Apply</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ height: 36 }} />
          </div>

          {/* Rows */}
          {loading ? (
            <div style={{ padding: "24px 20px", fontSize: 13, color: "#9CA3AF", textAlign: "center" }}>Loading...</div>
          ) : filteredQueue.length === 0 ? (
            <div style={{ padding: "24px 20px", fontSize: 13, color: "#9CA3AF", textAlign: "center" }}>No labels in queue</div>
          ) : filteredQueue.map((row, i) => (
            <div
              key={row.label_id}
              onClick={() => setLabelId(row.label_id)}
              style={{
                display: "grid", gridTemplateColumns: GRID,
                borderBottom: i < filteredQueue.length - 1 ? "1px solid #E5E7EB" : "none",
                borderLeft: labelId === row.label_id ? "3px solid #8DBAED" : "3px solid transparent",
                background: labelId === row.label_id ? "#E5E7EB" : "#fff",
                cursor: "pointer", alignItems: "center",
              }}
              onMouseEnter={e => { if (labelId !== row.label_id) e.currentTarget.style.background = "#F9FAFB"; }}
              onMouseLeave={e => { e.currentTarget.style.background = labelId === row.label_id ? "#E5E7EB" : "#fff"; }}
            >
              <Cell><span style={{ fontSize: 13, color: "#000000", fontWeight: 600 }}>{row.label_id}</span></Cell>
              <Cell><span style={{ fontSize: 12, color: "#000000" }}>{row.order_id}</span></Cell>
              <Cell><span style={{ fontSize: 12, color: "#000000" }}>{row.material_id || "–"}</span></Cell>
              <Cell><span style={{ fontSize: 13, color: "#000000" }}>{row.description || "–"}</span></Cell>
              <Cell center><span style={{ fontSize: 12, color: "#000000", fontWeight: 600 }}>{row.line_post || "–"}</span></Cell>
              <Cell center><span style={{ fontSize: 12, color: "#DC2626", fontWeight: 600 }}>{row.input_qty}</span></Cell>
              <Cell><StatusPill status={row.status} /></Cell>
              <Cell center><ChevronRight size={14} color="#8C8985" /></Cell>
            </div>
          ))}
        </div>
      </div>

      {/* ── Confirm dialog ── */}
      {showConfirm && label && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, width: 360, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", fontFamily: "Inter, sans-serif" }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: "#000000", marginBottom: 6 }}>ยืนยันส่งคืน QC?</p>
            <p style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 16, lineHeight: 1.6 }}>
              {label.label_id} · {label.description || "–"}<br />
              RW Qty <span style={{ color: "#DC2626", fontWeight: 600 }}>{label.input_qty} ชิ้น</span>
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{ flex: 1, height: 40, background: "#fff", border: "0.5px solid #E5E7EB", borderRadius: 8, fontSize: 13, fontWeight: 500, color: "#374151", cursor: "pointer", fontFamily: "Inter, sans-serif" }}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleCompleteReturn}
                style={{ flex: 1, height: 40, background: "#16A34A", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer", fontFamily: "Inter, sans-serif" }}
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
