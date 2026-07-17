"use client"
import { useState, useRef, useEffect, type CSSProperties, type ReactNode } from "react";
import { ArrowLeft, ClipboardList, BadgeAlert, UserRoundCog, PackageSearch, XCircle, ChevronDown, ChevronRight, Download, Printer, X } from "lucide-react";
import { useRouter } from "next/navigation"
import { fetchAllLabels, formatDateFromISO, fetchDefectCodes, type ApiLabel, type DefectCode } from "../../../services/reworkApi"

// ── Types ─────────────────────────────────────────────────────────────────────

type Status = ApiLabel["status"]

type OrderGroup = {
  orderId:      string;
  materialId:   string | null | undefined;
  description:  string | null | undefined;
  latestRound:  number;
  latestStatus: Status;
  latestDate:   string;
  labels:       ApiLabel[];
}

type ReworkLogRow = {
  packWk:      string | null | undefined;
  date:        string;
  order:       string;
  description: string | null | undefined;
  linePost:    string | null | undefined;
  progPlan:    string | null | undefined;
  qcAfterP:    string | null | undefined;
  total:       number | null | undefined;
  good:        number;
  bad:         number;
  rw:          (number | null)[];
}

type GroupColKey = "orderId" | "materialId" | "description" | "latestStatus" | "latestDate";
type GroupFilters = Partial<Record<GroupColKey, Set<string>>>;

// ── Constants ─────────────────────────────────────────────────────────────────

// Physical receipt paper width used by the "reprint" print window below.
const PRINT_WIDTH_MM = 57;

const STATUS_CHIP: Record<Status, { label: string; bg: string; color: string }> = {
  ISSUED:      { label: "Issued",      bg: "#FEE2E2", color: "#991B1B" },
  IN_PROGRESS: { label: "In Progress", bg: "#FEF3C7", color: "#92400E" },
  RETURNED:    { label: "Returned",    bg: "#DCFCE7", color: "#166534" },
  CLOSED:      { label: "Closed",      bg: "#EDE9FE", color: "#4C1D95" },
};

const TH_BASE: CSSProperties = {
  fontSize: 10, fontWeight: 600, color: "#999",
  textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap",
};

const GROUP_COLS: { key: GroupColKey; label: string; width: string }[] = [
  { key: "orderId",      label: "ORDER",          width: "120px" },
  { key: "materialId",   label: "MATERIAL ID",    width: "120px" },
  { key: "description",  label: "DESCRIPTION",    width: "1fr"   },
  { key: "latestStatus", label: "ROUND / STATUS", width: "160px" },
  { key: "latestDate",   label: "LAST UPDATED",   width: "160px" },
];

const TABLE_GRID = `32px ${GROUP_COLS.map(c => c.width).join(" ")}`;

const LOG_HEADERS: { label: string; center: boolean; color?: string; bg?: string }[] = [
  { label: "PACK WK",     center: true  },
  { label: "DATE",        center: false },
  { label: "ORDER",       center: false },
  { label: "DESCRIPTION", center: false },
  { label: "LINE POST",   center: true  },
  { label: "PROG PLAN",   center: true  },
  { label: "QC AFTER P",  center: true  },
  { label: "TOTAL",       center: true  },
  { label: "งานดี",        center: true, color: "#166534", bg: "#DCFCE7" },
  { label: "งานเสีย",      center: true, color: "#991B1B", bg: "#FEE2E2" },
  { label: "R1", center: true, color: "#4C1D95", bg: "#EDE9FE" },
  { label: "R2", center: true, color: "#4C1D95", bg: "#EDE9FE" },
  { label: "R3", center: true, color: "#4C1D95", bg: "#EDE9FE" },
  { label: "R4", center: true, color: "#4C1D95", bg: "#EDE9FE" },
  { label: "R5", center: true, color: "#4C1D95", bg: "#EDE9FE" },
  { label: "R6", center: true, color: "#4C1D95", bg: "#EDE9FE" },
];

const LOG_COLS = "90px 90px 120px 1fr 90px 90px 90px 90px 90px 90px 40px 40px 40px 40px 40px 40px";

// ── Data helpers ──────────────────────────────────────────────────────────────

// Group all labels by orderId, sorted by round ascending
function buildOrderGroups(labels: ApiLabel[]): OrderGroup[] {
  const map = new Map<string, ApiLabel[]>();
  for (const r of labels) {
    if (!map.has(r.order_id)) map.set(r.order_id, []);
    map.get(r.order_id)!.push(r);
  }
  return Array.from(map.values()).map(group => {
    group.sort((a, b) => a.round_no - b.round_no);
    const latest = group[group.length - 1];
    return {
      orderId:      latest.order_id,
      materialId:   latest.material_id,
      description:  latest.description,
      latestRound:  latest.round_no,
      latestStatus: latest.status,
      latestDate:   formatDateFromISO(latest.issued_at),
      labels:       group,
    };
  });
}

