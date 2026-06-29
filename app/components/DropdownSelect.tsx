import { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";

interface DropdownSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
}

export function DropdownSelect({ label, id, options, ...props }: DropdownSelectProps) {
  return (
    <div className="flex flex-col gap-1" style={{ fontFamily: "Inter, sans-serif" }}>
      {label && (
        <label htmlFor={id} className="text-xs text-[#374151]">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={id}
          {...props}
          className="h-[36px] w-full px-3 pr-8 text-sm text-[#111827] bg-white appearance-none outline-none transition-colors focus:ring-2 focus:ring-[#C792EA] focus:ring-offset-0"
          style={{
            border: "0.5px solid #D1D5DB",
            borderRadius: "8px",
          }}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none"
        />
      </div>
    </div>
  );
}
