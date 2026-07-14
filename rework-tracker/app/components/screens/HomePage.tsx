"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { LayoutDashboard, FilePlus, Wrench, ArrowLeft } from "lucide-react"
import type { ReactNode } from "react"

// ── Constants ─────────────────────────────────────────────────────────────────

type Role = "qc" | "rw_station" | "admin"

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "admin",      label: "Admin"      },
  { value: "qc",         label: "QC"         },
  { value: "rw_station", label: "RW Station" },
]

const ROLE_ALLOWED: Record<Role, string[]> = {
  qc:         ["/inspect", "/dashboard"],
  rw_station: ["/station"],
  admin:      ["/inspect", "/station", "/dashboard"],
}

const PAGES = [
  {
    icon: <LayoutDashboard size={28} color="#7C3AED" />,
    iconBg: "#F5F3FF", iconBorder: "#DDD6FE",
    title: "Dashboard",
    desc: "ดูภาพรวม status ทุก order และประวัติการ rework",
    route: "/dashboard",
    accent: "#7C3AED",
  },
  {
    icon: <FilePlus size={28} color="#0F6E56" />,
    iconBg: "#ECFDF5", iconBorder: "#A7F3D0",
    title: "Create Rework Label",
    desc: "ออกใบ rework label ใหม่ หรือ re-inspect งานที่ returned กลับมา",
    route: "/inspect",
    accent: "#0F6E56",
  },
  {
    icon: <Wrench size={28} color="#92400E" />,
    iconBg: "#FFFBEB", iconBorder: "#FDE68A",
    title: "Rework Station",
    desc: "รับงาน เริ่มซ่อม และส่งคืนงานเมื่อเสร็จ",
    route: "/station",
    accent: "#92400E",
  },

];

// ── Main component ────────────────────────────────────────────────────────────

export function HomePage() {
  const router = useRouter()
  const [role, setRole] = useState<Role | "">("")

  // ── Load saved role on mount ─────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("role") as Role | null;
    if (saved) setRole(saved);
  }, []);

  function handleRoleChange(r: Role) {
    setRole(r);
    localStorage.setItem("role", r);
  }

  function handleNavigate(route: string) {
    if (!role) return;
    if (!ROLE_ALLOWED[role].includes(route)) return;
    router.push(route);
  }

  const isAllowed = (route: string) => !!role && ROLE_ALLOWED[role].includes(route);

  return (
    <div style={{ width: "100%", minHeight: "100vh", background: "#F0EEE4", fontFamily: "Inter, sans-serif", position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 32px" }}>

      {/* Back to project menu */}
      <button
        onClick={() => router.push("/")}
        style={{ position: "absolute", top: 24, left: 32, display: "flex", alignItems: "center", gap: 6, height: 34, padding: "0 12px", background: "#fff", border: "0.5px solid #E5E7EB", borderRadius: 999, fontSize: 13, fontWeight: 500, color: "#6B7280", cursor: "pointer", fontFamily: "Inter, sans-serif" }}
      >
        <ArrowLeft size={16} /> Projects
      </button>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <p style={{ fontSize: 50, fontWeight: 600, color: "#000000", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
          Rework Tracker
        </p>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#8C8985", marginBottom: 4 }}>
          What would you like to do?
        </h1>
      </div>

      {/* Nav cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 300px)", gap: 20 }}>
        {PAGES.map(page => {
          const allowed = isAllowed(page.route);
          return (
            <button
              key={page.route}
              onClick={() => handleNavigate(page.route)}
              disabled={!allowed}
              style={{
                background: "#fff", border: "0.5px solid #E5E7EB", borderRadius: 16,
                padding: "28px 24px", textAlign: "left", fontFamily: "Inter, sans-serif",
                transition: "all 0.15s", display: "flex", flexDirection: "column", gap: 16,
                cursor: allowed ? "pointer" : "not-allowed",
                opacity: allowed ? 1 : 0.4,
              }}
              onMouseEnter={e => {
                if (!allowed) return;
                e.currentTarget.style.borderColor = page.accent;
                e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.07)";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = "#E5E7EB";
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div style={{ width: 56, height: 56, borderRadius: 14, background: page.iconBg, border: `0.5px solid ${page.iconBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {page.icon}
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 600, color: "#111827", marginBottom: 6 }}>{page.title}</p>
                <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.5 }}>{page.desc}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 500, color: allowed ? page.accent : "#9CA3AF", marginTop: "auto" }}>
                {allowed ? "เข้าสู่หน้า" : "ไม่มีสิทธิ์เข้าถึง"}
                {allowed && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M3 7h8M7 3l4 4-4 4" stroke={page.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Role selector */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 36 }}>
        <p style={{ fontSize: 13, color: "#8C8985", fontWeight: 500 }}>Role : </p>
        <div style={{ display: "flex", gap: 8 }}>
          {ROLE_OPTIONS.map(r => (
            <button
              key={r.value}
              onClick={() => handleRoleChange(r.value)}
              style={{
                height: 34, padding: "0 16px", borderRadius: 999, fontSize: 13, fontWeight: 500,
                cursor: "pointer", fontFamily: "Inter, sans-serif", transition: "all 0.1s",
                background: role === r.value ? "#000000" : "#fff",
                color:      role === r.value ? "#fff"    : "#6B7280",
                border:     role === r.value ? "none"    : "0.5px solid #E5E7EB",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {!role && (
        <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 24 }}>กรุณาเลือก role ก่อนเข้าใช้งาน</p>
      )}
    </div>
  )
}