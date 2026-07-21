"use client"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import QcDashboard from "./QcDashboard"

// ── Main component ────────────────────────────────────────────────────────────

export function FinalQcMonitoring() {
  const router = useRouter()

  return (
    <div style={{ width: "100%", minHeight: "100vh", background: "#F0EEE4", fontFamily: "Inter, sans-serif" }}>

      {/* App bar */}
      <div style={{ height: 56, background: "#fff", borderBottom: "0.5px solid #E5E7EB", display: "flex", alignItems: "center", padding: "0 32px", gap: 12 }}>
        <button
          onClick={() => router.push("/")}
          style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", borderRadius: 8, color: "#8C8985" }}
        >
          <ArrowLeft size={18} />
        </button>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#000000" }}>Final QC Monitoring</span>
      </div>

      {/* QC monitoring table */}
      <QcDashboard />
    </div>
  )
}
