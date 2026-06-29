import { InputHTMLAttributes } from "react";

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function TextInput({ label, id, ...props }: TextInputProps) {
  return (
    <div className="flex flex-col gap-1" style={{ fontFamily: "Inter, sans-serif" }}>
      {label && (
        <label htmlFor={id} className="text-xs text-[#374151]">
          {label}
        </label>
      )}
      <input
        id={id}
        {...props}
        className="h-[36px] w-full px-3 text-sm text-[#111827] bg-white placeholder:text-[#9CA3AF] outline-none transition-colors focus:ring-2 focus:ring-[#C792EA] focus:ring-offset-0"
        style={{
          border: "0.5px solid #D1D5DB",
          borderRadius: "8px",
        }}
      />
    </div>
  );
}