// Build rework log: 1 row per order, with first-pass good/bad and per-round results
function buildReworkLog(labels: ApiLabel[]): ReworkLogRow[] {
  const map = new Map<string, ApiLabel[]>();
  for (const r of labels) {
    if (!map.has(r.order_id)) map.set(r.order_id, []);
    map.get(r.order_id)!.push(r);
  }
  return Array.from(map.values()).map(group => {
    group.sort((a, b) => a.round_no - b.round_no);
    const first  = group[0];
    const latest = group[group.length - 1];
    const round1 = group.find(l => l.round_no === 1)!;

    // good = total qty minus what was sent to rework in round 1
    const firstPassGood = (latest.total ?? 0) - round1.input_qty;

    // rw[n-1] = result_good_qty of round n (null if not closed yet)
    const rw: (number | null)[] = Array(6).fill(null);
    group.forEach(l => { if (l.round_no >= 1 && l.round_no <= 6) rw[l.round_no - 1] = l.result_good_qty; });

    return {
      packWk:      latest.pack_wk,
      date:        formatDateFromISO(first.issued_at),
      order:       first.order_id,
      description: first.description,
      linePost:    latest.line_post,
      progPlan:    latest.prog_plan,
      qcAfterP:    latest.qc_after_p,
      total:       latest.total,
      good:        firstPassGood,
      bad:         round1.input_qty,
      rw,
    };
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

const ExportBtn = () => (
  <button style={{ display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 14px", background: "#fff", border: "0.5px solid #E5E7EB", borderRadius: 8, fontSize: 12, fontWeight: 500, color: "#374151", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
    <Download size={13} color="#000000" /> Export
  </button>
);

function CardField({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p style={{ fontSize: 10, color: "#8C8985", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 12, fontWeight: 500, color: color ?? "#000000" }}>{value}</p>
    </div>
  );
}

function MetricCard({ icon, iconBg, iconBorder, label, value, valueCss, cardCss, labelCss }: {
  icon: ReactNode; iconBg: string; iconBorder: string;
  label: string; value: number;
  valueCss: CSSProperties; cardCss: { background: string; borderColor: string };
  labelCss: CSSProperties;
}) {
  return (
    <div style={{ background: cardCss.background, border: `0.5px solid ${cardCss.borderColor}`, borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: iconBg, border: `0.5px solid ${iconBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
      <div>
        <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4, ...labelCss }}>{label}</p>
        <p style={{ fontSize: 30, fontWeight: 700, lineHeight: 1, ...valueCss }}>{value}</p>
      </div>
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

function LogCell({ children, center, muted, green, red }: {
  children: ReactNode; center?: boolean; muted?: boolean; green?: boolean; red?: boolean;
}) {
  return (
    <div style={{
      fontSize: 12,
      color: red ? "#DC2626" : green ? "#16A34A" : "#000000",
      fontWeight: 400,
      padding: "0 8px",
      textAlign: center ? "center" : "left",
      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
    }}>
      {children}
    </div>
  );
}

// Small labeled value used inside the printed receipt label.
function LabelFieldD({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p style={{ fontSize: 7, color: "#000000", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 9, fontWeight: 600, color: "#000000" }}>{value}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ReworkDashboard() {

  // ── Data state ──────────────────────────────────────────────────────────────
  const [labels,  setLabels]  = useState<ApiLabel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllLabels()
      .then(data => { setLabels(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  // Derived data — recomputed when labels change
  const orderGroups     = buildOrderGroups(labels);
  const reworkLog       = buildReworkLog(labels);
  const issuedCount     = labels.filter(r => r.status === "ISSUED").length;
  const inProgressCount = labels.filter(r => r.status === "IN_PROGRESS").length;
  const returnedCount   = labels.filter(r => r.status === "RETURNED").length;
  const closedCount     = labels.filter(r => r.status === "CLOSED").length;

  // ── UI state ────────────────────────────────────────────────────────────────
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [expandedLabels, setExpandedLabels] = useState<Set<string>>(new Set());
  const [openCol,        setOpenCol]        = useState<GroupColKey | null>(null);
  const [filters,        setFilters]        = useState<GroupFilters>({});
  const [draft,          setDraft]          = useState<Set<string>>(new Set());
  const [colSearch,      setColSearch]      = useState("");
  const [searchText,     setSearchText]     = useState("");
  const [quickStatus,    setQuickStatus]    = useState<Set<Status | "ALL">>(new Set(["ALL"]));
  const [printLabel,     setPrintLabel]     = useState<ApiLabel | null>(null);
  const [showLog,        setShowLog]        = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const router   = useRouter();
  const [defectOptions, setDefectOptions] = useState<DefectCode[]>([]);

  // Print area ref — used to grab the label markup and print it in its own window
  const printRef = useRef<HTMLDivElement>(null);

  // Close filter dropdown on outside click
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

  // ── Expand/collapse handlers ─────────────────────────────────────────────────

  function toggleOrder(orderId: string) {
    setExpandedOrders(prev => { const n = new Set(prev); n.has(orderId) ? n.delete(orderId) : n.add(orderId); return n; });
  }

  function toggleLabel(labelId: string) {
    setExpandedLabels(prev => { const n = new Set(prev); n.has(labelId) ? n.delete(labelId) : n.add(labelId); return n; });
  }

  // ── Filter helpers ───────────────────────────────────────────────────────────

  function groupUniqueValues(col: GroupColKey): string[] {
    return Array.from(new Set(orderGroups.map(r => String(r[col] ?? "")).filter(Boolean))).sort();
  }

  function openFilter(col: GroupColKey) {
    if (openCol === col) { setOpenCol(null); return; }
    setDraft(filters[col] ? new Set(filters[col]) : new Set(groupUniqueValues(col)));
    setColSearch(""); setOpenCol(col);
  }

  function applyFilter() {
    const vals  = groupUniqueValues(openCol!);
    const isAll = vals.every(v => draft.has(v));
    setFilters(prev => { const n = { ...prev }; if (isAll) delete n[openCol!]; else n[openCol!] = new Set(draft); return n; });
    setOpenCol(null);
  }

  function clearFilter() {
    setFilters(prev => { const n = { ...prev }; delete n[openCol!]; return n; });
    setOpenCol(null);
  }

  function toggleDraft(val: string) {
    setDraft(prev => { const n = new Set(prev); n.has(val) ? n.delete(val) : n.add(val); return n; });
  }

  function toggleAll() {
    const vals = groupUniqueValues(openCol!);
    setDraft(vals.every(v => draft.has(v)) ? new Set() : new Set(vals));
  }

  function clearAllFilters() {
    setFilters({});
    setSearchText("");
    setQuickStatus(new Set(["ALL"]));
    setExpandedOrders(new Set());
    setExpandedLabels(new Set());
  }

  // ── Derived filter state ─────────────────────────────────────────────────────

  const filteredGroups = orderGroups.filter(row => {
    const matchesColFilters  = (Object.entries(filters) as [GroupColKey, Set<string>][]).every(([col, allowed]) => allowed.has(String(row[col] ?? "")));
    const matchesQuickStatus = quickStatus.has("ALL") || quickStatus.has(row.latestStatus);
    const q = searchText.trim().toLowerCase();
    const matchesSearch = !q ||
      [row.orderId, row.materialId, row.description].some(v => String(v ?? "").toLowerCase().includes(q)) ||
      row.labels.some(lbl =>
        lbl.label_id.toLowerCase().includes(q) ||
        (lbl.line_post ?? "").toLowerCase().includes(q) ||
        (lbl.remark ?? "").toLowerCase().includes(q) ||
        lbl.defect_codes.some(code =>
          code.toLowerCase().includes(q) ||
          (defectOptions.find(d => d.defect_code === code)?.description_th ?? "").toLowerCase().includes(q)) ||
        (lbl.qc_name ?? "").toLowerCase().includes(q)
      );

    return matchesColFilters && matchesQuickStatus && matchesSearch;
  });

  const isFilterActive = (col: GroupColKey) => !!filters[col];
  const hasFilters = Object.keys(filters).length > 0 || searchText.trim() !== "" || !quickStatus.has("ALL");

  // ── Print handler ─────────────────────────────────────────────────────────────
  // Opens a dedicated, bare window containing ONLY the label markup and prints
  // from there — avoids fighting this page's own layout/modal for @page sizing.
  function handlePrint() {
    const content = printRef.current?.innerHTML;
    if (!content) return;

    const printWindow = window.open("", "_blank", "width=400,height=600");
    if (!printWindow) {
      alert("ไม่สามารถเปิดหน้าต่างพิมพ์ได้ กรุณาอนุญาต pop-up สำหรับเว็บไซต์นี้");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Print Label</title>
          <style>
            @page { 
              size: ${PRINT_WIDTH_MM}mm auto; 
              margin: 0; 
            }
            * { box-sizing: border-box; }
            
            /* ปรับตัว html และ body ให้ขยับหลบขอบซ้ายที่โดนกิน */
            html, body { 
              margin: 0; 
              padding: 0; 
              background: #fff;
            }
            
            body { 
              /* ดันขอบซ้ายเข้ามา เพื่อหนีโซนบอดของหัวพิมพ์ที่ตัดตัวหนังสือแหว่ง */
              padding: 6px 2px 6px 2mm; 
              
              /* บีบหน้ากว้างเนื้อหาจริงให้เหลือแคบกว่าหน้ากระดาษนิดหน่อย (ถ้ากระดาษ 57mm เนื้อหาจะวิ่งอยู่ที่ ~53mm) */
              width: calc(${PRINT_WIDTH_MM}mm - 4mm); 
              
              font-family: Inter, Arial, sans-serif; 
              -webkit-print-color-adjust: exact; 
              print-color-adjust: exact; 
            }

            /* บังคับให้ตารางและดีฟล็อกข้างในทั้งหมดกางเต็มพอดีกรอบ body ใหม่ ไม่ให้โย้ล้นไปทางขวา */
            body * {
              max-width: 100% !important;
            }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `);
    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
    printWindow.onafterprint = () => printWindow.close();
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{ width: "100%", minHeight: "100vh", background: "#F0EEE4", fontFamily: "Inter, sans-serif" }}>

      {/* App bar */}
      <div style={{ height: 56, background: "#fff", borderBottom: "0.5px solid #E5E7EB", display: "flex", alignItems: "center", padding: "0 32px", gap: 12 }}>
        <button onClick={() => router.push("/rework")} style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", borderRadius: 8, color: "#8C8985" }}>
          <ArrowLeft size={18} />
        </button>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#000000" }}>Dashboard</span>
      </div>

      <div style={{ maxWidth: 1536, margin: "0 auto", padding: "32px 32px 60px" }}>

        {/* ── Metric cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 14, marginBottom: 28 }}>
          <MetricCard icon={<ClipboardList size={16} color="#6B7280" />} iconBg="#F9FAFB" iconBorder="#E5E7EB" label="Total Labels"  value={labels.length}   valueCss={{ color: "#111827" }} cardCss={{ background: "#fff",     borderColor: "#E5E7EB" }} labelCss={{ color: "#9CA3AF" }} />
          <MetricCard icon={<BadgeAlert    size={16} color="#991B1B" />} iconBg="#FEE2E2" iconBorder="#FECACA" label="Issued"        value={issuedCount}     valueCss={{ color: "#991B1B" }} cardCss={{ background: "#FEF2F2", borderColor: "#FECACA" }} labelCss={{ color: "#991B1B" }} />
          <MetricCard icon={<UserRoundCog  size={16} color="#92400E" />} iconBg="#FEF3C7" iconBorder="#FDE68A" label="In Progress"   value={inProgressCount} valueCss={{ color: "#92400E" }} cardCss={{ background: "#FFFBEB", borderColor: "#FDE68A" }} labelCss={{ color: "#92400E" }} />
          <MetricCard icon={<PackageSearch size={16} color="#166534" />} iconBg="#DCFCE7" iconBorder="#BBF7D0" label="Returned"      value={returnedCount}   valueCss={{ color: "#166534" }} cardCss={{ background: "#F0FDF4", borderColor: "#BBF7D0" }} labelCss={{ color: "#166534" }} />
          <MetricCard icon={<XCircle       size={16} color="#4C1D95" />} iconBg="#EDE9FE" iconBorder="#DDD6FE" label="Closed"        value={closedCount}     valueCss={{ color: "#4C1D95" }} cardCss={{ background: "#F5F3FF", borderColor: "#DDD6FE" }} labelCss={{ color: "#6D28D9" }} />
        </div>

       {/* ── All rework orders table ── */}
        <div ref={tableRef} style={{ background: "#fff", border: "0.5px solid #E5E7EB", borderRadius: 12, overflow: "visible", position: "relative", marginBottom: 16 }}>

          {/* Table top bar */}
          <div style={{ padding: "14px 20px", borderBottom: "0.5px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            
            {/* ฝั่งซ้าย: Title */}
            <span style={{ fontSize: 13, fontWeight: 600, color: "#000000" }}>All rework orders</span>
            
            {/* ฝั่งขวา: Search Box + Quick Filters + Clear all */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              
              {/* Container ของ Search Box เพื่อทำปุ่มกากบาทริมขวา */}
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <input
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  placeholder="Search..."
                  style={{ width: 240, height: 32, padding: "0 32px 0 12px", fontSize: 13, color: "#000000", background: "#fff", border: "0.5px solid #E5E7EB", borderRadius: 8, outline: "none", boxSizing: "border-box", fontFamily: "Inter, sans-serif" }}
                  onFocus={e => (e.target.style.borderColor = "#8DBAED")}
                  onBlur={e  => (e.target.style.borderColor = "#E5E7EB")}
                />
                {/* ปุ่ม Clear Filter (X) ในช่องค้นหา จะขึ้นเมื่อมีข้อความเท่านั้น */}
                {searchText && (
                  <button 
                    onClick={() => setSearchText("")} 
                    style={{ position: "absolute", right: 8, background: "none", border: "none", color: "#8C8985", cursor: "pointer", fontSize: 14, fontWeight: "bold", padding: 4, display: "flex", alignItems: "center", justifyContent: "center" }}
                    title="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
              
              {/* Quick status filters */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {([
                  { key: "ALL" as const,         label: "All" },
                  { key: "ISSUED" as const,      label: "Issued" },
                  { key: "IN_PROGRESS" as const, label: "In Progress" },
                  { key: "RETURNED" as const,    label: "Returned" },
                  { key: "CLOSED" as const,      label: "Closed" },
                ]).map(opt => {
                  const active = quickStatus.has(opt.key);
                  return (
                    <button
                      key={opt.key}
                      onClick={() => {
                        setQuickStatus(prev => {
                          const next = new Set(prev);
                          if (opt.key === "ALL") return new Set(["ALL"]);
                          next.delete("ALL");
                          if (next.has(opt.key)) {
                            next.delete(opt.key);
                            if (next.size === 0) return new Set(["ALL"]);
                          } else {
                            next.add(opt.key);
                          }
                          return next;
                        });
                      }}
                      style={{
                        height: 32, padding: "0 14px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                        cursor: "pointer", fontFamily: "Inter, sans-serif",
                        background: active ? "#8DBAED" : "#fff",
                        color: active ? "#fff" : "#8C8985",
                        border: active ? "0.5px solid #8DBAED" : "0.5px solid #E5E7EB",
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>

              {/* ปุ่ม Clear all ขวาสุด */}
              {hasFilters && (
                <button 
                  onClick={() => {
                    clearAllFilters();              
                    setExpandedOrders(new Set());     
                    setExpandedLabels(new Set());      
                  }} 
                  style={{ 
                    fontSize: 12, 
                    color: "#8C8985", 
                    background: "none", 
                    border: "none", 
                    cursor: "pointer", 
                    fontFamily: "Inter, sans-serif" 
                  }}
                >
                  Clear all
                </button>
              )}
            </div>
          </div>

          {/* Column headers with filter dropdowns */}
          <div style={{ display: "grid", gridTemplateColumns: TABLE_GRID, background: "#ADCFF1", borderBottom: "1px solid #8DBAED" }}>
            <div style={{ height: 36 }} />
            {GROUP_COLS.map(col => {
              const active = isFilterActive(col.key);
              const isOpen = openCol === col.key;
              return (
                <div key={col.key} style={{ position: "relative" }}>
                  <button onClick={() => openFilter(col.key)} style={{ width: "100%", height: 36, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px", gap: 4, background: isOpen ? "#E5E7EB" : "transparent", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif", borderRight: "0.5px solid #E5E7EB" }}>
                    <span style={{ ...TH_BASE, color: active ? "#fff" : "#000000" }}>{col.label}</span>
                    <ChevronDown size={12} color={active || isOpen ? "#fff" : "#000000"} style={{ flexShrink: 0 }} />
                  </button>
                  {isOpen && (
                    <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 100, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, minWidth: 200, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", overflow: "hidden" }}>
                      <div style={{ padding: "10px 12px 8px" }}>
                        <input value={colSearch} onChange={e => setColSearch(e.target.value)} placeholder="Search..." style={{ width: "100%", height: 30, padding: "0 10px", fontSize: 12, color: "#000000", background: "#F9FAFB", border: "0.5px solid #E5E7EB", borderRadius: 6, outline: "none", boxSizing: "border-box", fontFamily: "Inter, sans-serif" }} />
                      </div>
                      <div style={{ padding: "0 4px 4px", maxHeight: 200, overflowY: "auto" }}>
                        <CheckRow label="All" checked={groupUniqueValues(col.key).every(v => draft.has(v))} onChange={toggleAll} />
                        {groupUniqueValues(col.key).filter(v => v.toLowerCase().includes(colSearch.toLowerCase())).map(val => (
                          <CheckRow key={val} label={val} checked={draft.has(val)} onChange={() => toggleDraft(val)} />
                        ))}
                      </div>
                      <div style={{ padding: "8px 12px 10px", borderTop: "0.5px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <button onClick={clearFilter} style={{ height: 28, padding: "0 10px", borderRadius: 6, fontSize: 12, color: "#8C8985", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>Clear</button>
                        <button onClick={applyFilter} style={{ height: 28, padding: "0 14px", background: "#8DBAED", color: "#fff", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>Apply</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Table rows */}
          {loading ? (
            <div style={{ padding: "24px 20px", fontSize: 13, color: "#9CA3AF", textAlign: "center" }}>Loading...</div>
          ) : filteredGroups.length === 0 ? (
            <div style={{ padding: "24px 20px", fontSize: 13, color: "#9CA3AF", textAlign: "center" }}>No orders match the current filters</div>
          ) : filteredGroups.map((group, gi) => {
            const isExpanded = expandedOrders.has(group.orderId);
            return (
              <div key={group.orderId}>

                {/* Level 1: Order row */}
                <div
                  onClick={() => toggleOrder(group.orderId)}
                  style={{ display: "grid", gridTemplateColumns: TABLE_GRID, minHeight: 48, alignItems: "center", cursor: "pointer", borderBottom: (!isExpanded && gi < filteredGroups.length - 1) ? "1px solid #E5E7EB" : "none", background: isExpanded ? "#E5E7EB" : "#fff", borderLeft: `3px solid ${isExpanded ? "#8DBAED" : "transparent"}` }}
                  onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = "#F9FAFB"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isExpanded ? "#E5E7EB" : "#fff"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {isExpanded ? <ChevronDown size={14} color="#8DBAED" /> : <ChevronRight size={14} color="#8DBAED" />}
                  </div>
                  <div style={{ fontSize: 13, color: "#000000", padding: "0 12px", fontWeight: 500 }}>{group.orderId}</div>
                  <div style={{ fontSize: 13, color: "#000000", padding: "0 12px" }}>{group.materialId ?? "–"}</div>
                  <div style={{ fontSize: 13, color: "#000000", padding: "0 12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{group.description ?? "–"}</div>
                  <div style={{ padding: "0 12px" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 500, background: STATUS_CHIP[group.latestStatus].bg, color: STATUS_CHIP[group.latestStatus].color }}>
                      <span style={{ opacity: 0.7 }}>R{group.latestRound}</span>
                      <span style={{ opacity: 0.4 }}>·</span>
                      {STATUS_CHIP[group.latestStatus].label}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#000000", padding: "0 12px" }}>{group.latestDate}</div>
                </div>

                {/* Level 2: Round rows */}
                {isExpanded && (
                  <div style={{ background: "#fff", borderBottom: gi < filteredGroups.length - 1 ? "1px solid #E5E7EB" : "none" }}>
                    {group.labels.map((lbl, li) => {
                      const isDetailOpen = expandedLabels.has(lbl.label_id);
                      return (
                        <div key={lbl.label_id}>

                          {/* Round compact row */}
                          <div
                            onClick={() => toggleLabel(lbl.label_id)}
                            style={{ display: "grid", gridTemplateColumns: "52px 180px 160px 1fr 110px 40px", minHeight: 40, alignItems: "center", cursor: "pointer", borderBottom: (!isDetailOpen && li < group.labels.length - 1) ? "1px solid #E5E7EB" : "none", background: isDetailOpen ? "#fff" : "transparent", paddingLeft: 20 }}
                            onMouseEnter={e => { if (!isDetailOpen) e.currentTarget.style.background = "#F9FAFB"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = isDetailOpen ? "#fff" : "transparent"; }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                              {isDetailOpen ? <ChevronDown size={12} color="#8DBAED" /> : <ChevronRight size={12} color="#8DBAED" />}
                            </div>
                            <div style={{ fontSize: 12, color: "#000000", fontWeight: 600 }}>{lbl.label_id}</div>
                            <div>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 500, background: STATUS_CHIP[lbl.status].bg, color: STATUS_CHIP[lbl.status].color }}>
                                R{lbl.round_no} · {STATUS_CHIP[lbl.status].label}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: "#9CA3AF" }}>
                              Issued {formatDateFromISO(lbl.issued_at)}{lbl.closed_at ? ` → Closed ${formatDateFromISO(lbl.closed_at)}` : ""}
                            </div>
                            <div style={{ fontSize: 12, color: "#9CA3AF" }}>{lbl.input_qty} pcs</div>
                            <button
                              onClick={e => { e.stopPropagation(); setPrintLabel(lbl); }}
                              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, background: "none", borderRadius: 6, cursor: "pointer", color: "#8C8985", marginRight: 20 }}
                            >
                              <Printer size={12} />
                            </button>
                          </div>

                          {/* Level 3: Detail card */}
                          {isDetailOpen && (
                            <div style={{ padding: "12px 20px 14px 72px", background: "#fff", borderBottom: li < group.labels.length - 1 ? "1px solid #E5E7EB" : "none" }}>
                              <div style={{ background: "#F9FAFB", border: `0.5px solid #E5E7EB`, borderLeft: `3px solid ${STATUS_CHIP[lbl.status].color}`, borderRadius: 8, padding: "12px 16px" }}>

                                {/* Date + qty fields */}
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px 20px", marginBottom: (lbl.defect_codes.length > 0 || lbl.remark) ? 12 : 0 }}>
                                  <CardField label="RW Line"   value={lbl.line_post ?? "–"} />
                                  <CardField label="Input Qty" value={String(lbl.input_qty)} />
                                  <CardField label="Good"      value={lbl.result_good_qty !== null ? String(lbl.result_good_qty) : "–"} />
                                  <CardField label="Bad"       value={lbl.result_bad_qty  !== null ? String(lbl.result_bad_qty)  : "–"} />
                                </div>
                                {/* Defect codes */}
                                {lbl.defect_codes.length > 0 && (
                                  <div style={{ marginBottom: lbl.remark ? 10 : 0 }}>
                                    <p style={{ fontSize: 10, color: "#8C8985", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>Defect Codes</p>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                                      {lbl.defect_codes.map(code => (
                                        <span key={code} style={{ padding: "2px 8px", borderRadius: 999, background: "#000000", color: "#fff", fontSize: 11, fontWeight: 500 }}>
                                          {code}{defectOptions.find(d => d.defect_code === code) ? ` · ${defectOptions.find(d => d.defect_code === code)!.description_th}` : ""}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {/* Remark */}
                                {lbl.remark && (
                                  <div>
                                    <p style={{ fontSize: 10, color: "#8C8985", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>Remark</p>
                                    <p style={{ fontSize: 12, color: "#000000" }}>{lbl.remark}</p>
                                  </div>
                                )}
                                <div style={{ display: "grid", gridTemplateColumns: "1fr", marginBottom: 8 }}>
                                  <CardField label="QC Name" value={lbl.qc_name ?? "–"} />
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px 20px", marginBottom: (lbl.defect_codes.length > 0 || lbl.remark) ? 12 : 0 }}>
                                  <CardField label="Issued"    value={formatDateFromISO(lbl.issued_at)   || "–"} />
                                  <CardField label="Returned"  value={formatDateFromISO(lbl.returned_at) || "–"} />
                                  <CardField label="Received"  value={formatDateFromISO(lbl.received_at) || "–"} />
                                  <CardField label="Closed"    value={formatDateFromISO(lbl.closed_at)   || "–"} />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Print Preview Modal (reprint from dashboard) ── */}
        {printLabel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#F0EEE4", borderRadius: 12, padding: 24, maxHeight: "90vh", overflowY: "auto", width: 500 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#000000" }}>Print Preview</p>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handlePrint} style={{ height: 32, padding: "0 14px", background: "#8DBAED", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#fff", cursor: "pointer", fontFamily: "Inter, sans-serif", display: "flex", alignItems: "center", gap: 6 }}>
                  <Printer size={13} /> Print
                </button>
                <button onClick={() => setPrintLabel(null)} style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", border: "0.5px solid #E5E7EB", borderRadius: 8, cursor: "pointer", color: "#8C8985" }}>
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* label */}
            <div id="print-area" ref={printRef} style={{ width: "57mm", maxWidth: "57mm", minWidth: "57mm", margin: "0 auto", background: "#fff", padding: "8px 6px", boxSizing: "border-box", fontFamily: "Inter, sans-serif" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8, paddingBottom: 6, borderBottom: "1.5px solid #000000" }}>
                <div>
                  <p style={{ fontSize: 9, fontWeight: 600, color: "#000000", letterSpacing: "0.04em", textTransform: "uppercase", margin: 0 }}>REWORK LABEL</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#000000", letterSpacing: "0.01em", margin: 0, lineHeight: 1.2 }}>{printLabel.label_id}</p>
                </div>
                <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
                  <span style={{ color: "#000000", fontSize: 8, fontWeight: 600, whiteSpace: "nowrap" }}>
                    LINE · {printLabel.line_post || "–"}
                  </span>
                  <span style={{ fontSize: 8, fontWeight: 600, color: "#000000", whiteSpace: "nowrap" }}>
                    PACK WK · {printLabel.pack_wk || "–"}
                  </span>
                </div>
              </div>
              
              <p style={{ fontSize: 9, color: "#000000", marginBottom: 8, lineHeight: 1.3, fontWeight: 600, wordBreak: "break-word" }}>
                {printLabel.material_id ? `${printLabel.material_id} · ` : ""}{printLabel.description ?? "–"}
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px 8px", marginBottom: 8 }}>
                <LabelFieldD label="Order No."   value={printLabel.order_id} />
                <LabelFieldD label="Material ID" value={printLabel.material_id ?? "-"} />
                <LabelFieldD label="Line Post"   value={printLabel.line_post ?? "–"} />
                <LabelFieldD label="Prog Plan"   value={printLabel.prog_plan || "–"} />
                <LabelFieldD label="QC After P"  value={printLabel.qc_after_p || "–"} />
                <div>
                  <p style={{ fontSize: 7, color: "#000000", fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase", marginBottom: 8 }}>RW QTY</p>
                  <p style={{ fontSize: 20, fontWeight: 700, color: "#000000", margin: 0, lineHeight: 1.1 }}>{printLabel.input_qty}</p>
                </div>

                {printLabel.defect_details.length > 0 && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <p style={{ fontSize: 7, color: "#000000", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 4 }}>Defect Details</p>
                    <div style={{ border: "0.5px solid #E5E7EB", borderRadius: 4, overflow: "hidden" }}>
                      {printLabel.defect_details.map(({ code, qty }) => {
                        const opt = defectOptions.find(d => d.defect_code === code);
                        return (
                          <div key={code} style={{ display: "grid", gridTemplateColumns: "30px 1fr 20px", padding: "3px 4px", gap: 4, borderTop: "0.5px solid #E5E7EB", alignItems: "center" }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: "#000000" }}>{code}</span>
                            <span style={{ fontSize: 9, color: "#000000", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{opt?.description_th ?? "–"}</span>
                            <span style={{ fontSize: 10, fontWeight: 600, color: "#000000", textAlign: "center" }}>{qty}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {printLabel.remark && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <LabelFieldD label="Remark" value={printLabel.remark} />
                  </div>
                )}

                <LabelFieldD label="QC Name" value={printLabel.qc_name || "–"} />
                <LabelFieldD label="Date"    value={formatDateFromISO(printLabel.issued_at) || "–"} />
                <LabelFieldD label="Round"   value={`${printLabel.round_no}`} />

                <div style={{ gridColumn: "1 / -1", paddingTop: "30mm", textAlign: "center" }}>
                  <p style={{ fontSize: 7, fontWeight: 600, color: "#000000", margin: 0, letterSpacing: "0.05em" }}>
                    --- END OF LABEL ---
                  </p>
                </div>

              </div>
            </div>
          </div>
        </div>
        )}

        {/* ── Rework Log (toggle) ── */}
        <div>
          <button
            onClick={() => setShowLog(v => !v)}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, color: "#000000", background: "#fff", border: "0.5px solid #E5E7EB", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontFamily: "Inter, sans-serif", marginBottom: showLog ? 12 : 0 }}
          >
            {showLog ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            {showLog ? "Hide" : "Show"} Rework Log
          </button>

          {showLog && (
            <div style={{ background: "#fff", border: "0.5px solid #E5E7EB", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "14px 20px 12px", borderBottom: "0.5px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#000000" }}>Rework Log</span>
                <ExportBtn />
              </div>
              <div style={{ overflowX: "auto" }}>

                {/* Log header */}
                <div style={{ display: "grid", gridTemplateColumns: LOG_COLS, background: "#E5E7EB", borderBottom: "1px solid #E5E7EB", minHeight: 44, alignItems: "center" }}>
                  {LOG_HEADERS.map(h => (
                    <div key={h.label} style={{ ...TH_BASE, padding: "0 8px", textAlign: h.center ? "center" : "left", color: h.color ?? "#000000", background: h.bg ?? "transparent", display: "flex", flexDirection: "column", alignItems: h.center ? "center" : "flex-start", justifyContent: "center", alignSelf: "stretch", gap: 1 }}>
                      <span>{h.label}</span>
                    </div>
                  ))}
                </div>

                {/* Log rows */}
                {reworkLog.map((row, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: LOG_COLS, minHeight: 40, alignItems: "center", borderBottom: i < reworkLog.length - 1 ? "1px solid #E5E7EB" : "none", background: "#fff" }}>
                    <LogCell center>{row.packWk ?? "–"}</LogCell>
                    <LogCell>{row.date}</LogCell>
                    <LogCell>{row.order}</LogCell>
                    <LogCell>{row.description ?? "–"}</LogCell>
                    <LogCell center>{row.linePost  ?? "–"}</LogCell>
                    <LogCell center>{row.progPlan  ?? "–"}</LogCell>
                    <LogCell center>{row.qcAfterP  ?? "–"}</LogCell>
                    <LogCell center>{row.total     ?? "–"}</LogCell>
                    <LogCell center green>{row.good ?? "–"}</LogCell>
                    <LogCell center red={(row.bad ?? 0) > 0}>{(row.bad ?? 0) > 0 ? row.bad : "–"}</LogCell>
                    {row.rw.map((v, j) => (
                      <LogCell key={j} center muted={v === null}>{v !== null ? v : "–"}</LogCell>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
