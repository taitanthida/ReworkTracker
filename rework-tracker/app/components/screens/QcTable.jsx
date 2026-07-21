"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { getMasterMaterials, getOperationQty } from "../../../services/qcApi";

// ── Colors ────────────────────────────────────────────────────────────────────

const C = {
  bg:           "#F0EEE4",
  white:        "#ffffff",
  border:       "#E5E7EB",
  text:         "#000000",
  textMuted:    "#8C8985",
  textLight:    "#9CA3AF",
  headerBg:     "#ADCFF1",
  headerBorder: "#8DBAED",
  accent:       "#8DBAED",
  rowHover:     "#F9FAFB",
  starFinal:    "#16A34A",
  starPost:     "#1D4ED8",
  blankFinal:   "#DC2626",
  blankPost:    "#F59E0B",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function unique(arr) { return [...new Set(arr)].sort(); }
function getGroup(pp) { return pp.startsWith("FINS") ? "final" : "post"; }

// ── CellContent ───────────────────────────────────────────────────────────────

function CellContent({ cell, group }) {
  if (!cell || (cell.star === 0 && cell.blank === 0)) {
    return <span style={{ color: C.textLight }}>—</span>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
      {cell.star > 0 && (
        <span style={{ fontWeight: 700, color: group === "final" ? C.starFinal : C.starPost, fontSize: 14, lineHeight: 1.2 }}>
          ★ {cell.star.toLocaleString()}
        </span>
      )}
      {cell.blank > 0 && (
        <span style={{ fontWeight: 550, color: group === "final" ? C.blankFinal : C.blankPost, fontSize: 12, lineHeight: 1.2 }}>
          {cell.blank.toLocaleString()}
        </span>
      )}
    </div>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────

export default function Table() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [masterMaterials, setMasterMaterials] = useState([]); 

  // Filter state 
  const [isOpen, setIsOpen]     = useState(false); 
  const [colSearch, setColSearch] = useState("");
  const [draftMaterial, setDraftMaterial] = useState(new Set());   
  const [activeMaterial, setActiveMaterial] = useState(new Set());
  const [draftDate, setDraftDate] = useState(new Set());
  const [selectedDate, setSelectedDate] = useState(new Set());   

  const filterRef = useRef(null);

  // โหลด Master Materials ใส่ Dropdown รอบแรก
  useEffect(() => {
    getMasterMaterials()
      .then(setMasterMaterials)
      .catch(err => console.error("Error loading master materials:", err));
  }, []);

  // สร้าง Stringified Key ป้องกัน Hook Size Change
  const materialFilterKey = useMemo(() => {
    if (!activeMaterial) return "";
    return JSON.stringify(Array.from(activeMaterial).sort());
  }, [activeMaterial]);

  // Auto Refresh 
  useEffect(() => {
    // ถ้ายูสเซอร์ยังไม่ได้เลือก Material หรือเพิ่งเปิดหน้าเว็บมา ให้ข้ามไปก่อน
    if (!activeMaterial || activeMaterial.size === 0) return;

    const refreshData = () => {
      const isAll = masterMaterials.every(v => activeMaterial.has(v));
      const materialQuery = isAll ? "all" : Array.from(activeMaterial).join(",");

      getOperationQty(materialQuery, selectedDate)
        .then(setData)
        .catch(err => console.error("Error auto-refreshing table data:", err));
    };

    const interval = setInterval(refreshData, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [materialFilterKey, masterMaterials, activeMaterial, selectedDate]);

  // ปิด Dropdown เมื่อคลิกข้างนอก
  useEffect(() => {
    function handler(e) {
      if (filterRef.current && !filterRef.current.contains(e.target)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = data;

  function openFilter() {
    if (isOpen) { setIsOpen(false); return; }
    setDraftMaterial(new Set(activeMaterial));
    setColSearch("");
    setIsOpen(true);
  }

  function toggleAll() {
    setDraftMaterial(prev => masterMaterials.every(v => prev.has(v)) ? new Set() : new Set(masterMaterials));
  }

  // ฟังก์ชัน Apply Filter 
  async function applyFilter() {
    const isAll = masterMaterials.every(v => draftMaterial.has(v));
    
    if (isAll) {
      setActiveMaterial(new Set(masterMaterials)); 
    } else {
      setActiveMaterial(new Set(draftMaterial));
    }
    
    setSelectedDate(draftDate);
    setIsOpen(false);

    setLoading(true);
    try {
      const materialQuery = isAll ? "all" : Array.from(draftMaterial).join(",");

      if (!isAll && draftMaterial.size === 0) {
        setData([]);
      } else {
        const resData = await getOperationQty(materialQuery, draftDate);
        setData(resData);
      }
    } catch (err) {
      console.error("Error fetching filtered table data:", err);
    } finally {
      setLoading(false);
    }
  }

  // ── Pivot data ────────────────────────────────────────────────────────────

  const finalLines = useMemo(() => unique(
    filtered.filter(d => d.ProgressPlanning.startsWith("FINS")).map(d => d.ProgressPlanning)
  ), [filtered]);

  const postLines = useMemo(() => unique(
    filtered.filter(d => d.ProgressPlanning.startsWith("POSP")).map(d => d.ProgressPlanning)
  ), [filtered]);

  const colKeys = useMemo(() => [
    ...finalLines.map(line => ({ group: "final", line, key: `final||${line}` })),
    ...postLines.map(line  => ({ group: "post",  line, key: `post||${line}`  })),
  ], [finalLines, postLines]);

  const orders = useMemo(() => unique(filtered.map(d => d.Order)), [filtered]);

  const cellMap = useMemo(() => {
    const map = {};
    filtered.forEach(d => {
      const colKey = `${getGroup(d.ProgressPlanning)}||${d.ProgressPlanning}`;
      if (!map[d.Order]) map[d.Order] = {};
      if (!map[d.Order][colKey]) map[d.Order][colKey] = { star: 0, blank: 0 };
      if (d.StatusSTAR === "STAR") map[d.Order][colKey].star  += d.OperationQuantity;
      else                         map[d.Order][colKey].blank += d.OperationQuantity;
    });
    return map;
  }, [filtered]);

  const COL_W          = 90;
  const stickyLeft     = { position: "sticky", left: 0, zIndex: 2, background: C.headerBg };
  const stickyLeftBody = (bg) => ({ position: "sticky", left: 0, zIndex: 1, background: bg });

  return (
    <div className="min-h-screen p-6 font-sans" style={{ background: C.bg }}>
      
      <style>{`
        #custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: #D1D5DB transparent;
        }
        #custom-scrollbar::-webkit-scrollbar {
          height: 10px;
          width: 10px;
        }
        #custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        #custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #D1D5DB;
          border-radius: 999px;
          border: 3px solid ${C.white};
          background-clip: padding-box;
        }
        #custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: #AEB4BD;
        }
        #custom-scrollbar::-webkit-scrollbar-corner {
          background: transparent;
        }
      `}</style>

      <div className="max-w-full">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h1 className="text-base font-bold m-0" style={{ fontSize: 20, color: C.text }}>
            QC Dashboard
          </h1>

          {/* ── ส่วนควบคุม Filters ด้านขวา ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* ── ช่องเลือกวันที่ (Date Input) ── */}
            <div style={{ display: "flex", alignItems: "center" }}>
              <input
                type="date"
                value={draftDate}
                onChange={(e) => setDraftDate(e.target.value)}
                style={{
                  height: 34,
                  padding: "0 12px",
                  borderRadius: 8,
                  border: `0.5px solid ${selectedDate ? C.accent : C.border}`,
                  fontSize: 12,
                  outline: "none",
                  boxSizing: "border-box",
                  fontFamily: "Inter, sans-serif",
                  color: C.text,
                  background: C.white
                }}
              />
            </div>

            {/* ── เมนู Material Dropdown ── */}
            <div ref={filterRef} style={{ position: "relative" }}>
              <button onClick={openFilter}
                style={{ height: 34, padding: "0 12px", display: "flex", alignItems: "center", gap: 6,
                  background: C.white, border: `0.5px solid ${(activeMaterial && activeMaterial.size > 0) || selectedDate ? C.accent : C.border}`,
                  borderRadius: 8, fontSize: 12, color: C.text, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                <span>Material</span>
                {activeMaterial && activeMaterial.size > 0 && (
                  <span style={{ background: C.accent, color: "#fff", borderRadius: 999, fontSize: 10, padding: "1px 6px", fontWeight: 600 }}>
                    {activeMaterial.size}
                  </span>
                )}
                <ChevronDown size={12} color={C.textMuted} />
              </button>

              {isOpen && (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 100,
                  background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8,
                  minWidth: 220, boxShadow: "0 4px 12px rgba(0,0,0,0.08)", overflow: "hidden" }}>

                  <div style={{ padding: "10px 12px 8px" }}>
                    <input value={colSearch} onChange={e => setColSearch(e.target.value)} placeholder="Search Material..."
                      style={{ width: "100%", height: 30, padding: "0 10px", fontSize: 12, color: C.text,
                        background: "#F9FAFB", border: `0.5px solid ${C.border}`, borderRadius: 6,
                        outline: "none", boxSizing: "border-box", fontFamily: "Inter, sans-serif" }} />
                  </div>

                  <div style={{ padding: "0 4px 4px", maxHeight: 180, overflowY: "auto" }}>
                    <CheckRow
                      label="All"
                      checked={masterMaterials.length > 0 && masterMaterials.every(v => draftMaterial.has(v))}
                      onChange={toggleAll}
                    />
                    {masterMaterials.filter(v => v.toString().toLowerCase().includes(colSearch.toLowerCase())).map(v => (
                      <CheckRow 
                        key={v} 
                        label={v} 
                        checked={draftMaterial.has(v)} 
                        onChange={() => {
                          setDraftMaterial(prev => {
                            const n = new Set(prev);
                            n.has(v) ? n.delete(v) : n.add(v);
                            return n;
                          });
                        }} 
                      />
                    ))}
                  </div>

                  <div style={{ padding: "8px 12px 10px", borderTop: `0.5px solid ${C.border}`, display: "flex", justifyContent: "space-between" }}>
                    <button 
                      onClick={() => {
                        setDraftMaterial(new Set());
                      }}
                      style={{ fontSize: 12, color: C.textMuted, background: "none", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif" }}
                    >
                      Clear
                    </button>
                    <button onClick={applyFilter}
                      style={{ height: 28, padding: "0 14px", background: C.accent, color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                      Apply
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* custom-scrollbar */}
        <div id="custom-scrollbar" className="rounded-xl" 
          style={{ background: C.white, border: `0.5px solid ${C.border}`, overflowX: "auto", overflowY: "auto", maxHeight: "calc(100vh - 150px)", position: "relative" }}>
          
          {loading && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, fontSize: 14, fontWeight: 600, color: C.textMuted }}>
              Loading Data...
            </div>
          )}

          <table style={{ fontSize: 12, borderCollapse: "separate", borderSpacing: 0, fontFamily: "Inter, sans-serif", tableLayout: "fixed", width: "100%", minWidth: "max-content"}}>
            <colgroup>
              <col style={{ width: 160 }} />
              {colKeys.map(c => <col key={c.key} style={{ width: COL_W }} />)}
            </colgroup>
            <thead style={{ position: "sticky", top: 0, zIndex: 10, transform: "translateZ(0)" }}>
              <tr style={{ background: C.headerBg }}>
                <th rowSpan={2} className="text-center px-3 whitespace-nowrap"
                  style={{ 
                    ...stickyLeft, 
                    width: 160, 
                    height: 36, 
                    fontSize: 12, 
                    fontWeight: 700, 
                    letterSpacing: "0.07em", 
                    textTransform: "uppercase", 
                    borderRight: `0.5px solid ${C.headerBorder}`,
                    borderBottom: `0.5px solid ${C.headerBorder}`,
                    color: C.text, 
                    verticalAlign: "middle",
                    background: C.headerBg, 
                    zIndex: 12
                  }}>
                  Order No.
                </th>
                {finalLines.length > 0 && (
                  <th colSpan={finalLines.length} className="text-center px-3"
                    style={{ height: 36, fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", borderRight: `0.5px solid ${C.headerBorder}`, borderBottom: `0.5px solid ${C.headerBorder}`, color: C.text, background: C.headerBg, zIndex: 11 }}>
                    Line Final
                  </th>
                )}
                {postLines.length > 0 && (
                  <th colSpan={postLines.length} className="text-center px-3"
                    style={{ height: 36, fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", borderRight: `0.5px solid ${C.headerBorder}`, borderBottom: `0.5px solid ${C.headerBorder}`, color: C.text, background: C.headerBg, zIndex: 11 }}>
                    Line Post
                  </th>
                )}
              </tr>
              <tr style={{ background: C.headerBg }}>
                {colKeys.map(c => (
                  <th key={c.key} className="text-center px-3 whitespace-nowrap"
                    style={{ 
                      width: COL_W, 
                      minWidth: COL_W, 
                      height: 32, 
                      fontSize: 12, 
                      fontWeight: 600, 
                      borderRight: `0.5px solid ${C.headerBorder}`, 
                      borderBottom: `1px solid ${C.headerBorder}`, 
                      color: C.text, 
                      background: C.headerBg,
                      zIndex: 11
                    }}>
                    {c.line}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={colKeys.length + 1} className="text-center" style={{ height: 100, color: C.textMuted, fontStyle: "italic" }}>
                    Please select Material from the filter above and click Apply to load data.
                  </td>
                </tr>
              ) : (
                orders.map((order, oi) => {
                  const rowBg = oi % 2 === 0 ? C.white : C.rowHover;
                  return (
                    <tr key={order} className="qc-row" style={{ background: rowBg }}>
                      <td className="px-3 whitespace-nowrap"
                        style={{ 
                          ...stickyLeftBody(rowBg), 
                          height: 48, 
                          fontWeight: 600, 
                          color: C.text, 
                          borderRight: `0.5px solid ${C.border}`, 
                          borderBottom: `0.5px solid ${C.border}`, 
                          fontSize: 12, 
                          width: 160, 
                          maxWidth: 160, 
                          overflow: "hidden" 
                        }}>
                        {order}
                      </td>
                      {colKeys.map(c => (
                        <td key={c.key} className="px-3 text-right"
                          style={{ 
                            width: COL_W, 
                            minWidth: COL_W, 
                            height: 48, 
                            borderRight: `0.5px solid ${C.border}`, 
                            borderBottom: `0.5px solid ${C.border}`, 
                            verticalAlign: "middle" 
                          }}>
                          <CellContent cell={cellMap[order]?.[c.key]} group={c.group} />
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-4 mb-4">
          {[
            { color: C.starFinal,  label: "FINS ★ — START" },
            { color: C.blankFinal, label: "FINS ○ — (blank)" },
            { color: C.starPost,   label: "POSP ★ — START" },
            { color: C.blankPost,  label: "POSP ○ — (blank)" },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1">
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: l.color, marginTop: 20 , display: "inline-block" }} />
              <span className="text-xs" style={{ color: C.textMuted, marginTop: 20 }}>{l.label}</span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

// ── CheckRow ──────────────────────────────────────────────────────────────────

function CheckRow({ label, checked, onChange }) {
  return (
    <label
      style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 5, cursor: "pointer", fontSize: 12, color: C.text, fontFamily: "Inter, sans-serif" }}
      onMouseEnter={e => (e.currentTarget.style.background = "#F0EEE4")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
      <input type="checkbox" checked={checked} onChange={onChange}
        style={{ accentColor: C.accent, width: 13, height: 13, cursor: "pointer" }} />
      {label}
    </label>
  );
}
