import { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

interface AppBarProps {
  title: string;
  onBack?: () => void;
  actionIcon?: ReactNode;
  onAction?: () => void;
}

export function AppBar({ title, onBack, actionIcon, onAction }: AppBarProps) {
  return (
    <header
      className="h-14 bg-white flex items-center px-4 relative"
      style={{ borderBottom: "0.5px solid #E5E7EB", fontFamily: "Inter, sans-serif" }}
    >
      <button
        onClick={onBack}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-[#374151] hover:bg-[#F3F4F6] transition-colors"
        aria-label="Back"
      >
        <ArrowLeft size={18} />
      </button>

      <span className="absolute left-1/2 -translate-x-1/2 text-sm font-medium text-[#111827]">
        {title}
      </span>

      {actionIcon && (
        <button
          onClick={onAction}
          className="ml-auto w-8 h-8 flex items-center justify-center rounded-lg text-[#374151] hover:bg-[#F3F4F6] transition-colors"
          aria-label="Action"
        >
          {actionIcon}
        </button>
      )}
    </header>
  );
}
