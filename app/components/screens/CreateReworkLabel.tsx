"use client"
import { useState, useRef, useEffect, type CSSProperties, type ReactNode } from "react";
import { ArrowLeft, Search, Send, Check, Printer, ChevronDown, X } from "lucide-react";
import { useRouter } from "next/navigation"
import { fetchReturnedLabels, fetchOrderInfoNormalized, generateLabelId, createLabel, updateLabel, formatDate,
  formatDateFromISO, fetchDefectCodes, fetchUsers, type ApiLabel, type OrderInfo, type DefectCode, type User } from "../../lib/api"

// ── Constants ─────────────────────────────────────────────────────────────────

const PROG_PLAN_OPTIONS = ["FINS6499", "FINS6697", "FINS6698", "FINS6699"];

const QC_AFTER_P_OPTIONS = [
  "QCAP4201", "QCAP4202", "QCAP4490", "QCAP4690", "QCAP4691", 
  "QCAP5190", "QCAP5201", "QCAP5690", "QCAP5691", "QCAP5692"];

const RW_LINE_OPTIONS = [
  "4441","4442","4443","4444","4445",
  "5551","5552","5553","5554","5555",
  "6661","6662","6663","6664","6665",
];

const REMARK_OPTIONS = ["ไม่ได้ PC งานดี", "เปิด RW ในระบบเต็มบิล"];

// Returned queue column definitions
type RetColKey = "label_id" | "order_id" | "material_id" | "description" | "rw_line" | "input_qty";

const RET_COLS: { key: RetColKey; label: string; width: string; center?: boolean }[] = [
  { key: "label_id",    label: "Label ID",    width: "140px"              },
  { key: "order_id",    label: "Order",       width: "120px"              },
  { key: "material_id", label: "Material ID", width: "120px"              },
  { key: "description", label: "Description", width: "1fr"                },
  { key: "rw_line",     label: "RW Line",     width: "80px", center: true },
  { key: "input_qty",   label: "Qty",         width: "60px", center: true },
];

const RET_GRID = RET_COLS.map(c => c.width).join(" ") + " 110px 20px";

// ── Types ─────────────────────────────────────────────────────────────────────

type SelectedLabel = ApiLabel | null;

// ── Main component ────────────────────────────────────────────────────────────

