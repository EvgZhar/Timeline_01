import { useState } from "react";
import { CalendarPlus, FileDown, Layers, LayoutList, Loader2, Rows3, Search, Settings } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { api } from "@/api/client";
import { TooltipButton } from "@/components/TooltipButton";
import { cn } from "@/lib/utils";

interface TopBarProps {
  onTimelines: () => void;
  onAddEvent: () => void;
  onSettings: () => void;
  onSearch: () => void;
  onProfile: () => void;
  onExport: () => void;
  onExportPdf?: () => void;
  filterCount?: number;
  viewMode: "timeline" | "grid";
  onViewModeChange: (mode: "timeline" | "grid") => void;
}

export function TopBar({ onTimelines, onAddEvent, onSettings, onSearch, onProfile, onExport, onExportPdf, filterCount = 0, viewMode, onViewModeChange }: TopBarProps) {
  const { user, settings, currentDataAreaId, setCurrentDataAreaId } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await onExport();
    } catch (err) {
      alert("Ошибка экспорта: " + (err instanceof Error ? err.message : "Неизвестная ошибка"));
    } finally {
      setExporting(false);
    }
  };

  const handleExportPdf = async () => {
    if (!onExportPdf) return;
    setPdfExporting(true);
    try {
      await onExportPdf();
    } catch (err) {
      alert("Ошибка экспорта PDF: " + (err instanceof Error ? err.message : "Неизвестная ошибка"));
    } finally {
      setPdfExporting(false);
    }
  };

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

      <div className="flex overflow-hidden rounded-md border border-slate-300 bg-white">
        <button
          type="button"
          onClick={() => onViewModeChange("timeline")}
          className={cn("p-2", viewMode === "timeline" ? "bg-blue-100 text-blue-700" : "text-slate-500 hover:bg-slate-100")}
          title="Таймлайн"
        >
          <Rows3 size={20} />
        </button>
        <button
          type="button"
          onClick={() => onViewModeChange("grid")}
          className={cn("p-2", viewMode === "grid" ? "bg-blue-100 text-blue-700" : "text-slate-500 hover:bg-slate-100")}
          title="Таблица"
        >
          <LayoutList size={20} />
        </button>
      </div>

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
        label={exporting ? "Экспорт..." : "Экспорт в Excel"}
        onClick={handleExport}
        disabled={exporting}
        className="rounded-md border border-slate-300 bg-white p-2 text-green-700 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {exporting ? <Loader2 className="animate-spin" size={20} /> : <FileDown size={20} />}
      </TooltipButton>
      <TooltipButton
        label={pdfExporting ? "Экспорт PDF..." : "Экспорт в PDF"}
        onClick={handleExportPdf}
        disabled={pdfExporting || !onExportPdf}
        className="rounded-md border border-slate-300 bg-white p-2 text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pdfExporting ? <Loader2 className="animate-spin" size={20} /> : <FileDown size={20} />}
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
