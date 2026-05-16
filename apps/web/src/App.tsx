import { useState } from "react";
import { TopBar } from "./components/TopBar";
import { EventSheet } from "./features/events/EventSheet";
import { SettingsSheet } from "./features/settings/SettingsSheet";
import { TimelinesSheet } from "./features/timelines/TimelinesSheet";
import { TimelineCanvas } from "./features/timeline/TimelineCanvas";

export default function App() {
  const [timelinesOpen, setTimelinesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [eventSheet, setEventSheet] = useState<{ mode: "create" } | { mode: "edit"; id: number } | null>(
    null,
  );

  return (
    <div className="flex min-h-screen min-w-[1024px] flex-col">
      <TopBar
        onTimelines={() => setTimelinesOpen(true)}
        onAddEvent={() => setEventSheet({ mode: "create" })}
        onSettings={() => setSettingsOpen(true)}
      />
      <main className="flex-1 overflow-hidden border border-slate-200 bg-white">
        <TimelineCanvas onEventClick={(id) => setEventSheet({ mode: "edit", id })} />
      </main>

      <TimelinesSheet open={timelinesOpen} onOpenChange={setTimelinesOpen} />
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
      {eventSheet && (
        <EventSheet
          mode={eventSheet.mode}
          eventId={eventSheet.mode === "edit" ? eventSheet.id : undefined}
          onClose={() => setEventSheet(null)}
        />
      )}
    </div>
  );
}
