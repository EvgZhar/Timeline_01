import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownUp, Link2, Plus } from "lucide-react";
import { formatDisplay } from "@timeline/shared";
import { api } from "@/api/client";
import { TooltipButton } from "@/components/TooltipButton";
import type { EventDto } from "@timeline/shared";

interface EventGridProps {
  tagFilterIds: number[];
  tagFilterMode: "and" | "or";
  textSearchQuery: string;
  textSearchMode: "name" | "nameAndNotes";
  selectedEventId: number | null;
  onSelect: (eventId: number) => void;
  onCreateEvent: () => void;
}

export function EventGrid({
  tagFilterIds,
  tagFilterMode,
  textSearchQuery,
  textSearchMode,
  selectedEventId,
  onSelect,
  onCreateEvent,
}: EventGridProps) {
  const [depHovered, setDepHovered] = useState<number | null>(null);

  const { data: allEvents = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["events"],
    queryFn: () => api.events.list(),
  });

  const filteredEvents = useMemo(() => {
    let list = allEvents;
    if (tagFilterIds.length > 0) {
      list = list.filter((ev) => {
        const ids = ev.tags.map((t) => t.id);
        return tagFilterMode === "and"
          ? tagFilterIds.every((id) => ids.includes(id))
          : tagFilterIds.some((id) => ids.includes(id));
      });
    }
    if (textSearchQuery.trim()) {
      const q = textSearchQuery.toLowerCase();
      list = list.filter((ev) => {
        const nameMatch = ev.name.toLowerCase().includes(q);
        if (textSearchMode === "name") return nameMatch;
        return nameMatch || (ev.notes ?? "").toLowerCase().includes(q);
      });
    }
    return list;
  }, [allEvents, tagFilterIds, tagFilterMode, textSearchQuery, textSearchMode]);

  const [sortField, setSortField] = useState<"name" | "startDate" | "endDate">("startDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sortKey = (ev: EventDto, field: typeof sortField): string => {
    if (field === "name") return ev.name.toLowerCase();
    if (field === "endDate") return ev.endDate;
    return ev.startDate;
  };

  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      const cmp = sortKey(a, sortField).localeCompare(sortKey(b, sortField));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredEvents, sortField, sortDir]);

  const autoSelectedRef = useRef(false);

  useEffect(() => {
    if (sortedEvents.length === 0) {
      autoSelectedRef.current = false;
      return;
    }
    if (!autoSelectedRef.current) {
      autoSelectedRef.current = true;
      onSelect(sortedEvents[0].id);
      return;
    }
    if (selectedEventId && !sortedEvents.some((ev) => ev.id === selectedEventId)) {
      onSelect(sortedEvents[0].id);
    }
  }, [sortedEvents, selectedEventId, onSelect]);

  const [colWidths, setColWidths] = useState({ name: 0, date: 0, end: 0, deps: 0 });
  const resizingCol = useRef<"name" | "date" | "end" | "deps" | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  const handleColResizePointerDown = useCallback((col: "name" | "date" | "end" | "deps") => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    resizingCol.current = col;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const handleColResizePointerMove = useCallback((e: React.PointerEvent) => {
    const col = resizingCol.current;
    if (!col || !tableRef.current) return;
    const rect = tableRef.current.getBoundingClientRect();
    const relX = e.clientX - rect.left;
    const pct = (relX / rect.width) * 100;
    setColWidths((prev) => {
      let name = prev.name || 38;
      let date = prev.date || 16;
      let end = prev.end || 16;
      let deps = prev.deps || 0;
      if (col === "name") name = Math.max(20, Math.min(66, pct));
      else if (col === "date") date = Math.max(10, Math.min(46, pct - name));
      else if (col === "end") end = Math.max(10, Math.min(46, 100 - name - date));
      else if (col === "deps") deps = Math.max(0, Math.min(20, 100 - name - date - end));
      return { name, date, end, deps };
    });
  }, []);

  const handleColResizePointerUp = useCallback(() => {
    if (!resizingCol.current) return;
    resizingCol.current = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const toggleSort = (field: "name" | "startDate" | "endDate") => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        Загрузка…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-red-500">
        Ошибка загрузки
        <button onClick={() => refetch()} className="rounded border px-3 py-1 text-xs hover:bg-slate-100">
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <span className="text-xs font-medium text-slate-500">
          {sortedEvents.length} событий
        </span>
        <TooltipButton
          label="Добавить событие"
          onClick={onCreateEvent}
          className="rounded border p-1 text-slate-600 hover:bg-slate-100"
        >
          <Plus size={16} />
        </TooltipButton>
      </div>

      <div className="flex-1 overflow-y-auto">
        <table ref={tableRef} className="w-full table-fixed text-sm">
          <colgroup>
            <col style={{ width: `${colWidths.name || 38}%` }} />
            <col style={{ width: `${colWidths.date || 16}%` }} />
            <col style={{ width: `${colWidths.end || 16}%` }} />
            <col style={{ width: `${(colWidths.deps || 0) > 0 ? colWidths.deps : 10}%` }} />
          </colgroup>
          <thead className="sticky top-0 bg-slate-50">
            <tr className="border-b border-slate-200">
              <th
                className="relative cursor-pointer select-none px-2 py-2 text-left text-xs font-medium text-slate-500 hover:text-slate-700"
                onClick={() => toggleSort("name")}
              >
                <span className="inline-flex items-center gap-1">
                  Название
                  {sortField === "name" && (
                    <ArrowDownUp size={12} className={sortDir === "desc" ? "rotate-180" : ""} />
                  )}
                </span>
                <div
                  className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-blue-400 active:bg-blue-500 touch-none"
                  onPointerDown={handleColResizePointerDown("name")}
                  onPointerMove={handleColResizePointerMove}
                  onPointerUp={handleColResizePointerUp}
                />
              </th>
              <th
                className="relative cursor-pointer select-none px-2 py-2 text-left text-xs font-medium text-slate-500 hover:text-slate-700"
                onClick={() => toggleSort("startDate")}
              >
                <span className="inline-flex items-center gap-1">
                  Дата
                  {sortField === "startDate" && (
                    <ArrowDownUp size={12} className={sortDir === "desc" ? "rotate-180" : ""} />
                  )}
                </span>
                <div
                  className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-blue-400 active:bg-blue-500 touch-none"
                  onPointerDown={handleColResizePointerDown("date")}
                  onPointerMove={handleColResizePointerMove}
                  onPointerUp={handleColResizePointerUp}
                />
              </th>
              <th
                className="relative cursor-pointer select-none px-2 py-2 text-left text-xs font-medium text-slate-500 hover:text-slate-700"
                onClick={() => toggleSort("endDate")}
              >
                <span className="inline-flex items-center gap-1">
                  Конец
                  {sortField === "endDate" && (
                    <ArrowDownUp size={12} className={sortDir === "desc" ? "rotate-180" : ""} />
                  )}
                </span>
                <div
                  className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-blue-400 active:bg-blue-500 touch-none"
                  onPointerDown={handleColResizePointerDown("end")}
                  onPointerMove={handleColResizePointerMove}
                  onPointerUp={handleColResizePointerUp}
                />
              </th>
              <th
                className="relative select-none px-2 py-2 text-center text-xs font-medium text-slate-500"
              >
                <span className="inline-flex items-center gap-1">
                  <Link2 size={12} />
                </span>
                <div
                  className="absolute right-0 top-0 h-full w-2 cursor-col-resize hover:bg-blue-400 active:bg-blue-500 touch-none"
                  onPointerDown={handleColResizePointerDown("deps")}
                  onPointerMove={handleColResizePointerMove}
                  onPointerUp={handleColResizePointerUp}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedEvents.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-xs text-slate-400">
                  {tagFilterIds.length > 0 || textSearchQuery.trim()
                    ? "Нет событий, соответствующих фильтрам"
                    : "Нет событий"}
                </td>
              </tr>
            )}
            {sortedEvents.map((ev) => {
              const isSelected = ev.id === selectedEventId;
              const isDepHighlighted = depHovered !== null && ev.id !== depHovered &&
                (ev.dependencies?.some((d) => d.depEventId === depHovered) ?? false);
              return (
                <tr
                  key={ev.id}
                  className={`cursor-pointer border-b border-slate-100 hover:bg-blue-50/50 ${
                    isSelected ? "bg-blue-50" : ""
                  } ${isDepHighlighted ? "bg-amber-50" : ""}`}
                  onClick={() => onSelect(ev.id)}
                >
                  <td className="px-2 py-1.5">
                    <span className="block truncate">{ev.name}</span>
                  </td>
                  <td className="truncate px-2 py-1.5 text-slate-600">
                    <span className="block truncate">{formatDisplay(ev.startDate)}</span>
                  </td>
                  <td className="truncate px-2 py-1.5 text-slate-600">
                    <span className="block truncate">{ev.endDate !== ev.startDate ? formatDisplay(ev.endDate) : "—"}</span>
                  </td>
                  <td
                    className="px-2 py-1.5 text-center text-xs text-slate-400"
                    onMouseEnter={() => setDepHovered(ev.id)}
                    onMouseLeave={() => setDepHovered(null)}
                    onPointerDown={(e) => {
                      if (e.pointerType === "touch") {
                        setDepHovered(prev => prev === ev.id ? null : ev.id);
                      }
                    }}
                  >
                    {(ev.dependencies?.length ?? 0) > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-slate-500">
                        <Link2 size={10} />
                        {ev.dependencies.length}
                      </span>
                    ) : (
                      <span className="text-slate-200">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
