import type { ReactNode } from "react";

interface SidePanelProps {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function SidePanel({ title, children, footer }: SidePanelProps) {
  return (
    <aside className="flex h-full flex-col bg-white">
      <div className="flex items-center border-b border-slate-200 px-4 py-3">
        <h2 className="truncate text-lg font-semibold">{title}</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
      {footer && (
        <div className="border-t border-slate-200 px-4 py-3">{footer}</div>
      )}
    </aside>
  );
}
