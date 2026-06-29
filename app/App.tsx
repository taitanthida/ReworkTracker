import { useState } from "react";
import { CreateReworkLabel } from "./components/screens/CreateReworkLabel";
import { ReworkStation }      from "./components/screens/ReworkStation";
import { ReworkDashboard }    from "./components/screens/ReworkDashboard";

type Screen = "qc" | "rw" | "dash";

const SCREENS: { key: Screen; label: string; sub: string }[] = [
  { key: "qc",   label: "Screen 1",  sub: "QC · Create Rework Label" },
  { key: "rw",   label: "Screen 2",  sub: "RW Center · Rework Station" },
  { key: "dash", label: "Screen 3",  sub: "Supervisor · Dashboard" },
];

export default function App() {
  const [screen, setScreen] = useState<Screen>("qc");

  return (
    <div style={{ minHeight: "100vh", background: "#E9EBF0", fontFamily: "Inter, sans-serif" }}>

      {/* Screen switcher */}
      <div style={{ background: "#fff", borderBottom: "0.5px solid #E5E7EB", display: "flex", alignItems: "center", gap: 0, padding: "0 24px", position: "sticky", top: 0, zIndex: 50 }}>
        {SCREENS.map(s => (
          <button
            key={s.key}
            onClick={() => setScreen(s.key)}
            style={{
              fontFamily: "Inter, sans-serif",
              background: "none",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
              borderBottom: screen === s.key ? "2px solid #7C3AED" : "2px solid transparent",
              padding: "14px 18px",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              gap: 1,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 700, color: screen === s.key ? "#7C3AED" : "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</span>
            <span style={{ fontSize: 12, color: screen === s.key ? "#111827" : "#6B7280" }}>{s.sub}</span>
          </button>
        ))}
      </div>

      {/* Screen viewport */}
      <div style={{ width: "100%" }}>
        {screen === "qc"   && <CreateReworkLabel />}
        {screen === "rw"   && <ReworkStation />}
        {screen === "dash" && <ReworkDashboard />}
      </div>

    </div>
  );
}
