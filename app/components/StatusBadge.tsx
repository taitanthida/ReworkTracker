type Status = "ISSUED" | "IN_PROGRESS" | "RETURNED" | "CLOSED" | "OVERDUE";

const config: Record<Status, { label: string; className: string }> = {
  ISSUED: { label: "Issued", className: "bg-[#DCFCE7] text-[#166534]" },
  IN_PROGRESS: { label: "In Progress", className: "bg-[#DBEAFE] text-[#1E40AF]" },
  RETURNED: { label: "Returned", className: "bg-[#FEF3C7] text-[#92400E]" },
  CLOSED: { label: "Closed", className: "bg-[#F3F4F6] text-[#374151]" },
  OVERDUE: { label: "Overdue", className: "bg-[#FEE2E2] text-[#991B1B]" },
};

interface StatusBadgeProps {
  status: Status;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { label, className } = config[status];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium tracking-wide ${className}`}
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      {label}
    </span>
  );
}
