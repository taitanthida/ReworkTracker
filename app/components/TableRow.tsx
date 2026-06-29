import { StatusBadge } from "./StatusBadge";

type Status = "ISSUED" | "IN_PROGRESS" | "RETURNED" | "CLOSED" | "OVERDUE";

interface TableRowProps {
  orderId: string;
  part: string;
  assignee: string;
  status: Status;
  date: string;
  onClick?: () => void;
}

export function TableRow({ orderId, part, assignee, status, date, onClick }: TableRowProps) {
  return (
    <tr
      onClick={onClick}
      className="cursor-pointer transition-colors hover:bg-[#F0FAF6] active:bg-[#E0F5ED]"
      style={{ borderBottom: "0.5px solid #E5E7EB", fontFamily: "Inter, sans-serif" }}
    >
      <td className="py-3 px-4 text-sm text-[#111827]">{orderId}</td>
      <td className="py-3 px-4 text-sm text-[#374151]">{part}</td>
      <td className="py-3 px-4 text-sm text-[#374151]">{assignee}</td>
      <td className="py-3 px-4">
        <StatusBadge status={status} />
      </td>
      <td className="py-3 px-4 text-sm text-[#6B7280]">{date}</td>
    </tr>
  );
}

export function TableHeader() {
  const cols = ["Order ID", "Part", "Assignee", "Status", "Date"];
  return (
    <thead>
      <tr style={{ borderBottom: "0.5px solid #E5E7EB", fontFamily: "Inter, sans-serif" }}>
        {cols.map((c) => (
          <th
            key={c}
            className="py-2.5 px-4 text-left text-xs text-[#9CA3AF] uppercase tracking-wider"
          >
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
}
