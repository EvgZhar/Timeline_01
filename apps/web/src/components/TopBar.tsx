import { Search } from "lucide-react";

interface TopBarProps {
  onTimelines: () => void;
  onAddEvent: () => void;
  onSettings: () => void;
  onSearch: () => void;
  filterCount?: number;
}

export function TopBar({ onTimelines, onAddEvent, onSettings, onSearch, filterCount = 0 }: TopBarProps) {
  return (
    <header className="flex h-[10vh] min-h-[56px] items-center gap-3 border-b border-slate-200 bg-slate-50 px-4">
      <h1 className="mr-auto text-lg font-semibold text-slate-800">История в таймлайне</h1>
      <button
        type="button"
        onClick={onSearch}
        className="relative rounded-md border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-100"
        title="Поиск по тэгам"
      >
        <Search size={20} />
        {filterCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
            {filterCount}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={onTimelines}
        className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-100"
      >
        Временные шкалы
      </button>
      <button
        type="button"
        onClick={onAddEvent}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
      >
        Добавить событие
      </button>
      <button
        type="button"
        onClick={onSettings}
        className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm hover:bg-slate-100"
      >
        Настройки
      </button>
    </header>
  );
}
