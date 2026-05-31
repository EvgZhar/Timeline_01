import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDisplay, parseDisplay } from "@timeline/shared";
import { useEffect, useRef, useState } from "react";
import { Check, ExternalLink, Plus, Save, Trash2, X } from "lucide-react";
import { TooltipButton } from "@/components/TooltipButton";
import { api } from "@/api/client";
import { Sheet } from "@/components/Sheet";
import { DatePickerField } from "@/components/DatePickerField";
import type { DocumentDto } from "@timeline/shared";

interface EventSheetProps {
  mode: "create" | "edit";
  eventId?: number;
  initialDate?: string;
  initialTimelineId?: number;
  onClose: () => void;
}

interface PendingDoc {
  tempId: string;
  description: string;
  originalLink: string;
  resourceType: string;
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

function DocThumbnail({ doc }: { doc: DocumentDto | PendingDoc }) {
  const isImage = doc.resourceType === "image" || !doc.resourceType;
  const previewUrl = "previewUrl" in doc ? (doc as DocumentDto).previewUrl : undefined;
  const url = previewUrl ?? (doc as PendingDoc).originalLink ?? null;

  if (isImage && url) {
    return (
      <img
        src={url}
        alt={doc.description}
        className="h-12 w-12 shrink-0 rounded object-cover"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-slate-100 text-xs text-slate-400">
      {doc.resourceType ?? "?"}
    </div>
  );
}

export function EventSheet({ mode, eventId, initialDate, initialTimelineId, onClose }: EventSheetProps) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"main" | "attachments">("main");
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
  const { data: docs = [], refetch: refetchDocs } = useQuery({
    queryKey: ["event-documents", eventId],
    queryFn: () => api.documents.list(eventId!),
    enabled: mode === "edit" && !!eventId,
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

  // Pending documents (create mode)
  const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([]);

  // Add document form state
  const [newDocDescription, setNewDocDescription] = useState("");
  const [newDocUrl, setNewDocUrl] = useState("");
  const [newDocType, setNewDocType] = useState("image");

  // Document mutations (edit mode)
  const addDocMut = useMutation({
    mutationFn: (body: { eventId: number; description: string; originalLink: string; resourceType?: string }) =>
      api.documents.createFromUrl(body),
    onSuccess: () => {
      refetchDocs();
      setNewDocDescription("");
      setNewDocUrl("");
      setNewDocType("image");
    },
  });

  const deleteDocMut = useMutation({
    mutationFn: (id: number) => api.documents.delete(id),
    onSuccess: () => refetchDocs(),
  });

  const setPrimaryMut = useMutation({
    mutationFn: (id: number) => api.documents.setPrimary(id),
    onSuccess: () => refetchDocs(),
  });

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
      const created = await api.events.create(body);
      // Save pending documents for create mode
      for (const pd of pendingDocs) {
        await api.documents.createFromUrl({
          eventId: created.id,
          description: pd.description,
          originalLink: pd.originalLink,
          resourceType: pd.resourceType,
        });
      }
      return created;
    },
    onSuccess: (data) => {
      qc.setQueryData(["event", data.id], data);
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

  const primaryDoc = docs.find((d) => d.isPrimary);

  // --- Add pending doc (create mode) ---
  const addPendingDoc = () => {
    if (!newDocUrl.trim() || !newDocDescription.trim()) return;
    setPendingDocs((prev) => [
      ...prev,
      { tempId: crypto.randomUUID(), description: newDocDescription, originalLink: newDocUrl, resourceType: newDocType },
    ]);
    setNewDocDescription("");
    setNewDocUrl("");
    setNewDocType("image");
  };

  const removePendingDoc = (tempId: string) => {
    setPendingDocs((prev) => prev.filter((d) => d.tempId !== tempId));
  };

  // --- Document section shared between create mode and edit "attachments" tab ---
  const docListSection = (
    <div className="space-y-2">
      {mode === "edit" && docs.map((doc) => (
        <div key={doc.documentId} className="flex items-center gap-2 rounded border border-slate-200 p-2">
          <DocThumbnail doc={doc} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{doc.description}</p>
            <p className="truncate text-xs text-slate-400">{doc.originalLink ?? doc.storageLink}</p>
          </div>
          {(doc.originalLink) && (
            <a
              href={doc.originalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-slate-400 hover:text-blue-600"
              title="Открыть в новой вкладке"
            >
              <ExternalLink size={14} />
            </a>
          )}
          <button
            type="button"
            className={`shrink-0 rounded p-0.5 ${doc.isPrimary ? "text-green-600" : "text-slate-300 hover:text-green-500"}`}
            onClick={() => !doc.isPrimary && setPrimaryMut.mutate(doc.documentId)}
            title={doc.isPrimary ? "Основное вложение" : "Сделать основным"}
          >
            {doc.isPrimary ? <Check size={16} /> : <div className="h-4 w-4 rounded-sm border border-current" />}
          </button>
          <button
            type="button"
            className="shrink-0 text-xs text-red-500 hover:text-red-700"
            title="Удалить вложение"
            onClick={() => deleteDocMut.mutate(doc.documentId)}
          >
            ✕
          </button>
        </div>
      ))}
      {mode === "create" && pendingDocs.map((pd, idx) => (
        <div key={pd.tempId} className="flex items-center gap-2 rounded border border-slate-200 p-2">
          <DocThumbnail doc={pd} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{pd.description}</p>
            <p className="truncate text-xs text-slate-400">{pd.originalLink}</p>
          </div>
          <a
            href={pd.originalLink}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-slate-400 hover:text-blue-600"
            title="Открыть в новой вкладке"
          >
            <ExternalLink size={14} />
          </a>
          <span
            className={`shrink-0 rounded p-0.5 ${idx === 0 ? "text-green-600" : "text-slate-200"}`}
            title={idx === 0 ? "Основное вложение" : ""}
          >
            <Check size={16} className={idx === 0 ? "" : "opacity-0"} />
          </span>
          <button
            type="button"
            className="shrink-0 text-xs text-red-500 hover:text-red-700"
            title="Удалить вложение"
            onClick={() => removePendingDoc(pd.tempId)}
          >
            ✕
          </button>
        </div>
      ))}

      {/* Add document form */}
      <div className="space-y-2 rounded border border-dashed border-slate-300 p-3">
        <p className="text-xs font-medium text-slate-500">Добавить файл</p>
        <input
          className="w-full rounded border px-2 py-1 text-sm"
          placeholder="Описание"
          value={newDocDescription}
          onChange={(e) => setNewDocDescription(e.target.value)}
        />
        <input
          className="w-full rounded border px-2 py-1 text-sm"
          placeholder="Ссылка (URL)"
          value={newDocUrl}
          onChange={(e) => setNewDocUrl(e.target.value)}
        />
        <div className="flex gap-2">
          <select
            className="rounded border px-2 py-1 text-sm"
            value={newDocType}
            onChange={(e) => setNewDocType(e.target.value)}
          >
            <option value="image">Изображение</option>
            <option value="video">Видео</option>
            <option value="pdf">PDF</option>
            <option value="other">Другое</option>
          </select>
          <TooltipButton
            label="Добавить вложение"
            onClick={() => {
              if (mode === "edit" && eventId) {
                addDocMut.mutate({ eventId, description: newDocDescription, originalLink: newDocUrl, resourceType: newDocType });
              } else {
                addPendingDoc();
              }
            }}
            disabled={!newDocUrl.trim() || !newDocDescription.trim()}
            className="rounded bg-blue-600 p-2 text-white disabled:opacity-50"
          >
            <Plus size={16} />
          </TooltipButton>
        </div>
      </div>
    </div>
  );

  return (
    <Sheet
      open={true}
      side="right"
      onOpenChange={(o) => !o && handleClose()}
      title={mode === "create" ? "Новое событие" : "Редактирование"}
      footer={
        <div className="flex items-center gap-2">
          <TooltipButton
            label="Сохранить"
            onClick={() => saveMut.mutate()}
            disabled={!valid || saveMut.isPending}
            className="flex w-24 items-center justify-center rounded bg-blue-600 py-2 text-white disabled:opacity-50"
          >
            <Save size={20} />
          </TooltipButton>
          <div className="ml-auto flex items-center gap-2">
            <TooltipButton
              label="Отмена"
              onClick={handleClose}
              className="rounded border p-2 text-slate-600 hover:bg-slate-100"
            >
              <X size={20} />
            </TooltipButton>
            {mode === "edit" && (
              <TooltipButton
                label="Удалить событие"
                onClick={() => {
                  if (confirm("Удалить событие?")) deleteMut.mutate();
                }}
                className="rounded border border-red-300 p-2 text-red-600 hover:bg-red-50"
              >
                <Trash2 size={20} />
              </TooltipButton>
            )}
          </div>
        </div>
      }
    >
      {/* Tabs (edit mode only) */}
      {mode === "edit" && (
        <div className="mb-3 flex border-b border-slate-200">
          <button
            className={`px-3 py-2 text-sm font-medium ${
              activeTab === "main"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-slate-500 hover:text-slate-700"
            }`}
            onClick={() => setActiveTab("main")}
          >
            Основное
          </button>
          <button
            className={`px-3 py-2 text-sm font-medium ${
              activeTab === "attachments"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-slate-500 hover:text-slate-700"
            }`}
            onClick={() => setActiveTab("attachments")}
          >
            Приложения{docs.length > 0 ? ` (${docs.length})` : ""}
          </button>
        </div>
      )}

      {mode === "edit" && activeTab === "main" ? (
        /* === EDIT MODE - MAIN TAB === */
        <div className="space-y-3">
          <label className="block text-sm">
            Наименование
            <input className="mt-1 w-full rounded border px-2 py-1" value={name} onChange={(e) => setName(e.target.value)} />
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
                      className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700"
                    >
                      <span className="inline-block h-3 w-3 shrink-0 overflow-hidden rounded-sm">
                        {t.previewUrl ? (
                          <img src={t.previewUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="block h-full w-full" style={{ backgroundColor: `#${hex}` }} />
                        )}
                      </span>
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
                <TooltipButton label="Добавить тег" onClick={addTag} className="rounded border p-1.5">
                  <Plus size={16} />
                </TooltipButton>
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
                          className="inline-flex items-center gap-1.5 rounded border px-2 py-1 text-center text-xs"
                          style={{
                            backgroundColor: `#${hex}1A`,
                            borderColor: `#${hex}`,
                            color: "#1e293b",
                          }}
                          onMouseDown={(e) => { e.preventDefault(); toggleTag(t.id); }}
                        >
                          <span className="inline-block h-3 w-3 shrink-0 overflow-hidden rounded-sm">
                            {t.previewUrl ? (
                              <img src={t.previewUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="block h-full w-full" style={{ backgroundColor: `#${hex}` }} />
                            )}
                          </span>
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

          {/* Primary document preview */}
          {primaryDoc && (
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Основное вложение</p>
              <div className="rounded border border-slate-200 p-2">
                {primaryDoc.previewUrl ? (
                  <img
                    src={primaryDoc.previewUrl}
                    alt={primaryDoc.description}
                    className="h-32 w-full rounded object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-full items-center justify-center rounded bg-slate-100 text-xs text-slate-400">
                    {primaryDoc.resourceType ?? "файл"}
                  </div>
                )}
                <p className="mt-1 truncate text-xs text-slate-500">{primaryDoc.description}</p>
              </div>
            </div>
          )}
        </div>
      ) : mode === "create" ? (
        /* === CREATE MODE (no tabs) === */
        <div className="space-y-3">
          <label className="block text-sm">
            Наименование
            <input className="mt-1 w-full rounded border px-2 py-1" value={name} onChange={(e) => setName(e.target.value)} />
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
                      className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700"
                    >
                      <span className="inline-block h-3 w-3 shrink-0 overflow-hidden rounded-sm">
                        {t.previewUrl ? (
                          <img src={t.previewUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="block h-full w-full" style={{ backgroundColor: `#${hex}` }} />
                        )}
                      </span>
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
                <TooltipButton label="Добавить тег" onClick={addTag} className="rounded border p-1.5">
                  <Plus size={16} />
                </TooltipButton>
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
                          className="inline-flex items-center gap-1.5 rounded border px-2 py-1 text-center text-xs"
                          style={{
                            backgroundColor: `#${hex}1A`,
                            borderColor: `#${hex}`,
                            color: "#1e293b",
                          }}
                          onMouseDown={(e) => { e.preventDefault(); toggleTag(t.id); }}
                        >
                          <span className="inline-block h-3 w-3 shrink-0 overflow-hidden rounded-sm">
                            {t.previewUrl ? (
                              <img src={t.previewUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <span className="block h-full w-full" style={{ backgroundColor: `#${hex}` }} />
                            )}
                          </span>
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

          {/* Documents section for create mode */}
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">Приложенные файлы</p>
            {docListSection}
          </div>
        </div>
      ) : (
        /* === EDIT MODE - ATTACHMENTS TAB === */
        <div className="space-y-3">
          <p className="text-xs font-medium text-slate-500">Приложенные файлы</p>
          {docListSection}
        </div>
      )}
    </Sheet>
  );
}
