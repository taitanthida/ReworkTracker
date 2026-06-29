interface MetricCardProps {
  label: string;
  value: string | number;
  accent?: string;
}

export function MetricCard({ label, value, accent }: MetricCardProps) {
  return (
    <div
      className="bg-white rounded-lg p-4 flex flex-col gap-1"
      style={{
        border: "0.5px solid #E5E7EB",
        borderRadius: "8px",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <span className="text-xs text-[#6B7280] uppercase tracking-wider">{label}</span>
      <span
        className="text-3xl font-semibold leading-tight"
        style={{ color: accent ?? "#111827" }}
      >
        {value}
      </span>
    </div>
  );
}
