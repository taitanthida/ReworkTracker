"use client"
import { useRouter } from "next/navigation"
import { Wrench, ClipboardCheck } from "lucide-react"
import type { ReactNode } from "react"

// ── Constants ─────────────────────────────────────────────────────────────────

type Project = {
  icon: ReactNode
  iconBg: string
  iconBorder: string
  title: string
  desc: string
  route: string
  accent: string
  available: boolean
}

const PROJECTS: Project[] = [
  {
    icon: <Wrench size={32} color="#0F6E56" />,
    iconBg: "#ECFDF5", iconBorder: "#A7F3D0",
    title: "Rework Monitoring",
    desc: "ติดตามงาน rework — ออกใบ, รับงาน/ส่งคืน และดูภาพรวมทุก order",
    route: "/rework",
    accent: "#0F6E56",
    available: true,
  },
  {
    icon: <ClipboardCheck size={32} color="#7C3AED" />,
    iconBg: "#F5F3FF", iconBorder: "#DDD6FE",
    title: "Final QC Monitoring",
    desc: "ติดตามการตรวจสอบคุณภาพขั้นสุดท้าย",
    route: "/final-qc",
    accent: "#7C3AED",
    available: true,
  },
]

// ── Main component ────────────────────────────────────────────────────────────

export function ProjectMenu() {
  const router = useRouter()

  function handleNavigate(p: Project) {
    if (!p.available) return
    router.push(p.route)
  }

  return (
    <div style={{ width: "100%", minHeight: "100vh", background: "#F0EEE4", fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 32px" }}>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <p style={{ fontSize: 50, fontWeight: 600, color: "#000000", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
          QC Monitoring
        </p>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#8C8985", marginBottom: 4 }}>
          Select a project
        </h1>
      </div>

      {/* Project cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 320px)", gap: 20 }}>
        {PROJECTS.map(p => (
          <button
            key={p.route}
            onClick={() => handleNavigate(p)}
            disabled={!p.available}
            style={{
              background: "#fff", border: "0.5px solid #E5E7EB", borderRadius: 16,
              padding: "32px 28px", textAlign: "left", fontFamily: "Inter, sans-serif",
              transition: "all 0.15s", display: "flex", flexDirection: "column", gap: 16,
              cursor: p.available ? "pointer" : "not-allowed",
              opacity: p.available ? 1 : 0.55,
            }}
            onMouseEnter={e => {
              if (!p.available) return
              e.currentTarget.style.borderColor = p.accent
              e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.07)"
              e.currentTarget.style.transform = "translateY(-2px)"
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = "#E5E7EB"
              e.currentTarget.style.boxShadow = "none"
              e.currentTarget.style.transform = "translateY(0)"
            }}
          >
            <div style={{ width: 64, height: 64, borderRadius: 16, background: p.iconBg, border: `0.5px solid ${p.iconBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {p.icon}
            </div>
            <div>
              <p style={{ fontSize: 17, fontWeight: 600, color: "#111827", marginBottom: 6 }}>{p.title}</p>
              <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5 }}>{p.desc}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 500, color: p.available ? p.accent : "#9CA3AF", marginTop: "auto" }}>
              {p.available ? "เข้าใช้งาน" : "เร็ว ๆ นี้ (coming soon)"}
              {p.available && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7h8M7 3l4 4-4 4" stroke={p.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
