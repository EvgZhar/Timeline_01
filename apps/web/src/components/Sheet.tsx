import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: "left" | "right";
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function Sheet({
  open,
  onOpenChange,
  side = "left",
    title,
  children,
  footer,
}: SheetProps) {
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
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <aside
        className={cn(
          "fixed top-0 z-50 flex h-full w-[380px] max-w-[90vw] flex-col bg-white shadow-xl",
          side === "left" ? "left-0" : "right-0",
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer && (
          <div className="border-t border-slate-200 px-4 py-3">{footer}</div>
        )}
      </aside>
    </>
  );
}
