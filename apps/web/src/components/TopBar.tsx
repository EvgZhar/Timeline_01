interface TopBarProps {
  onTimelines: () => void;
  onAddEvent: () => void;
  onSettings: () => void;
}

export function TopBar({ onTimelines, onAddEvent, onSettings }: TopBarProps) {
  return (
    <header className="flex h-[10vh] min-h-[56px] items-center gap-3 border-b border-slate-200 bg-slate-50 px-4">
      <h1 className="mr-auto text-lg font-semibold text-slate-800">История в таймлайне</h1>
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
