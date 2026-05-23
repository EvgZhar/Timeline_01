import { useState } from "react";
import { TopBar } from "./components/TopBar";
import { EventSheet } from "./features/events/EventSheet";
import { SettingsSheet } from "./features/settings/SettingsSheet";
import { TimelinesSheet } from "./features/timelines/TimelinesSheet";
import { TimelineCanvas } from "./features/timeline/TimelineCanvas";
import { TagSearch } from "./features/tags/TagSearch";
import { FilterBar } from "./features/tags/FilterBar";

export default function App() {
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
        />
      </main>

      <TimelinesSheet open={timelinesOpen} onOpenChange={setTimelinesOpen} />
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
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
