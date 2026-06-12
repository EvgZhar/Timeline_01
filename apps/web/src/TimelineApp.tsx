import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { TopBar } from "./components/TopBar";
import { EventSheet } from "./features/events/EventSheet";
import { EventGrid, EventDetailPanel, AttachmentsPanel } from "./features/eventGrid";
import { SettingsSheet } from "./features/settings/SettingsSheet";
import { ProfileSheet } from "./features/profile/ProfileSheet";
import { TimelinesSheet } from "./features/timelines/TimelinesSheet";
import { TimelineCanvas } from "./features/timeline/TimelineCanvas";
import { TagSearch } from "./features/tags/TagSearch";
import { FilterBar } from "./features/tags/FilterBar";
import { useAuth } from "./auth/AuthContext";
import type { EventDto, TimelineDto } from "@timeline/shared";
import type { ViewRange } from "./features/timeline/timeScale";

export function TimelineApp() {
  const qc = useQueryClient();
  const { setSettings } = useAuth();
  const [timelinesOpen, setTimelinesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [eventSheet, setEventSheet] = useState<
    | { mode: "create"; initialDate?: string; initialTimelineId?: number }
    | { mode: "edit"; id: number }
    | null
  >(null);
  const [tagFilterIds, setTagFilterIds] = useState<number[]>([]);
  const [tagFilterMode, setTagFilterMode] = useState<"and" | "or">("or");
  const [textSearchQuery, setTextSearchQuery] = useState("");
  const [textSearchMode, setTextSearchMode] = useState<"name" | "nameAndNotes">("name");
  const [viewRange, setViewRange] = useState<ViewRange | null>(null);
  const [showTagsOnTimeline, setShowTagsOnTimeline] = useState(false);
  const [highlightDependencies, setHighlightDependencies] = useState(true);
  const [viewMode, setViewMode] = useState<"timeline" | "grid">("timeline");
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [gridWidth, setGridWidth] = useState(30);
  const [docColWidth, setDocColWidth] = useState(288);

  const initializedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  // Second divider refs
  const isDragging2Ref = useRef(false);
  const startX2Ref = useRef(0);
  const startWidth2Ref = useRef(0);

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const handleDocDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging2Ref.current = true;
    startX2Ref.current = e.clientX;
    startWidth2Ref.current = docColWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, [docColWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setGridWidth(Math.min(Math.max(pct, 15), 60));
    };
    const handleMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging2Ref.current) return;
      const dx = e.clientX - startX2Ref.current;
      const newWidth = startWidth2Ref.current - dx;
      setDocColWidth(Math.min(Math.max(newWidth, 200), 500));
    };
    const handleMouseUp = () => {
      if (!isDragging2Ref.current) return;
      isDragging2Ref.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: api.settings.get,
    staleTime: 60000,
  });

  const { data: timelines = [] } = useQuery({
    queryKey: ["timelines"],
    queryFn: api.timelines.list,
  });
  const visibleTimelineIds = timelines.filter((t) => t.visible).map((t) => t.id);

  // Load auth settings on mount
  useEffect(() => {
    api.auth.getSettings()
      .then((s) => setSettings(s))
      .catch(() => {});
  }, [setSettings]);

  // Load saved settings once on first load
  useEffect(() => {
    if (!settings || initializedRef.current) return;
    initializedRef.current = true;

    const rawFilters = settings.settings["ui.tagFilters"];
    if (typeof rawFilters === "string") {
      try {
        const parsed = JSON.parse(rawFilters);
        if (Array.isArray(parsed.tagFilterIds)) setTagFilterIds(parsed.tagFilterIds);
        if (parsed.tagFilterMode === "and" || parsed.tagFilterMode === "or")
          setTagFilterMode(parsed.tagFilterMode);
      } catch { /* ignore */ }
    }

    const rawRange = settings.settings["ui.viewRange"];
    if (typeof rawRange === "string") {
      try {
        const parsed = JSON.parse(rawRange);
        if (typeof parsed.startMs === "number" && typeof parsed.endMs === "number")
          setViewRange(parsed as ViewRange);
      } catch { /* ignore */ }
    }

    const rawLastEvent = settings.settings["ui.lastEditedEventId"];
    if (typeof rawLastEvent === "string") {
      try {
        const id = JSON.parse(rawLastEvent);
        if (typeof id === "number" && id > 0) {
          setEventSheet({ mode: "edit", id });
        }
      } catch { /* ignore */ }
    }

    const rawTextSearch = settings.settings["ui.textSearch"];
    if (typeof rawTextSearch === "string") {
      try {
        const parsed = JSON.parse(rawTextSearch);
        if (typeof parsed.query === "string") setTextSearchQuery(parsed.query);
        if (parsed.mode === "name" || parsed.mode === "nameAndNotes") setTextSearchMode(parsed.mode);
      } catch {}
    }

    const rawShowTags = settings.settings["ui.showTagsOnTimeline"];
    if (rawShowTags === "true") setShowTagsOnTimeline(true);
    const rawHighlightDeps = settings.settings["ui.highlightDependencies"];
    if (rawHighlightDeps === "false") setHighlightDependencies(false);

    const rawViewMode = settings.settings["ui.viewMode"];
    if (rawViewMode === "grid") setViewMode("grid");

    const rawGridWidth = settings.settings["ui.gridWidth"];
    if (typeof rawGridWidth === "string") {
      const w = Number(rawGridWidth);
      if (w >= 15 && w <= 60) setGridWidth(w);
    }
  }, [settings]);

  // Save tag filters on change (after initial load)
  useEffect(() => {
    if (!initializedRef.current) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      api.settings.put({
        "ui.tagFilters": JSON.stringify({ tagFilterIds, tagFilterMode }),
      }).then(() => qc.invalidateQueries({ queryKey: ["settings"] }));
    }, 300);
    return () => clearTimeout(saveTimerRef.current);
  }, [tagFilterIds, tagFilterMode, qc]);

  // Save text search on change (debounced)
  useEffect(() => {
    if (!initializedRef.current) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      api.settings.put({
        "ui.textSearch": JSON.stringify({ query: textSearchQuery, mode: textSearchMode }),
      }).then(() => qc.invalidateQueries({ queryKey: ["settings"] }));
    }, 300);
    return () => clearTimeout(saveTimerRef.current);
  }, [textSearchQuery, textSearchMode, qc]);

  // Save last edited event ID
  useEffect(() => {
    if (!initializedRef.current) return;
    const val = eventSheet?.mode === "edit" ? JSON.stringify(eventSheet.id) : null;
    api.settings.put({ "ui.lastEditedEventId": val });
  }, [eventSheet]);

  // Save view mode
  useEffect(() => {
    if (!initializedRef.current) return;
    api.settings.put({ "ui.viewMode": viewMode });
  }, [viewMode]);

  // Save grid width
  useEffect(() => {
    if (!initializedRef.current) return;
    api.settings.put({ "ui.gridWidth": String(gridWidth) });
  }, [gridWidth]);

  // Save view range on change (debounced)
  const handleRangeChange = useCallback((range: ViewRange) => {
    setViewRange(range);
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      api.settings.put({
        "ui.viewRange": JSON.stringify(range),
      }).then(() => qc.invalidateQueries({ queryKey: ["settings"] }));
    }, 500);
  }, [qc]);

  // Save showTagsOnTimeline (debounced)
  useEffect(() => {
    if (!initializedRef.current) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      api.settings.put({
        "ui.showTagsOnTimeline": showTagsOnTimeline ? "true" : "false",
      }).then(() => qc.invalidateQueries({ queryKey: ["settings"] }));
    }, 300);
    return () => clearTimeout(saveTimerRef.current);
  }, [showTagsOnTimeline, qc]);

  // Save highlightDependencies
  useEffect(() => {
    if (!initializedRef.current) return;
    api.settings.put({
      "ui.highlightDependencies": highlightDependencies ? "true" : "false",
    });
  }, [highlightDependencies]);

  const handleExportPdf = useCallback(async () => {
    const events = qc.getQueryData<EventDto[]>(["events"]) ?? [];
    const tls = qc.getQueryData<TimelineDto[]>(["timelines"]) ?? [];
    const visibleIds = tls.filter((t) => t.visible).map((t) => t.id);
    let timelineSvg: string | undefined;
    const container = document.querySelector<HTMLElement>('[data-pdf-export="timeline-canvas"]');
    const svgEl = container?.querySelector("svg");
    if (svgEl) {
      const clone = svgEl.cloneNode(true) as SVGSVGElement;
      clone.querySelectorAll("foreignObject").forEach((fo) => fo.remove());
      timelineSvg = new XMLSerializer().serializeToString(clone);
    }
    await api.pdfExport.exportPdf(events, tls, visibleIds, timelineSvg);
  }, [qc]);

  // Clear all saved UI settings
  const handleClearSettings = useCallback(() => {
    setViewRange(null);
    setTagFilterIds([]);
    setTagFilterMode("or");
    setTextSearchQuery("");
    setTextSearchMode("name");
    setShowTagsOnTimeline(false);
    setHighlightDependencies(true);
    setViewMode("timeline");
    setGridWidth(30);
    api.settings.put({
      "ui.viewRange": null,
      "ui.tagFilters": null,
      "ui.textSearch": null,
      "ui.showTagsOnTimeline": null,
      "ui.highlightDependencies": null,
      "ui.viewMode": null,
      "ui.gridWidth": null,
    }).then(() => qc.invalidateQueries({ queryKey: ["settings"] }));
  }, [qc]);

  const handleRemoveTag = (tagId: number) => {
    setTagFilterIds((prev) => prev.filter((id) => id !== tagId));
  };

  return (
    <div className="flex h-screen min-w-[1024px] flex-col">
      <TopBar
        onTimelines={() => setTimelinesOpen(true)}
        onAddEvent={() => setEventSheet({ mode: "create" })}
        onSettings={() => setSettingsOpen(true)}
        onSearch={() => setSearchOpen(true)}
        onProfile={() => setProfileOpen(true)}
        onExportPdf={handleExportPdf}
        onExport={() => api.importExport.exportXlsx({
          tagFilterIds: tagFilterIds.length > 0 ? tagFilterIds : undefined,
          tagFilterMode: tagFilterIds.length > 0 ? tagFilterMode : undefined,
          textSearchQuery: textSearchQuery || undefined,
          textSearchMode: textSearchQuery ? textSearchMode : undefined,
        })}
        filterCount={tagFilterIds.length + (textSearchQuery ? 1 : 0)}
        viewMode={viewMode}
        onViewModeChange={(mode) => { setViewMode(mode); if (mode !== "grid") setSelectedEventId(null); }}
      />
      <FilterBar
        tagFilterIds={tagFilterIds}
        tagFilterMode={tagFilterMode}
        textSearchQuery={textSearchQuery}
        onRemoveTag={handleRemoveTag}
        onRemoveTextSearch={() => setTextSearchQuery("")}
        onReset={() => {
          setTagFilterIds([]);
          setTagFilterMode("or");
          setTextSearchQuery("");
          setTextSearchMode("name");
        }}
        onSearch={() => setSearchOpen(true)}
      />
      {viewMode === "timeline" ? (
        <main className="flex-1 overflow-hidden border border-slate-200 bg-white pb-[10px]">
          <TimelineCanvas
            tagFilterIds={tagFilterIds}
            tagFilterMode={tagFilterMode}
            textSearchQuery={textSearchQuery}
            textSearchMode={textSearchMode}
            onEventClick={(id) => setEventSheet({ mode: "edit", id })}
            onEmptyClick={(date, timelineId) =>
              setEventSheet({ mode: "create", initialDate: date, initialTimelineId: timelineId })
            }
            initialRange={viewRange}
            onRangeChange={handleRangeChange}
            highlightDependencies={highlightDependencies}
          />
        </main>
      ) : (
        <div ref={containerRef} className="flex flex-1 overflow-hidden border border-slate-200 bg-white">
          <div style={{ width: `${gridWidth}%` }} className="shrink-0 overflow-hidden border-r border-slate-200">
            <EventGrid
              tagFilterIds={tagFilterIds}
              tagFilterMode={tagFilterMode}
              textSearchQuery={textSearchQuery}
              textSearchMode={textSearchMode}
              selectedEventId={selectedEventId}
              onSelect={setSelectedEventId}
              onCreateEvent={() => setEventSheet({ mode: "create" })}
            />
          </div>
          <div
            className="w-1.5 shrink-0 cursor-col-resize bg-slate-200 transition-colors hover:bg-blue-400 active:bg-blue-500"
            onMouseDown={handleDividerMouseDown}
          />
          <div className="flex min-w-0 flex-1 overflow-hidden">
            {selectedEventId ? (
              <EventDetailPanel
                key={selectedEventId}
                eventId={selectedEventId}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
                Выберите событие из таблицы
              </div>
            )}
          </div>
          <div
            className="w-1.5 shrink-0 cursor-col-resize bg-slate-200 transition-colors hover:bg-blue-400 active:bg-blue-500"
            onMouseDown={handleDocDividerMouseDown}
          />
          <div style={{ width: docColWidth }} className="shrink-0 overflow-hidden border-l border-slate-200">
            {selectedEventId ? (
              <AttachmentsPanel key={selectedEventId} eventId={selectedEventId} />
            ) : null}
          </div>
        </div>
      )}

      <TimelinesSheet open={timelinesOpen} onOpenChange={setTimelinesOpen} />
      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        savedViewRange={viewRange}
        savedTagFilterIds={tagFilterIds}
        savedTagFilterMode={tagFilterMode}
        textSearchQuery={textSearchQuery}
        textSearchMode={textSearchMode}
        showTagsOnTimeline={showTagsOnTimeline}
        onShowTagsOnTimelineChange={setShowTagsOnTimeline}
        highlightDependencies={highlightDependencies}
        onHighlightDependenciesChange={setHighlightDependencies}
        onClearSettings={handleClearSettings}
      />
      <ProfileSheet open={profileOpen} onOpenChange={setProfileOpen} />
      <TagSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        selectedTagIds={tagFilterIds}
        mode={tagFilterMode}
        textSearchQuery={textSearchQuery}
        textSearchMode={textSearchMode}
        onApply={(ids, m, tq, tm) => {
          setTagFilterIds(ids);
          setTagFilterMode(m);
          setTextSearchQuery(tq);
          setTextSearchMode(tm);
        }}
        onReset={() => {
          setTagFilterIds([]);
          setTagFilterMode("or");
          setTextSearchQuery("");
          setTextSearchMode("name");
        }}
      />
      {eventSheet && (
        <EventSheet
          mode={eventSheet.mode}
          eventId={eventSheet.mode === "edit" ? eventSheet.id : undefined}
          initialDate={eventSheet.mode === "create" ? eventSheet.initialDate : undefined}
          initialTimelineId={eventSheet.mode === "create" ? eventSheet.initialTimelineId : undefined}
          onClose={() => setEventSheet(null)}
          filterState={{ tagFilterIds, tagFilterMode, textSearchQuery, textSearchMode, viewRange, visibleTimelineIds }}
        />
      )}
    </div>
  );
}
