import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "disabled";
  fullWidth?: boolean;
}

export function Button({ variant = "primary", fullWidth = true, children, disabled, ...props }: ButtonProps) {
  const base = "inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C792EA] focus-visible:ring-offset-1";
  const width = fullWidth ? "w-full" : "";
  const height = "h-[44px] px-4";

  const variants = {
    primary: "bg-[#C792EA] text-white hover:bg-[#B87EDE] active:bg-[#A86AD2]",
    secondary: "bg-white text-[#C792EA] hover:bg-[#FAF5FF] active:bg-[#F3EAFD]",
    disabled: "bg-[#F3F4F6] text-[#9CA3AF] cursor-not-allowed",
  };

  const borders = {
    primary: "border-none",
    secondary: "border border-[#C792EA]",
    disabled: "border border-[#E5E7EB]",
  };

  const isDisabled = variant === "disabled" || disabled;

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={`${base} ${width} ${height} ${variants[variant]} ${borders[variant]}`}
      style={{ fontFamily: "Inter, sans-serif", borderRadius: "8px" }}
    >
      {children}
    </button>
  );
}
