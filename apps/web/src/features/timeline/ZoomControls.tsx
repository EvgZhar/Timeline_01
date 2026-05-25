import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { useState } from "react";

interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onScrollBack: () => void;
  onScrollForward: () => void;
}

const btn =
  "flex items-center justify-center w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm text-slate-600 hover:bg-slate-50 hover:shadow-md cursor-pointer select-none transition-all duration-200 ease-out";

export function ZoomControls({ onZoomIn, onZoomOut, onScrollBack, onScrollForward }: ZoomControlsProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="absolute bottom-6 right-6 grid grid-cols-3 gap-[2.94px]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div />
      <button
        type="button"
        className={btn}
        onClick={onZoomIn}
        title="Приблизить"
        style={{
          transform: hovered ? "scale(1.05)" : "scale(1)",
        }}
      >
        <ZoomIn size={18} />
      </button>
      <div />
      <button
        type="button"
        className={btn}
        onClick={onScrollBack}
        title="Назад"
        style={{
          transform: hovered ? "scale(1.05)" : "scale(1)",
        }}
      >
        <ChevronLeft size={18} />
      </button>
      <div />
      <button
        type="button"
        className={btn}
        onClick={onScrollForward}
        title="Вперёд"
        style={{
          transform: hovered ? "scale(1.05)" : "scale(1)",
        }}
      >
        <ChevronRight size={18} />
      </button>
      <div />
      <button
        type="button"
        className={btn}
        onClick={onZoomOut}
        title="Отдалить"
        style={{
          transform: hovered ? "scale(1.05)" : "scale(1)",
        }}
      >
        <ZoomOut size={18} />
      </button>
      <div />
    </div>
  );
}
