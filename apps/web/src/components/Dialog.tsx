import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { TooltipButton } from "@/components/TooltipButton";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function Dialog({ open, onOpenChange, title, children, footer, className }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/40"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <div
        className={`relative z-10 mx-4 w-full max-w-lg rounded-lg bg-white shadow-xl ${className ?? ""}`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <TooltipButton
            label="Закрыть"
            onClick={() => onOpenChange(false)}
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
          >
            <X size={16} />
          </TooltipButton>
        </div>
        <div className="overflow-y-auto p-4">{children}</div>
        {footer && (
          <div className="border-t border-slate-200 px-4 py-3">{footer}</div>
        )}
      </div>
    </div>
  );
}
