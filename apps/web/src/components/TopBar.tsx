import { CalendarPlus, Layers, Search, Settings } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { api } from "@/api/client";
import { TooltipButton } from "@/components/TooltipButton";

interface TopBarProps {
  onTimelines: () => void;
  onAddEvent: () => void;
  onSettings: () => void;
  onSearch: () => void;
  onProfile: () => void;
  filterCount?: number;
}

export function TopBar({ onTimelines, onAddEvent, onSettings, onSearch, onProfile, filterCount = 0 }: TopBarProps) {
  const { user, settings, currentDataAreaId, setCurrentDataAreaId } = useAuth();

  const handleAreaChange = async (areaId: number) => {
    try {
      await api.auth.putSettings({ currentDataAreaId: areaId });
      setCurrentDataAreaId(areaId);
    } catch { /* ignore */ }
  };

  const initials = user
    ? ((user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? "")).toUpperCase() || user.login[0].toUpperCase()
    : "?";

  return (
    <header className="flex h-[10vh] min-h-[56px] items-center gap-3 border-b border-slate-200 bg-slate-50 px-4">
      <h1 className="mr-auto text-lg font-semibold text-slate-800">История в таймлайне</h1>

      {settings && settings.availableAreas.length > 0 && (
        <select
          value={currentDataAreaId ?? ""}
          onChange={(e) => handleAreaChange(Number(e.target.value))}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
        >
          {settings.availableAreas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
      )}

      <button
        type="button"
        onClick={onSearch}
        className="relative rounded-md border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-100"
        title="Поиск по тэгам и названиям"
      >
        <Search size={20} />
        {filterCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white leading-none">
            {filterCount}
          </span>
        )}
      </button>
      <TooltipButton
        label="Временные шкалы"
        onClick={onTimelines}
        className="rounded-md border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-100"
      >
        <Layers size={20} />
      </TooltipButton>
      <TooltipButton
        label="Добавить событие"
        onClick={onAddEvent}
        className="rounded-md bg-blue-600 p-2 text-white hover:bg-blue-700"
      >
        <CalendarPlus size={20} />
      </TooltipButton>
      <TooltipButton
        label="Настройки"
        onClick={onSettings}
        className="rounded-md border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-100"
      >
        <Settings size={20} />
      </TooltipButton>

      <TooltipButton
        label="Личный кабинет"
        onClick={onProfile}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white hover:bg-blue-700"
      >
        {initials}
      </TooltipButton>
    </header>
  );
}
