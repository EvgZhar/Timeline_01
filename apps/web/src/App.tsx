import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { TopBar } from "./components/TopBar";
import { EventSheet } from "./features/events/EventSheet";
import { SettingsSheet } from "./features/settings/SettingsSheet";
import { TimelinesSheet } from "./features/timelines/TimelinesSheet";
import { TimelineCanvas } from "./features/timeline/TimelineCanvas";
import { TagSearch } from "./features/tags/TagSearch";
import { FilterBar } from "./features/tags/FilterBar";
import type { ViewRange } from "./features/timeline/timeScale";

export default function App() {
  const qc = useQueryClient();
  const [timelinesOpen, setTimelinesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [eventSheet, setEventSheet] = useState<
    | { mode: "create"; initialDate?: string; initialTimelineId?: number }
    | { mode: "edit"; id: number }
    | null
  >(null);
  const [tagFilterIds, setTagFilterIds] = useState<number[]>([]);
  const [tagFilterMode, setTagFilterMode] = useState<"and" | "or">("or");
  const [viewRange, setViewRange] = useState<ViewRange | null>(null);
  const [showTagsOnTimeline, setShowTagsOnTimeline] = useState(false);

  const initializedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: api.settings.get,
    staleTime: 60000,
  });

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

    const rawShowTags = settings.settings["ui.showTagsOnTimeline"];
    if (rawShowTags === "true") setShowTagsOnTimeline(true);
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

  // Save last edited event ID
  useEffect(() => {
    if (!initializedRef.current) return;
    const val = eventSheet?.mode === "edit" ? JSON.stringify(eventSheet.id) : null;
    api.settings.put({ "ui.lastEditedEventId": val });
  }, [eventSheet]);

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

  // Clear all saved UI settings
  const handleClearSettings = useCallback(() => {
    setViewRange(null);
    setTagFilterIds([]);
    setTagFilterMode("or");
    setShowTagsOnTimeline(false);
    api.settings.put({
      "ui.viewRange": null,
      "ui.tagFilters": null,
      "ui.showTagsOnTimeline": null,
    }).then(() => qc.invalidateQueries({ queryKey: ["settings"] }));
  }, [qc]);

  const handleRemoveTag = (tagId: number) => {
    setTagFilterIds((prev) => {
      const next = prev.filter((id) => id !== tagId);
      return next;
    });
  };

  return (
    <div className="flex min-h-screen min-w-[1024px] flex-col">
      <TopBar
        onTimelines={() => setTimelinesOpen(true)}
        onAddEvent={() => setEventSheet({ mode: "create" })}
        onSettings={() => setSettingsOpen(true)}
        onSearch={() => setSearchOpen(true)}
        filterCount={tagFilterIds.length}
      />
      <FilterBar
        tagFilterIds={tagFilterIds}
        tagFilterMode={tagFilterMode}
        onRemoveTag={handleRemoveTag}
        onReset={() => {
          setTagFilterIds([]);
          setTagFilterMode("or");
        }}
        onSearch={() => setSearchOpen(true)}
      />
      <main className="flex-1 overflow-hidden border border-slate-200 bg-white">
        <TimelineCanvas
          tagFilterIds={tagFilterIds}
          tagFilterMode={tagFilterMode}
          onEventClick={(id) => setEventSheet({ mode: "edit", id })}
          onEmptyClick={(date, timelineId) =>
            setEventSheet({ mode: "create", initialDate: date, initialTimelineId: timelineId })
          }
          initialRange={viewRange}
          onRangeChange={handleRangeChange}
          showTagsOnTimeline={showTagsOnTimeline}
        />
      </main>

      <TimelinesSheet open={timelinesOpen} onOpenChange={setTimelinesOpen} />
      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        savedViewRange={viewRange}
        savedTagFilterIds={tagFilterIds}
        savedTagFilterMode={tagFilterMode}
        showTagsOnTimeline={showTagsOnTimeline}
        onShowTagsOnTimelineChange={setShowTagsOnTimeline}
        onClearSettings={handleClearSettings}
      />
      <TagSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        selectedTagIds={tagFilterIds}
        mode={tagFilterMode}
        onApply={(ids, m) => {
          setTagFilterIds(ids);
          setTagFilterMode(m);
        }}
        onReset={() => {
          setTagFilterIds([]);
          setTagFilterMode("or");
        }}
      />
      {eventSheet && (
        <EventSheet
          mode={eventSheet.mode}
          eventId={eventSheet.mode === "edit" ? eventSheet.id : undefined}
          initialDate={eventSheet.mode === "create" ? eventSheet.initialDate : undefined}
          initialTimelineId={eventSheet.mode === "create" ? eventSheet.initialTimelineId : undefined}
          onClose={() => setEventSheet(null)}
        />
      )}
    </div>
  );
}
