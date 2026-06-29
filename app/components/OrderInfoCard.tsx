interface Field {
  label: string;
  value: string;
}

interface OrderInfoCardProps {
  fields: Field[];
}

export function OrderInfoCard({ fields }: OrderInfoCardProps) {
  return (
    <div
      className="bg-[#F9FAFB] p-4 grid grid-cols-2 gap-x-6 gap-y-3"
      style={{ border: "0.5px solid #E5E7EB", borderRadius: "8px", fontFamily: "Inter, sans-serif" }}
    >
      {fields.map((f) => (
        <div key={f.label} className="flex flex-col gap-0.5">
          <span className="text-xs text-[#9CA3AF]">{f.label}</span>
          <span className="text-sm text-[#111827]">{f.value}</span>
        </div>
      ))}
    </div>
  );
}
