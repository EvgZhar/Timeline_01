import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download, Link2 } from "lucide-react";
import { dependencyTypeLabel, formatDisplay, parseDisplay } from "@timeline/shared";
import { api } from "@/api/client";
import { SidePanel } from "@/components/SidePanel";
import { DatePickerField } from "@/components/DatePickerField";
import { TooltipButton } from "@/components/TooltipButton";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { useAuth } from "@/auth/AuthContext";
import type { TagDto } from "@timeline/shared";

interface EventDetailPanelProps {
  eventId: number;
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

function TagChip({ tag, onRemove }: { tag: TagDto; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700">
      {tag.previewUrl ? (
        <img src={tag.previewUrl} alt="" className="h-5 w-5 shrink-0 rounded object-cover" />
      ) : (
        tag.name
      )}
      <button type="button" className="leading-none hover:opacity-70" onClick={onRemove}>✕</button>
    </span>
  );
}

function downloadMd(notes: string, name: string) {
  const blob = new Blob([notes], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/[^a-zA-Zа-яА-Я0-9]/g, "_")}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export function EventDetailPanel({ eventId }: EventDetailPanelProps) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  const { data: event, isLoading, isError, refetch } = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => api.events.get(eventId),
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

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: api.settings.get,
    staleTime: 60000,
  });

  const orderKey = userId ? `ui:${userId}:timelineOrder` : null;

  const savedOrder = useMemo(() => {
    if (!orderKey || !settings) return [];
    const raw = settings.settings[orderKey];
    if (typeof raw !== "string") return [];
    try { return JSON.parse(raw) as number[]; } catch { return []; }
  }, [orderKey, settings]);

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [timelineIds, setTimelineIds] = useState<number[]>([]);
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [orderedTimelineIds, setOrderedTimelineIds] = useState<number[]>([]);

  // Populate form when event data loads
  useEffect(() => {
    if (event) {
      setName(event.name);
      setStartDate(formatDisplay(event.startDate));
      setEndDate(event.endDate !== event.startDate ? formatDisplay(event.endDate) : "");
      setNotes(event.notes ?? "");
      setTimelineIds(event.timelines.map((t) => t.id));
      setTagIds(event.tags.map((t) => t.id));
    }
  }, [event]);

  useEffect(() => {
    if (savedOrder.length > 0) setOrderedTimelineIds(savedOrder);
  }, [savedOrder]);

  const sortedTimelines = useMemo(() => {
    if (orderedTimelineIds.length === 0) return timelines;
    const ordered = orderedTimelineIds
      .map((id) => timelines.find((t) => t.id === id))
      .filter((t): t is (typeof timelines)[number] => !!t);
    const rest = timelines.filter((t) => !orderedTimelineIds.includes(t.id));
    return [...ordered, ...rest];
  }, [timelines, orderedTimelineIds]);

  const saveOrder = async (ids: number[]) => {
    if (!orderKey) return;
    await api.settings.put({ [orderKey]: JSON.stringify(ids) });
    qc.invalidateQueries({ queryKey: ["settings"] });
  };

  const moveTimeline = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= sortedTimelines.length) return;
    const sortedIds = sortedTimelines.map((t) => t.id);
    [sortedIds[index], sortedIds[target]] = [sortedIds[target], sortedIds[index]];
    setOrderedTimelineIds(sortedIds);
    saveOrder(sortedIds);
  };

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
      return api.events.update(eventId, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["event", eventId] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: () => api.events.delete(eventId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["events"] });
    },
  });

  const addTag = async () => {
    const tagName = newTagName.trim();
    if (!tagName) return;
    const existing = allTags.find((t) => t.name.toLowerCase() === tagName.toLowerCase());
    if (existing) {
      setTagIds((ids) => (ids.includes(existing.id) ? ids : [...ids, existing.id]));
    } else {
      const tag = await api.tags.create({ name: tagName, color: randomColor() });
      setTagIds((ids) => [...ids, tag.id]);
      qc.invalidateQueries({ queryKey: ["tags"] });
    }
    setNewTagName("");
  };

  const toggleTag = (tagId: number) => {
    setTagIds((ids) => (ids.includes(tagId) ? ids.filter((x) => x !== tagId) : [...ids, tagId]));
  };

  const removeTag = (tagId: number) => {
    setTagIds((ids) => ids.filter((x) => x !== tagId));
  };

  const valid = name.trim().length > 0 && startDate.trim() && timelineIds.length > 0;

  const selectedTags = allTags.filter((t) => tagIds.includes(t.id));

  const dropdownTags = newTagName.trim()
    ? allTags.filter((t) => t.name.toLowerCase().includes(newTagName.toLowerCase()) && !tagIds.includes(t.id))
    : (recentTags.length ? recentTags : allTags.slice(0, 12)).filter((t) => !tagIds.includes(t.id));

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); addTag(); }
  };

  return (
    <SidePanel title={name || "Загрузка…"}>
      {isLoading ? (
        <div className="flex h-full items-center justify-center text-sm text-slate-400">Загрузка…</div>
      ) : isError ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-red-500">
          Ошибка загрузки
          <button onClick={() => refetch()} className="rounded border px-3 py-1 text-xs hover:bg-slate-100">
            Повторить
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <label className="block text-sm">
            Наименование
            <input
              className="mt-1 w-full rounded border px-2 py-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <div className="flex gap-2">
            <div className="flex-1">
              <DatePickerField
                label="Дата начала"
                value={startDate}
                onChange={(v) => setStartDate(v)}
                placeholder="ДД.ММ.ГГГГ"
              />
            </div>
            <div className="flex-1">
              <DatePickerField
                label="Дата окончания"
                value={endDate}
                onChange={(v) => setEndDate(v)}
                placeholder="ДД.ММ.ГГГГ"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span>Описание</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); downloadMd(notes, name); }}
                disabled={!notes.trim()}
                className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                title="Экспорт .md"
              >
                <Download size={12} />
                .md
              </button>
            </div>
            <MarkdownEditor
              value={notes}
              onChange={setNotes}
              className="mt-1"
            />
          </div>

          <fieldset>
            <legend className="mb-1 text-sm font-medium">Шкалы</legend>
            <div className={sortedTimelines.length > 5 ? "max-h-[200px] space-y-0.5 overflow-y-auto" : "space-y-0.5"}>
              {sortedTimelines.map((tl, idx) => (
                <div
                  key={tl.id}
                  className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={timelineIds.includes(tl.id)}
                    onChange={(e) =>
                      setTimelineIds((ids) =>
                        e.target.checked ? [...ids, tl.id] : ids.filter((x) => x !== tl.id),
                      )
                    }
                    className="shrink-0"
                  />
                  <span className="flex-1 text-sm">{tl.name}</span>
                  <TooltipButton
                    label="Выше"
                    onClick={() => moveTimeline(idx, -1)}
                    disabled={idx === 0}
                    className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-20"
                  >
                    <ArrowUp size={14} />
                  </TooltipButton>
                  <TooltipButton
                    label="Ниже"
                    onClick={() => moveTimeline(idx, 1)}
                    disabled={idx === sortedTimelines.length - 1}
                    className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-20"
                  >
                    <ArrowDown size={14} />
                  </TooltipButton>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1 text-sm font-medium">Теги</legend>
            {selectedTags.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {selectedTags.map((t) => (
                  <TagChip key={t.id} tag={t} onRemove={() => removeTag(t.id)} />
                ))}
              </div>
            )}
            <div className="relative">
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded border px-2 py-1 text-sm"
                  placeholder="Поиск или новый тег…"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="rounded border px-2 py-1 text-sm hover:bg-slate-100"
                >
                  +
                </button>
              </div>
              {showSuggestions && (
                <div className="absolute left-0 right-0 top-full z-50 mt-0.5 rounded border bg-white p-1.5 shadow">
                  {dropdownTags.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400">
                      {newTagName.trim() ? "Нет совпадений" : "Нет доступных тегов"}
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-1.5">
                      {dropdownTags.map((t) => {
                        const hex = t.color.toString(16).padStart(6, "0");
                        return (
                          <button
                            key={t.id}
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded border px-2 py-1 text-center text-xs"
                            style={{
                              backgroundColor: `#${hex}1A`,
                              borderColor: `#${hex}`,
                              color: "#1e293b",
                            }}
                            onMouseDown={(e) => { e.preventDefault(); toggleTag(t.id); }}
                          >
                            {t.previewUrl ? (
                              <img src={t.previewUrl} alt="" className="h-4 w-4 shrink-0 rounded object-cover" />
                            ) : (
                              t.name
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </fieldset>

          {event?.dependencies && event.dependencies.length > 0 && (
            <fieldset>
              <legend className="mb-1 text-sm font-medium flex items-center gap-1">
                <Link2 size={14} /> Связи
              </legend>
              <div className="space-y-1">
                {event.dependencies.map((dep) => (
                  <div key={dep.depEventId} className="flex items-center gap-2 rounded border border-slate-200 px-2 py-1.5">
                    <Link2 size={14} className="shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1 truncate text-sm">{dep.depEventName ?? dep.depEventId}</span>
                    <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                      {dependencyTypeLabel(dep.dependencyType, true)}
                    </span>
                  </div>
                ))}
              </div>
            </fieldset>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => saveMut.mutate()}
              disabled={!valid || saveMut.isPending}
              className="flex w-24 items-center justify-center rounded bg-blue-600 py-2 text-sm text-white disabled:opacity-50"
            >
              {saveMut.isPending ? "…" : "Сохранить"}
            </button>
            <button
              onClick={() => { if (confirm("Удалить событие?")) deleteMut.mutate(); }}
              disabled={deleteMut.isPending}
              className="rounded border border-red-300 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {deleteMut.isPending ? "…" : "Удалить"}
            </button>
          </div>
        </div>
      )}
    </SidePanel>
  );
}
