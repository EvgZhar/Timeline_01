import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDisplay, parseDisplay } from "@timeline/shared";
import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { Sheet } from "@/components/Sheet";

interface EventSheetProps {
  mode: "create" | "edit";
  eventId?: number;
  initialDate?: string;
  initialTimelineId?: number;
  onClose: () => void;
}

const TAG_COLORS = [0xe11d48, 0x2563eb, 0x16a34a, 0xca8a04, 0x9333ea, 0x0891b2];

export function EventSheet({ mode, eventId, initialDate, initialTimelineId, onClose }: EventSheetProps) {
  const qc = useQueryClient();
  const { data: event } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => api.events.get(eventId!),
    enabled: mode === "edit" && !!eventId,
  });
  const { data: timelines = [] } = useQuery({
    queryKey: ["timelines"],
    queryFn: api.timelines.list,
  });
  const { data: allTags = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: () => api.tags.list(),
  });
  const { data: recentTags = [] } = useQuery({
    queryKey: ["tags", "recent"],
    queryFn: api.tags.recent,
  });

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [timelineIds, setTimelineIds] = useState<number[]>([]);
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [dirty, setDirty] = useState(false);
  const [newTagName, setNewTagName] = useState("");

  useEffect(() => {
    if (event) {
      setName(event.name);
      setStartDate(formatDisplay(event.startDate));
      setEndDate(event.endDate !== event.startDate ? formatDisplay(event.endDate) : "");
      setNotes(event.notes ?? "");
      setTimelineIds(event.timelines.map((t) => t.id));
      setTagIds(event.tags.map((t) => t.id));
      setDirty(false);
    } else if (mode === "create") {
      if (initialDate) setStartDate(initialDate);
      if (initialTimelineId) {
        setTimelineIds([initialTimelineId]);
      } else if (timelines.length > 0 && timelineIds.length === 0) {
        setTimelineIds([timelines[0].id]);
      }
    }
  }, [event, mode, timelines, timelineIds.length, initialDate, initialTimelineId]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const body = {
        name: name.trim(),
        startDate: parseDisplay(startDate),
        endDate: endDate.trim() ? parseDisplay(endDate) : undefined,
        notes: notes || undefined,
        timelineIds,
        tagIds,
      };
      if (mode === "edit" && eventId) return api.events.update(eventId, body);
      return api.events.create(body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      onClose();
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => api.events.delete(eventId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      onClose();
    },
  });

  const addTag = async () => {
    if (!newTagName.trim()) return;
    const color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
    const tag = await api.tags.create({ name: newTagName.trim(), color });
    setTagIds((ids) => [...ids, tag.id]);
    setNewTagName("");
    qc.invalidateQueries({ queryKey: ["tags"] });
    setDirty(true);
  };

  const handleClose = () => {
    if (dirty && !confirm("Несохранённые изменения. Закрыть?")) return;
    onClose();
  };

  const valid = name.trim().length > 0 && startDate.trim() && timelineIds.length > 0;

  return (
    <Sheet open={true} side="right" onOpenChange={(o) => !o && handleClose()} title={mode === "create" ? "Новое событие" : "Редактирование"}>
      <div className="space-y-3" onChange={() => setDirty(true)}>
        <label className="block text-sm">
          Наименование
          <input className="mt-1 w-full rounded border px-2 py-1" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block text-sm">
          Дата начала (ДД.ММ.ГГГГ)
          <input className="mt-1 w-full rounded border px-2 py-1" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label className="block text-sm">
          Дата окончания
          <input className="mt-1 w-full rounded border px-2 py-1" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>
        <label className="block text-sm">
          Описание
          <textarea className="mt-1 w-full rounded border px-2 py-1" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        <fieldset>
          <legend className="text-sm font-medium">Шкалы</legend>
          {timelines.map((t) => (
            <label key={t.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={timelineIds.includes(t.id)}
                onChange={(e) => {
                  setTimelineIds((ids) =>
                    e.target.checked ? [...ids, t.id] : ids.filter((x) => x !== t.id),
                  );
                }}
              />
              {t.name}
            </label>
          ))}
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium">Теги</legend>
          <div className="mb-2 flex flex-wrap gap-1">
            {(recentTags.length ? recentTags : allTags.slice(0, 6)).map((t) => (
              <button
                key={t.id}
                type="button"
                className="rounded px-2 py-0.5 text-xs text-white"
                style={{ backgroundColor: `#${t.color.toString(16).padStart(6, "0")}` }}
                onClick={() =>
                  setTagIds((ids) =>
                    ids.includes(t.id) ? ids.filter((x) => x !== t.id) : [...ids, t.id],
                  )
                }
              >
                {t.name}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              className="flex-1 rounded border px-2 py-1 text-sm"
              placeholder="Новый тег"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
            />
            <button type="button" className="rounded border px-2 text-sm" onClick={addTag}>
              +
            </button>
          </div>
        </fieldset>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            disabled={!valid || saveMut.isPending}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
            onClick={() => saveMut.mutate()}
          >
            Сохранить
          </button>
          {mode === "edit" && (
            <button
              type="button"
              className="rounded border border-red-300 px-4 py-2 text-sm text-red-600"
              onClick={() => {
                if (confirm("Удалить событие?")) deleteMut.mutate();
              }}
            >
              Удалить
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
