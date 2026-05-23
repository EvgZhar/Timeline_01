import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDisplay, parseDisplay } from "@timeline/shared";
import { useEffect, useRef, useState } from "react";
import { api } from "@/api/client";
import { Sheet } from "@/components/Sheet";
import { DatePickerField } from "@/components/DatePickerField";

interface EventSheetProps {
  mode: "create" | "edit";
  eventId?: number;
  initialDate?: string;
  initialTimelineId?: number;
  onClose: () => void;
}

function hslToInt(h: number, s: number, l: number): number {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return (f(0) << 16) | (f(8) << 8) | f(4);
}

function randomColor(): number {
  return hslToInt(
    Math.floor(Math.random() * 360),
    65 + Math.floor(Math.random() * 25),
    40 + Math.floor(Math.random() * 20),
  );
}

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
  const [newTagName, setNewTagName] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (event) {
      setName(event.name);
      setStartDate(formatDisplay(event.startDate));
      setEndDate(event.endDate !== event.startDate ? formatDisplay(event.endDate) : "");
      setNotes(event.notes ?? "");
      setTimelineIds(event.timelines.map((t) => t.id));
      setTagIds(event.tags.map((t) => t.id));
      initializedRef.current = true;
    } else if (mode === "create" && !initializedRef.current) {
      if (initialDate) setStartDate(initialDate);
      if (initialTimelineId) {
        setTimelineIds([initialTimelineId]);
        initializedRef.current = true;
      } else if (timelines.length > 0) {
        setTimelineIds([timelines[0].id]);
        initializedRef.current = true;
      }
    }
  }, [event, mode, timelines, initialDate, initialTimelineId]);

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

  const inputRef = useRef<HTMLDivElement>(null);

  const addTag = async () => {
    const name = newTagName.trim();
    if (!name) return;

    const existing = allTags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      setTagIds((ids) => (ids.includes(existing.id) ? ids : [...ids, existing.id]));
    } else {
      const tag = await api.tags.create({ name, color: randomColor() });
      setTagIds((ids) => [...ids, tag.id]);
      qc.invalidateQueries({ queryKey: ["tags"] });
    }
    setNewTagName("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addTag();
    }
  };

  const toggleTag = (tagId: number) => {
    setTagIds((ids) => (ids.includes(tagId) ? ids.filter((x) => x !== tagId) : [...ids, tagId]));
  };

  const removeTag = (tagId: number) => {
    setTagIds((ids) => ids.filter((x) => x !== tagId));
  };

  const dropdownTags = newTagName.trim()
    ? allTags.filter((t) => t.name.toLowerCase().includes(newTagName.toLowerCase()) && !tagIds.includes(t.id))
    : (recentTags.length ? recentTags : allTags.slice(0, 12)).filter((t) => !tagIds.includes(t.id));

  const handleClose = () => onClose();

  const valid = name.trim().length > 0 && startDate.trim() && timelineIds.length > 0;

  return (
    <Sheet open={true} side="right" onOpenChange={(o) => !o && handleClose()} title={mode === "create" ? "Новое событие" : "Редактирование"}
      footer={
        <div className="flex gap-2">
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
      }
    >
      <div className="space-y-3">
        <label className="block text-sm">
          Наименование
          <input className="mt-1 w-full rounded border px-2 py-1" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <DatePickerField
          label="Дата начала (ДД.ММ.ГГГГ)"
          value={startDate}
          onChange={(v) => setStartDate(v)}
          placeholder="ДД.ММ.ГГГГ"
        />
        <DatePickerField
          label="Дата окончания"
          value={endDate}
          onChange={(v) => setEndDate(v)}
          placeholder="ДД.ММ.ГГГГ"
        />
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

          {tagIds.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {allTags.filter((t) => tagIds.includes(t.id)).map((t) => {
                const hex = t.color.toString(16).padStart(6, "0");
                return (
                  <span
                    key={t.id}
                    className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs text-white"
                    style={{ backgroundColor: `#${hex}` }}
                  >
                    {t.name}
                    <button type="button" className="leading-none hover:opacity-70" onClick={() => removeTag(t.id)}>
                      ✕
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          <div className="relative" ref={inputRef}>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded border px-2 py-1 text-sm"
                placeholder="Поиск или новый тег…"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              />
              <button type="button" className="rounded border px-2 text-sm" onClick={addTag}>
                +
              </button>
            </div>
            {showSuggestions && dropdownTags.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-50 mt-0.5 rounded border bg-white p-1.5 shadow">
                <div className="grid grid-cols-4 gap-1.5">
                  {dropdownTags.map((t) => {
                    const hex = t.color.toString(16).padStart(6, "0");
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className="rounded border px-2 py-1 text-center text-xs"
                        style={{
                          backgroundColor: `#${hex}1A`,
                          borderColor: `#${hex}`,
                          color: "#1e293b",
                        }}
                        onMouseDown={(e) => { e.preventDefault(); toggleTag(t.id); }}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {showSuggestions && dropdownTags.length === 0 && newTagName.trim() && (
              <div className="absolute left-0 right-0 top-full z-50 mt-0.5 rounded border bg-white p-3 text-center text-xs text-slate-400 shadow">
                Нет совпадений
              </div>
            )}
          </div>
        </fieldset>
      </div>
    </Sheet>
  );
}
