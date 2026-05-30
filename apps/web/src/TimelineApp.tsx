import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { TopBar } from "./components/TopBar";
import { EventSheet } from "./features/events/EventSheet";
import { SettingsSheet } from "./features/settings/SettingsSheet";
import { ProfileSheet } from "./features/profile/ProfileSheet";
import { TimelinesSheet } from "./features/timelines/TimelinesSheet";
import { TimelineCanvas } from "./features/timeline/TimelineCanvas";
import { TagSearch } from "./features/tags/TagSearch";
import { FilterBar } from "./features/tags/FilterBar";
import { useAuth } from "./auth/AuthContext";
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

  const initializedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: api.settings.get,
    staleTime: 60000,
  });

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
    setTextSearchQuery("");
    setTextSearchMode("name");
    setShowTagsOnTimeline(false);
    api.settings.put({
      "ui.viewRange": null,
      "ui.tagFilters": null,
      "ui.textSearch": null,
      "ui.showTagsOnTimeline": null,
    }).then(() => qc.invalidateQueries({ queryKey: ["settings"] }));
  }, [qc]);

  const handleRemoveTag = (tagId: number) => {
    setTagFilterIds((prev) => prev.filter((id) => id !== tagId));
  };

  return (
    <div className="flex min-h-screen min-w-[1024px] flex-col">
      <TopBar
        onTimelines={() => setTimelinesOpen(true)}
        onAddEvent={() => setEventSheet({ mode: "create" })}
        onSettings={() => setSettingsOpen(true)}
        onSearch={() => setSearchOpen(true)}
        onProfile={() => setProfileOpen(true)}
        filterCount={tagFilterIds.length + (textSearchQuery ? 1 : 0)}
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
      <main className="flex-1 overflow-hidden border border-slate-200 bg-white">
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
        />
      )}
    </div>
  );
}
