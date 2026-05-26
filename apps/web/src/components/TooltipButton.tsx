import type { ReactNode } from "react";

interface TooltipButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

export function TooltipButton({
  label,
  onClick,
  disabled,
  className,
  children,
}: TooltipButtonProps) {
  return (
    <div className="group/tooltip relative flex items-center">
      <button
        type="button"
        disabled={disabled}
        className={className}
        onClick={onClick}
      >
        {children}
      </button>
      <span className="pointer-events-none absolute -top-7 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded bg-slate-800 px-2 py-0.5 text-[10px] text-white opacity-0 shadow transition-opacity group-hover/tooltip:opacity-100">
        {label}
        <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
      </span>
    </div>
  );
}