export function CreateReworkLabel() {

  // ── Form state (new label) ──────────────────────────────────────────────────
  const [orderNo,     setOrderNo]     = useState("");
  const [total,       setTotal]       = useState("");
  const [passed,      setPassed]      = useState("");
  const [progPlan,    setProgPlan]    = useState("");
  const [qcAfterP,    setQcAfterP]    = useState("");
  const [rwLine,      setRwLine]      = useState("");
  const [qcName,      setQcName]      = useState("");
  const [qcDate,      setQcDate]      = useState("");
  const [defectCodes, setDefectCodes] = useState<Set<string>>(new Set());
  const [remark,      setRemark]      = useState("");

  // ── API data state ──────────────────────────────────────────────────────────
  const [info,           setInfo]           = useState<OrderInfo | null>(null);
  const [returnedLabels, setReturnedLabels] = useState<ApiLabel[]>([]);
  const [previewLabelId, setPreviewLabelId] = useState<string | null>(null);
  const [defectOptions,  setDefectOptions]  = useState<DefectCode[]>([]);
  const [users,          setUsers]          = useState<User[]>([]);

  // ── Defect dropdown state (new vs re-inspect) ───────────────────────────────
  const [defectSearch,   setDefectSearch]   = useState("");
  const [riDefectSearch, setRiDefectSearch] = useState("");
  const [defectOpen,     setDefectOpen]     = useState(false);
  const [riDefectOpen,   setRiDefectOpen]   = useState(false);
  const defectRef   = useRef<HTMLDivElement>(null);
  const riDefectRef = useRef<HTMLDivElement>(null);

  // ── Re-inspection state ─────────────────────────────────────────────────────
  const [selected,      setSelected]      = useState<SelectedLabel>(null);
  const [riPassed,      setRiPassed]      = useState("");
  const [riLine,        setRiLine]        = useState("");
  const [riDefectCodes, setRiDefectCodes] = useState<Set<string>>(new Set());
  const [riRemark,      setRiRemark]      = useState("");

  // ── UI state ────────────────────────────────────────────────────────────────
  const [showPrint, setShowPrint] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // ── Returned queue filter state ─────────────────────────────────────────────
  const [retOpenCol, setRetOpenCol] = useState<RetColKey | null>(null);
  const [retFilters, setRetFilters] = useState<Partial<Record<RetColKey, Set<string>>>>({});
  const [retDraft,   setRetDraft]   = useState<Set<string>>(new Set());
  const [retSearch,  setRetSearch]  = useState("");
  const retTableRef = useRef<HTMLDivElement>(null);

  const router = useRouter();

  // ── Effects ─────────────────────────────────────────────────────────────────

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (retTableRef.current && !retTableRef.current.contains(e.target as Node)) setRetOpenCol(null);
      if (defectRef.current   && !defectRef.current.contains(e.target as Node))   setDefectOpen(false);
      if (riDefectRef.current && !riDefectRef.current.contains(e.target as Node)) setRiDefectOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Fetch returned labels + defect options + users on mount
  useEffect(() => {
    fetchReturnedLabels().then(setReturnedLabels).catch(console.error);
    fetchDefectCodes().then(setDefectOptions).catch(console.error);
    fetchUsers().then(data => setUsers(data.filter(u => u.role === "qc" || u.role === "admin"))).catch(console.error);
  }, []);

  // Fetch order info when orderNo changes
  useEffect(() => {
    if (!orderNo) { setInfo(null); setTotal(""); return; }
    fetchOrderInfoNormalized(orderNo).then(data => {
      setInfo(data);
      if (data?.total) setTotal(String(data.total));
    }).catch(() => setInfo(null));
  }, [orderNo]);

  // Preview label ID when qcDate or orderNo changes
  useEffect(() => {
    if (!qcDate || !orderNo) { setPreviewLabelId(null); return; }
    generateLabelId(qcDate).then(setPreviewLabelId).catch(() => setPreviewLabelId(null));
  }, [qcDate, orderNo]);

  // ── Returned queue filter helpers ───────────────────────────────────────────

  function retUniqueValues(col: RetColKey) {
    return Array.from(new Set(returnedLabels.map(r => String(r[col] ?? "")).filter(Boolean))).sort();
  }

  function openRetFilter(col: RetColKey) {
    if (retOpenCol === col) { setRetOpenCol(null); return; }
    setRetDraft(retFilters[col] ? new Set(retFilters[col]) : new Set(retUniqueValues(col)));
    setRetSearch(""); setRetOpenCol(col);
  }

  function applyRetFilter() {
    const vals  = retUniqueValues(retOpenCol!);
    const isAll = vals.every(v => retDraft.has(v));
    setRetFilters(prev => {
      const n = { ...prev };
      if (isAll) delete n[retOpenCol!]; else n[retOpenCol!] = new Set(retDraft);
      return n;
    });
    setRetOpenCol(null);
  }

  function toggleRetDraft(val: string) {
    setRetDraft(prev => { const n = new Set(prev); n.has(val) ? n.delete(val) : n.add(val); return n; });
  }

  function toggleRetAll() {
    const vals = retUniqueValues(retOpenCol!);
    setRetDraft(vals.every(v => retDraft.has(v)) ? new Set() : new Set(vals));
  }

  const filteredReturned = returnedLabels.filter(row =>
    (Object.entries(retFilters) as [RetColKey, Set<string>][]).every(([col, allowed]) => allowed.has(String(row[col])))
  );

  const isRetActive = (col: RetColKey) => !!retFilters[col];

  // ── Derived values ───────────────────────────────────────────────────────────

  const isReturned  = !!selected;
  const newFailed   = total && passed ? Math.max(0, Number(total) - Number(passed)) : null;
  const riFailed    = selected && riPassed ? Math.max(0, selected.input_qty - Number(riPassed)) : null;
  const allPassed   = riFailed === 0;
  
  const hasFailures = riFailed !== null && riFailed > 0;

  // Right panel display values
  const panelId      = isReturned ? selected!.label_id    : previewLabelId;
  const panelDesc    = isReturned ? selected!.description  : (info?.description ?? null);
  const panelLineVal = isReturned ? riLine                 : rwLine;
  const panelQty     = isReturned ? selected!.input_qty    : (total ? Number(total) : null);
  const panelRound   = isReturned ? selected!.round_no + 1 : 1;
  const panelPassed  = isReturned ? (riPassed ? Number(riPassed) : null) : (passed ? Number(passed) : null);
  const panelFailed  = isReturned ? riFailed               : newFailed;
  const panelDefects = isReturned ? riDefectCodes          : defectCodes;
  const panelRemark  = isReturned ? riRemark               : remark;
  const panelProgPlan = isReturned ? (selected!.prog_plan ?? "") : progPlan;
  const panelQcAfterP = isReturned ? (selected!.qc_after_p ?? "") : qcAfterP;

  // Issue button validation
  const canIssue = !isReturned
    ? (!!orderNo && !!total && !!passed && !!rwLine && !!progPlan && !!qcAfterP && !!qcName && !!qcDate && defectCodes.size > 0 && !!remark)
    : allPassed
      ? (!!riPassed && !!qcName && !!qcDate)
      : (!!riPassed && !!riLine && !!qcName && !!qcDate && riDefectCodes.size > 0 && !!riRemark);

  // ── Form reset helpers ───────────────────────────────────────────────────────

  function clearLeft() {
    setOrderNo(""); setTotal(""); setPassed(""); setProgPlan("");
    setQcAfterP(""); setRwLine(""); setQcName(""); setQcDate("");
    setDefectCodes(new Set()); setRemark(""); setDefectSearch("");
  }

  function handleDeselect() {
    setSelected(null);
    setOrderNo(""); setTotal(""); setPassed("");
    setRiPassed(""); setRiLine("");
    setRiDefectCodes(new Set()); setRiRemark("");
    setRiDefectSearch("");
  }

  // ── Defect code toggles ──────────────────────────────────────────────────────

  function toggleDefect(code: string) {
    setDefectCodes(prev => { const n = new Set(prev); n.has(code) ? n.delete(code) : n.add(code); return n; });
  }

  function toggleRiDefect(code: string) {
    setRiDefectCodes(prev => { const n = new Set(prev); n.has(code) ? n.delete(code) : n.add(code); return n; });
  }

  // ── Select a returned label from the queue ───────────────────────────────────

  function handleSelectLabel(t: ApiLabel) {
    console.log("selected prog_plan:", t.prog_plan); 
    setSelected(t);
    setOrderNo(t.order_id);
    setProgPlan(t.prog_plan ?? "");
    setQcAfterP(t.qc_after_p ?? "");
    setRiPassed(""); setRiLine("");
    setRiDefectCodes(new Set()); setRiRemark("");
    setRiDefectSearch("");
  }

  // ── Submit handler ───────────────────────────────────────────────────────────

  async function handleConfirm() {
    const today = formatDate();
    try {
      if (isReturned && selected) {
        // Close current round
        const currentFailed = Math.max(0, selected.input_qty - (Number(riPassed) || 0));
        await updateLabel(selected.label_id, {
          status:        "CLOSED",
          resultGoodQty: Number(riPassed),
          resultBadQty:  currentFailed,
          closedDate:    today,
        });

        // If still has failures, create next round label
        if (hasFailures) {
          const newId = await generateLabelId(qcDate);
          await createLabel({
            labelId:     newId,
            orderId:     selected.order_id,
            materialId:  selected.material_id ?? "",
            description: selected.description ?? "",
            linePost:    selected.line_post   ?? "",
            progPlan:    selected.prog_plan   ?? "",
            qcAfterP:    selected.qc_after_p  ?? "",
            total:       selected.total       ?? null,
            inputQty:    currentFailed,
            round:       selected.round_no + 1,
            rwLine:      riLine,
            status:      "ISSUED",
            defectCodes: Array.from(riDefectCodes),
            remark:      riRemark,
            qcName:      qcName,
            issuedDate:  today,
          });
        }
      } else {
        // Create round 1 label
        const failed = Math.max(0, Number(total) - (Number(passed) || 0));
        const newId  = await generateLabelId(qcDate);
        await createLabel({
          labelId:     newId,
          orderId:     orderNo,
          materialId:  info?.materialId  ?? "",
          description: info?.description ?? "",
          linePost:    info?.linePost    ?? "",
          progPlan:    progPlan,
          qcAfterP:    qcAfterP,
          total:       info?.total       ?? null,
          inputQty:    failed,
          round:       1,
          rwLine:      rwLine,
          status:      "ISSUED",
          defectCodes: Array.from(defectCodes),
          remark,
          qcName:      qcName,
          issuedDate:  today,
        });
      }

      // Show success briefly, then reset form
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        clearLeft();
        setSelected(null);
        setRiPassed(""); setRiLine("");
        setRiDefectCodes(new Set()); setRiRemark("");
        fetchReturnedLabels().then(setReturnedLabels).catch(console.error);
      }, 2000);

    } catch (err) {
      console.error("handleConfirm error:", err);
      // TODO: replace with toast
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ width: "100%", minHeight: "100vh", background: "#F0EEE4", fontFamily: "Inter, sans-serif" }}>

      {/* App bar */}
      <div style={{ height: 56, background: "#fff", borderBottom: "0.5px solid #E5E7EB", display: "flex", alignItems: "center", padding: "0 32px", gap: 12 }}>
        <button
          onClick={() => router.push("/")}
          style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", borderRadius: 8, color: "#8C8985" }}>
          <ArrowLeft size={18} />
        </button>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#000000" }}>Create Rework Label</span>
      </div>

      <div style={{ maxWidth: 1536, margin: "0 auto", padding: "32px 32px 60px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: 24, alignItems: "start", marginBottom: 28 }}>

          {/* ── LEFT panel ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Order lookup */}
            <Card>
              <SectionLabel>Order lookup</SectionLabel>
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <input
                  value={orderNo} onChange={e => setOrderNo(e.target.value)}
                  placeholder="Enter order no."
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = "#8DBAED")}
                  onBlur={e  => (e.target.style.borderColor = "#E5E7EB")}
                />
                <button style={qrBtnStyle}><Search size={16} /></button>
              </div>
              {info && (
                <div style={{ background: "#F9FAFB", border: "0.5px solid #E5E7EB", borderRadius: 8, padding: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px" }}>
                  <InfoField label="Order no."    value={orderNo} />
                  <InfoField label="Material ID"  value={info.materialId} />
                  <InfoField label="Description"  value={info.description} />
                  <InfoField label="Line Post"    value={info.linePost} />
                  <InfoField label="Progress Planning"    value={info.latestProgPlan ?? "–"} />
                  <InfoField label="QC After P"   value={info.latestQcAfterP ?? "–"} />
                  <InfoField label="Qty"          value={info.total !== null ? String(info.total) : "–"} />
                  <InfoField label="Latest Label" value={info.latestLabelId ?? "–"} />
                  <InfoField label="Latest Round" value={info.latestRoundNo !== null ? `R${info.latestRoundNo}` : "–"} />
                  <InfoField label="Issued Date"  value={formatDateFromISO(info.latestIssuedAt) || "–"} />
                  <InfoField label="Closed Date"  value={formatDateFromISO(info.latestClosedAt) || "–"} />
                </div>
              )}
            </Card>

            {/* Inspection result */}
            <Card>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#8C8985", letterSpacing: "0.06em", textTransform: "uppercase", margin: 0 }}>
                  Inspection result
                </p>
                <span style={{ display: "inline-flex", alignItems: "center", padding: "2px 10px", borderRadius: 999, background: "#8DBAED", color: "#fff", fontSize: 12, fontWeight: 600 }}>
                  {isReturned ? `Round ${selected!.round_no + 1}` : "Round 1"}
                </span>
                {isReturned && <span style={{ fontSize: 12, color: "#8DBAED" }}>(re-inspection)</span>}
                <button
                  onClick={() => { if (isReturned) handleDeselect(); else clearLeft(); }}
                  style={{ marginLeft: "auto", height: 28, padding: "0 12px", background: "none", border: "0.5px solid #E5E7EB", borderRadius: 6, fontSize: 12, color: "#8C8985", cursor: "pointer", fontFamily: "Inter, sans-serif" }}
                >
                  {isReturned ? "Deselect" : "Clear"}
                </button>
              </div>

              {/* QC Name + Date */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <p style={{ fontSize: 11, color: "#000000", fontWeight: 500 }}>QC Name</p>
                  <div style={{ position: "relative" }}>
                    <select
                      value={qcName}
                      onChange={e => setQcName(e.target.value)}
                      style={{ width: "100%", height: 38, padding: "0 32px 0 10px", fontSize: 13, color: qcName ? "#000000" : "#8C8985", background: "#fff", border: "0.5px solid #E5E7EB", borderRadius: 8, outline: "none", appearance: "none", boxSizing: "border-box", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
                      onFocus={e => (e.target.style.borderColor = "#8DBAED")}
                      onBlur={e  => (e.target.style.borderColor = "#E5E7EB")}
                    >
                      <option value="">-</option>
                      {users.map(u => (
                        <option key={u.id} value={u.username}>{u.username}</option>
                      ))}
                    </select>
                    <ChevronDown size={12} color="#8C8985" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <p style={{ fontSize: 11, color: "#000000", fontWeight: 500 }}>Date</p>
                  <input
                    type="date" value={qcDate} onChange={e => setQcDate(e.target.value)}
                    style={{ height: 38, padding: "0 10px", fontSize: 13, color: "#000000", background: "#fff", border: "0.5px solid #E5E7EB", borderRadius: 8, outline: "none", boxSizing: "border-box", fontFamily: "Inter, sans-serif", width: "100%" }}
                    onFocus={e => (e.target.style.borderColor = "#8DBAED")}
                    onBlur={e  => (e.target.style.borderColor = "#E5E7EB")}
                  />
                </div>
              </div>

              {/* Order no. + Progress Planning + Send to line */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>

                {/* Order no. */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <p style={{ fontSize: 11, color: "#000000", fontWeight: 500 }}>Order no.</p>
                  <input
                    value={isReturned ? selected!.order_id : orderNo}
                    onChange={e => !isReturned && setOrderNo(e.target.value)}
                    readOnly={isReturned}
                    style={{ height: 38, padding: "0 10px", fontSize: 13, color: "#000000", background: isReturned ? "#F9FAFB" : "#fff", border: "0.5px solid #E5E7EB", borderRadius: 8, outline: "none", boxSizing: "border-box", fontFamily: "Inter, sans-serif", width: "100%" }}
                    onFocus={e => !isReturned && (e.target.style.borderColor = "#8DBAED")}
                    onBlur={e  => (e.target.style.borderColor = "#E5E7EB")}
                  />
                </div>

                {/* Progress Planning — dropdown when new label, readonly when re-inspect */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <p style={{ fontSize: 11, color: "#000000", fontWeight: 500 }}>Progress Planning</p>
                  {isReturned ? (
                    <input
                      value={progPlan}
                      readOnly
                      style={{ height: 38, padding: "0 10px", fontSize: 13, color: "#000000", background: "#F9FAFB", border: "0.5px solid #E5E7EB", borderRadius: 8, outline: "none", boxSizing: "border-box", fontFamily: "Inter, sans-serif", width: "100%" }}
                    />
                  ) : (
                    <div style={{ position: "relative" }}>
                      <select
                        value={progPlan}
                        onChange={e => setProgPlan(e.target.value)}
                        style={{ width: "100%", height: 38, padding: "0 32px 0 10px", fontSize: 13, color: progPlan ? "#000000" : "#8C8985", background: "#fff", border: "0.5px solid #E5E7EB", borderRadius: 8, outline: "none", appearance: "none", boxSizing: "border-box", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
                        onFocus={e => (e.target.style.borderColor = "#8DBAED")}
                        onBlur={e  => (e.target.style.borderColor = "#E5E7EB")}
                      >
                        <option value="">-</option>
                        {PROG_PLAN_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <ChevronDown size={12} color="#8C8985" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                    </div>
                  )}
                </div>
                
                {/* QC After P */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <p style={{ fontSize: 11, color: "#000000", fontWeight: 500 }}>QC After P</p>
                  {isReturned ? (
                    <input
                      value={selected!.qc_after_p ?? "–"}
                      readOnly
                      style={{ height: 38, padding: "0 10px", fontSize: 13, color: "#000000", background: "#F9FAFB", border: "0.5px solid #E5E7EB", borderRadius: 8, outline: "none", boxSizing: "border-box", fontFamily: "Inter, sans-serif", width: "100%" }}
                    />
                  ) : (
                    <div style={{ position: "relative" }}>
                      <select
                        value={qcAfterP}
                        onChange={e => setQcAfterP(e.target.value)}
                        style={{ width: "100%", height: 38, padding: "0 32px 0 10px", fontSize: 13, color: qcAfterP ? "#000000" : "#8C8985", background: "#fff", border: "0.5px solid #E5E7EB", borderRadius: 8, outline: "none", appearance: "none", boxSizing: "border-box", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
                        onFocus={e => (e.target.style.borderColor = "#8DBAED")}
                        onBlur={e  => (e.target.style.borderColor = "#E5E7EB")}
                      >
                        <option value="">-</option>
                        {QC_AFTER_P_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      <ChevronDown size={12} color="#8C8985" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                    </div>
                  )}
                </div>

                {/* Send to line (RW Line) */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <p style={{ fontSize: 11, color: "#000000", fontWeight: 500 }}>Send to line</p>
                  <div style={{ position: "relative" }}>
                    <select
                      value={panelLineVal}
                      onChange={e => isReturned ? setRiLine(e.target.value) : setRwLine(e.target.value)}
                      style={{ width: "100%", height: 38, padding: "0 32px 0 10px", fontSize: 13, color: panelLineVal ? "#000000" : "#8C8985", background: "#fff", border: "0.5px solid #E5E7EB", borderRadius: 8, outline: "none", appearance: "none", boxSizing: "border-box", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
                      onFocus={e => (e.target.style.borderColor = "#8DBAED")}
                      onBlur={e  => (e.target.style.borderColor = "#E5E7EB")}
                    >
                      <option value="">-</option>
                      {RW_LINE_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                    <ChevronDown size={12} color="#8C8985" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                  </div>
                </div>
              </div>

              {/* Total / Passed / Failed */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
                <NumberField label="Total"  value={isReturned ? String(selected!.input_qty) : total}  onChange={!isReturned ? setTotal : undefined} readOnly={isReturned} bg={isReturned ? "#F9FAFB" : "#fff"} />
                <NumberField label="Passed" value={isReturned ? riPassed : passed} onChange={isReturned ? setRiPassed : setPassed} bg="#E1F5EE" labelColor="#0F6E56" />
                <NumberField label="Failed" value={panelFailed !== null ? String(panelFailed) : ""} readOnly bg="#FCEBEB" labelColor="#A32D2D" />
              </div>

              {/* Defect Code dropdown — swaps between new and re-inspect */}
              {isReturned ? (
                <DefectDropdown
                  selectedCodes={riDefectCodes} onToggle={toggleRiDefect}
                  searchVal={riDefectSearch}    setSearch={setRiDefectSearch}
                  isOpen={riDefectOpen}         setOpen={setRiDefectOpen}
                  dropRef={riDefectRef}         options={defectOptions}
                />
              ) : (
                <DefectDropdown
                  selectedCodes={defectCodes}  onToggle={toggleDefect}
                  searchVal={defectSearch}     setSearch={setDefectSearch}
                  isOpen={defectOpen}          setOpen={setDefectOpen}
                  dropRef={defectRef}          options={defectOptions}
                />
              )}

              {/* Remark */}
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <p style={{ fontSize: 11, color: "#000000", fontWeight: 500 }}>Remark</p>
                <div style={{ position: "relative" }}>
                  <select
                    value={isReturned ? riRemark : remark}
                    onChange={e => isReturned ? setRiRemark(e.target.value) : setRemark(e.target.value)}
                    style={{ width: "100%", height: 38, padding: "0 32px 0 10px", fontSize: 13, color: (isReturned ? riRemark : remark) ? "#000000" : "#8C8985", background: "#fff", border: "0.5px solid #E5E7EB", borderRadius: 8, outline: "none", appearance: "none", boxSizing: "border-box", fontFamily: "Inter, sans-serif", cursor: "pointer" }}
                    onFocus={e => (e.target.style.borderColor = "#8DBAED")}
                    onBlur={e  => (e.target.style.borderColor = "#E5E7EB")}
                  >
                    <option value="">-</option>
                    {REMARK_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <ChevronDown size={12} color="#8C8985" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                </div>
              </div>
            </Card>
          </div>

          {/* ── RIGHT panel: label preview + CTA ── */}
          <div style={{ background: "#fff", border: "0.5px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>

            {/* Header */}
            <div style={{ padding: "14px 16px", borderBottom: "0.5px solid #E5E7EB" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#8C8985", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                Create Rework Label
              </p>
              {panelId ? (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#000000" }}>{panelId}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", padding: "1px 7px", borderRadius: 999, background: "#8DBAED", color: "#fff", fontSize: 10, fontWeight: 600 }}>
                      R{panelRound}
                    </span>
                    {isReturned
                      ? <span style={{ display: "inline-flex", padding: "1px 8px", borderRadius: 999, background: "#DCFCE7", color: "#166534", fontSize: 10, fontWeight: 600 }}>Returned</span>
                      : <span style={{ display: "inline-flex", padding: "1px 8px", borderRadius: 999, background: "#FEE2E2", color: "#991B1B", fontSize: 10, fontWeight: 600 }}>Issued</span>
                    }
                  </div>
                  <p style={{ fontSize: 12, color: "#000000" }}>
                    {(isReturned ? selected!.material_id : info?.materialId) && `${isReturned ? selected!.material_id : info?.materialId} · `}{panelDesc}
                  </p>
                </>
              ) : (
                <p style={{ fontSize: 11, color: "#8C8985" }}>Fill in order & inspection to continue</p>
              )}
            </div>

            {/* Summary grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px", padding: "14px 16px", borderBottom: "0.5px solid #E5E7EB" }}>
              <SummaryField label="Order no."    value={isReturned ? selected!.order_id : (orderNo || "-")} />
              <SummaryField label="Material ID"  value={isReturned ? (selected!.material_id ?? "-") : (info?.materialId ?? "-")} />
              <SummaryField label="Line Post"    value={isReturned ? (selected!.line_post ?? "-") : (info?.linePost ?? "-")} />
              <SummaryField label="Prog Plan"    value={panelProgPlan || "-"} />
              <SummaryField label="QC After P"   value={panelQcAfterP || "-"} />
              <SummaryField label="RW Line"      value={panelLineVal || "-"} />
              <SummaryField label="Total Qty"    value={panelQty    !== null ? String(panelQty)    : "-"} />
              <SummaryField label="Passed"       value={panelPassed !== null ? String(panelPassed) : "-"} />
              <SummaryField label="Failed - RW"  value={panelFailed !== null ? String(panelFailed) : "-"} color={panelFailed ? "#DC2626" : undefined} />
              <SummaryField label="Round"        value={`${panelRound}`} />
              {panelDefects.size > 0 && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <p style={{ fontSize: 10, color: "#8C8985", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>Defect Codes</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {Array.from(panelDefects).map(code => (
                      <span key={code} style={{ padding: "2px 10px", borderRadius: 999, background: "#000000", color: "#ffffff", fontSize: 11, fontWeight: 500 }}>
                        {code}{defectOptions.find(d => d.defect_code === code) ? ` · ${defectOptions.find(d => d.defect_code === code)!.description_th}` : ""}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {panelRemark && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <SummaryField label="Remark" value={panelRemark} />
                </div>
              )}
              <SummaryField label="QC Name"      value={qcName || "-"} />
              <SummaryField label="Date"         value={qcDate || "-"} />
            </div>

            {/* CTA buttons */}
            <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              {submitted && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "#F0FDF4", border: "0.5px solid #BBF7D0", borderRadius: 8, marginBottom: 4 }}>
                  <Check size={16} color="#16A34A" />
                  <p style={{ fontSize: 12, fontWeight: 500, color: "#16A34A" }}>Submitted successfully</p>
                </div>
              )}

              {!panelId && (
                <button disabled style={ctaBtn("#E5E7EB", "#9CA3AF")}>Issue rework label</button>
              )}

              {!isReturned && panelId && (
                <button onClick={() => canIssue && handleConfirm()} disabled={!canIssue} style={ctaBtn(canIssue ? "#8DBAED" : "#E5E7EB", canIssue ? "#fff" : "#9CA3AF")}>
                  <Send size={15} /> Issue rework label
                </button>
              )}

              {isReturned && hasFailures && (
                <button onClick={() => canIssue && handleConfirm()} disabled={!canIssue} style={ctaBtn(canIssue ? "#B91C1C" : "#E5E7EB", canIssue ? "#fff" : "#9CA3AF")}>
                  <Send size={15} /> Issue round {panelRound} label
                </button>
              )}

              {isReturned && allPassed && (
                <button onClick={() => canIssue && handleConfirm()} disabled={!canIssue} style={ctaBtn(canIssue ? "#16A34A" : "#E5E7EB", canIssue ? "#fff" : "#9CA3AF")}>
                  <Check size={15} /> Close order
                </button>
              )}

              {panelId && (
                <button onClick={() => setShowPrint(true)} style={{ width: "100%", height: 36, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "none", border: "0.5px solid #E5E7EB", borderRadius: 8, fontSize: 12, color: "#000000", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                  <Printer size={14} color="#000000" /> Print Label
                </button>
              )}

              {!isReturned && !panelId && (
                <p style={{ fontSize: 11, color: "#8C8985", textAlign: "center" }}>
                  Enter order number or select a returned label below
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Returned queue ── */}
        <div ref={retTableRef} style={{ background: "#fff", border: "0.5px solid #E5E7EB", borderRadius: 12, overflow: "visible", position: "relative" }}>
          <div style={{ padding: "14px 20px", borderBottom: "0.5px solid #E5E7EB", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#8C8985" }}>RETURNED – awaiting re-inspection</span>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: 999, background: "#DC2626", color: "#fff", fontSize: 9, fontWeight: 700 }}>
              {filteredReturned.length}
            </span>
            {Object.keys(retFilters).length > 0 && (
              <button onClick={() => setRetFilters({})} style={{ marginLeft: "auto", fontSize: 12, color: "#8C8985", background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                Clear all filters
              </button>
            )}
          </div>

          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: RET_GRID, background: "#ADCFF1", borderBottom: "1px solid #8DBAED" }}>
            {RET_COLS.map(col => {
              const active = isRetActive(col.key);
              const isOpen = retOpenCol === col.key;
              return (
                <div key={col.key} style={{ position: "relative" }}>
                  <button onClick={() => openRetFilter(col.key)} style={{ width: "100%", height: 36, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 10px", gap: 4, background: isOpen ? "#E5E7EB" : "transparent", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", borderRight: "0.5px solid #E5E7EB" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: active ? "#fff" : "#000000", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{col.label}</span>
                    <ChevronDown size={12} color={active || isOpen ? "#fff" : "#000000"} style={{ flexShrink: 0 }} />
                  </button>
                  {isOpen && (
                    <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 100, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, minWidth: 200, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", overflow: "hidden" }}>
                      <div style={{ padding: "10px 12px 8px" }}>
                        <input value={retSearch} onChange={e => setRetSearch(e.target.value)} placeholder="Search..." style={{ width: "100%", height: 30, padding: "0 10px", fontSize: 12, color: "#000000", background: "#F9FAFB", border: "0.5px solid #E5E7EB", borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "Inter, sans-serif" }} />
                      </div>
                      <div style={{ padding: "0 4px 4px" }}>
                        <CheckRow label="All" checked={retUniqueValues(col.key).every(v => retDraft.has(v))} onChange={toggleRetAll} />
                        {retUniqueValues(col.key).filter(v => v.toLowerCase().includes(retSearch.toLowerCase())).map(val => (
                          <CheckRow key={val} label={val} checked={retDraft.has(val)} onChange={() => toggleRetDraft(val)} />
                        ))}
                      </div>
                      <div style={{ padding: "8px 12px 10px", borderTop: "0.5px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <button onClick={() => setRetDraft(new Set(retUniqueValues(retOpenCol!)))} style={{ fontSize: 12, color: "#8C8985", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "Inter, sans-serif" }}>Clear</button>
                        <button onClick={applyRetFilter} style={{ height: 28, padding: "0 14px", background: "#8DBAED", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>Apply</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ height: 36, display: "flex", alignItems: "center", padding: "0 10px", borderRight: "0.5px solid #E5E7EB" }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: "#000000", textTransform: "uppercase", letterSpacing: "0.07em" }}>Status</span>
            </div>
            <div style={{ height: 36 }} />
          </div>

          {/* Rows */}
          {filteredReturned.map((t, i) => {
            const isActive = selected?.label_id === t.label_id;
            return (
              <div key={t.label_id}
                onClick={() => handleSelectLabel(t)}
                style={{ display: "grid", gridTemplateColumns: RET_GRID, minHeight: 44, cursor: "pointer", alignItems: "center", borderBottom: i < filteredReturned.length - 1 ? "1px solid #E5E7EB" : "none", borderLeft: isActive ? "3px solid #8DBAED" : "3px solid transparent", background: isActive ? "#E5E7EB" : "#fff" }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#F9FAFB"; }}
                onMouseLeave={e => { e.currentTarget.style.background = isActive ? "#E5E7EB" : "#fff"; }}
              >
                <RetCell><span style={{ fontSize: 13, color: "#000000", fontWeight: 600 }}>{t.label_id}</span></RetCell>
                <RetCell><span style={{ fontSize: 12, color: "#000000" }}>{t.order_id}</span></RetCell>
                <RetCell><span style={{ fontSize: 12, color: "#000000" }}>{t.material_id}</span></RetCell>
                <RetCell><span style={{ fontSize: 13, color: "#000000" }}>{t.description}</span></RetCell>
                <RetCell center><span style={{ fontSize: 12, color: "#000000" }}>{t.rw_line}</span></RetCell>
                <RetCell center><span style={{ fontSize: 12, color: "#DC2626", fontWeight: 600 }}>{t.input_qty}</span></RetCell>
                <RetCell><span style={{ display: "inline-flex", padding: "2px 10px", borderRadius: 999, background: "#DCFCE7", color: "#166534", fontSize: 11, fontWeight: 600 }}>Returned</span></RetCell>
                <RetCell center><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 2l4 4-4 4" stroke="#8C8985" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg></RetCell>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Print Preview Modal ── */}
      {showPrint && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#F0EEE4", borderRadius: 12, padding: 24, maxHeight: "90vh", overflowY: "auto", width: 500 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#000000" }}>Print Preview</p>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => window.print()} style={{ height: 32, padding: "0 14px", background: "#8DBAED", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer", fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", gap: 6 }}>
                  <Printer size={13} /> Print
                </button>
                <button onClick={() => setShowPrint(false)} style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", border: "0.5px solid #E5E7EB", borderRadius: 8, cursor: "pointer", color: "#8C8985" }}>
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* A6 label card */}
            <div style={{ width: 397, margin: "0 auto", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: 24, boxSizing: "border-box", fontFamily: "Inter, sans-serif" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16, paddingBottom: 12, borderBottom: "1.5px solid #000000" }}>
                <div>
                  <p style={{ fontSize: 8, fontWeight: 600, color: "#8C8985", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 }}>REWORK LABEL</p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: "#000000", letterSpacing: "0.02em" }}>{panelId ?? "–"}</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ display: "inline-flex", padding: "3px 12px", borderRadius: 999, background: "#ADCFF1", color: "#000000", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                    RW Line {panelLineVal || "–"}
                  </span>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "#000000", marginTop: 4 }}>{qcDate || "–"}</p>
                </div>
              </div>
              <p style={{ fontSize: 12, color: "#000000", marginBottom: 14, lineHeight: 1.4 }}>
                {(isReturned ? selected!.material_id : info?.materialId) ? `${isReturned ? selected!.material_id : info?.materialId} · ` : ""}{panelDesc ?? "–"}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px", marginBottom: 14 }}>
                <LabelField label="Order No."   value={isReturned ? selected!.order_id : (orderNo || "–")} />
                <LabelField label="Material ID" value={isReturned ? (selected!.material_id ?? "-") : (info?.materialId ?? "-")} />
                <LabelField label="Line Post"   value={isReturned ? (selected!.line_post ?? "–") : (info?.linePost ?? "–")} />
                <LabelField label="Prog Plan"   value={panelProgPlan || "–"} />
                <LabelField label="QC After P"  value={panelQcAfterP || "–"} />
                <LabelField label="RW Line"     value={panelLineVal || "–"} />
                <div>
                  <p style={{ fontSize: 9, color: "#8C8985", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 2 }}>RW QTY</p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: "#DC2626" }}>{panelFailed !== null ? String(panelFailed) : "–"}</p>
                </div>
                <LabelField label="Round"       value={`${panelRound}`} />
              </div>
              {panelDefects.size > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <p style={{ fontSize: 9, color: "#8C8985", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Defect Codes</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {Array.from(panelDefects).map(code => (
                      <span key={code} style={{ padding: "2px 8px", borderRadius: 999, border: "1px solid #000000", background: "#000000", color: "#fff", fontSize: 10, fontWeight: 500 }}>
                        {code}{defectOptions.find(d => d.defect_code === code) ? ` · ${defectOptions.find(d => d.defect_code === code)!.description_th}` : ""}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {panelRemark && <div style={{ marginBottom: 10 }}><LabelField label="Remark" value={panelRemark} /></div>}
              <LabelField label="QC Name" value={qcName || "–"} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── DefectDropdown ────────────────────────────────────────────────────────────

function DefectDropdown({ selectedCodes, onToggle, searchVal, setSearch, isOpen, setOpen, dropRef, options }: {
  selectedCodes: Set<string>
  onToggle:      (code: string) => void
  searchVal:     string
  setSearch:     (v: string) => void
  isOpen:        boolean
  setOpen:       (v: boolean) => void
  dropRef:       React.RefObject<HTMLDivElement | null>
  options:       import("../../lib/api").DefectCode[]
}) {
  const filtered = options.filter(d =>
    d.defect_code.toLowerCase().includes(searchVal.toLowerCase()) ||
    d.description_th.toLowerCase().includes(searchVal.toLowerCase())
  );

  return (
    <div ref={dropRef} style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14, position: "relative" }}>
      <p style={{ fontSize: 11, color: "#000000", fontWeight: 500 }}>Defect Code</p>

      {/* Selected chips */}
      {selectedCodes.size > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 2 }}>
          {Array.from(selectedCodes).map(code => {
            const opt = options.find(d => d.defect_code === code);
            return (
              <button key={code} onClick={() => onToggle(code)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 8px 3px 12px", borderRadius: 999, fontSize: 12, fontWeight: 500, cursor: "pointer", border: "none", background: "#000000", color: "#fff", fontFamily: "Inter, sans-serif" }}>
                <span>{code}{opt ? ` · ${opt.description_th}` : ""}</span>
                <span style={{ fontSize: 14, lineHeight: 1, opacity: 0.7 }}>×</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Search input */}
      <input
        value={searchVal}
        onChange={e => { setSearch(e.target.value); setOpen(true); }}
        onFocus={e => { setOpen(true); e.target.style.borderColor = "#8DBAED"; }}
        onBlur={e  => { e.target.style.borderColor = "#E5E7EB"; }}
        onMouseDown={e => e.stopPropagation()}
        placeholder="-"
        style={{ width: "100%", height: 36, padding: "0 10px", fontSize: 13, color: "#000000", background: "#fff", border: "0.5px solid #E5E7EB", borderRadius: 8, outline: "none", boxSizing: "border-box", fontFamily: "Inter, sans-serif" }}
      />

      {/* Options dropdown */}
      {isOpen && filtered.length > 0 && (
        <div style={{ position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0, zIndex: 50, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", maxHeight: 200, overflowY: "auto" }}>
          {filtered.map(d => {
            const isSel = selectedCodes.has(d.defect_code);
            return (
              <div key={d.defect_code}
                onMouseDown={e => { e.preventDefault(); onToggle(d.defect_code); setSearch(""); }}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", cursor: "pointer", background: isSel ? "#ADCFF1" : "#fff", borderBottom: "0.5px solid #E5E7EB" }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "#F9FAFB"; }}
                onMouseLeave={e => { e.currentTarget.style.background = isSel ? "#ADCFF1" : "#fff"; }}
              >
                <span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#000000" }}>{d.defect_code}</span>
                  <span style={{ fontSize: 12, color: "#000000", marginLeft: 8 }}>{d.description_th}</span>
                </span>
                {isSel && <span style={{ fontSize: 12, color: "#000000", fontWeight: 600 }}>✓</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Shared helper components ──────────────────────────────────────────────────

function ctaBtn(bg: string, color: string): CSSProperties {
  return { width: "100%", height: 44, background: bg, color, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: bg === "#E5E7EB" ? "not-allowed" : "pointer", fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 };
}
function Card({ children }: { children: ReactNode }) {
  return <div style={{ background: "#fff", border: "0.5px solid #E5E7EB", borderRadius: 8, padding: 20 }}>{children}</div>;
}
function SectionLabel({ children }: { children: ReactNode }) {
  return <p style={{ fontSize: 11, fontWeight: 600, color: "#8C8985", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>{children}</p>;
}
function InfoField({ label, value }: { label: string; value: string }) {
  return <div><p style={{ fontSize: 10, color: "#8C8985", marginBottom: 2 }}>{label}</p><p style={{ fontSize: 13, color: "#000000" }}>{value}</p></div>;
}
function SummaryField({ label, value, color }: { label: string; value: string; color?: string }) {
  return <div><p style={{ fontSize: 10, color: "#8C8985", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>{label}</p><p style={{ fontSize: 14, fontWeight: 600, color: color ?? "#000000" }}>{value}</p></div>;
}
function LabelField({ label, value }: { label: string; value: string }) {
  return <div><p style={{ fontSize: 9, color: "#8C8985", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 2 }}>{label}</p><p style={{ fontSize: 12, fontWeight: 600, color: "#000000" }}>{value}</p></div>;
}
function NumberField({ label, value, onChange, readOnly = false, bg, labelColor = "#000000" }: {
  label: string; value: string; onChange?: (v: string) => void; readOnly?: boolean; bg: string; labelColor?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <p style={{ fontSize: 11, color: labelColor, fontWeight: 500 }}>{label}</p>
      <input type="number" value={value} readOnly={readOnly} onChange={e => onChange?.(e.target.value)} placeholder="0"
        style={{ height: 44, width: "100%", padding: "0 10px", fontSize: 20, fontWeight: 600, color: "#000000", background: bg, border: "0.5px solid #E5E7EB", borderRadius: 8, outline: "none", textAlign: "center", boxSizing: "border-box", fontFamily: "Inter, sans-serif" }} />
    </div>
  );
}
function CheckRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 5, cursor: "pointer", fontSize: 12, color: "#000000", fontFamily: "Inter, sans-serif" }}
      onMouseEnter={e => (e.currentTarget.style.background = "#F0EEE4")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ accentColor: "#8DBAED", width: 13, height: 13, cursor: "pointer" }} />
      {label}
    </label>
  );
}
function RetCell({ children, center }: { children: ReactNode; center?: boolean }) {
  return <div style={{ padding: "0 10px", display: "flex", alignItems: "center", justifyContent: center ? "center" : "flex-start", minHeight: 44 }}>{children}</div>;
}

const inputStyle: CSSProperties = { flex: 1, width: "100%", height: 40, padding: "0 12px", fontSize: 13, color: "#000000", background: "#fff", border: "0.5px solid #E5E7EB", borderRadius: 8, outline: "none", boxSizing: "border-box", fontFamily: "Inter, sans-serif" };
const qrBtnStyle: CSSProperties = { width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", border: "0.5px solid #8DBAED", borderRadius: 8, cursor: "pointer", color: "#8DBAED", flexShrink: 0 };
