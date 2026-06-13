import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDisplay } from "@timeline/shared";
import { useRef, useState } from "react";
import { api } from "@/api/client";
import { Sheet } from "@/components/Sheet";
import { Check, Download, Eraser, ImageOff, Link2, Loader2, Pencil, Plus, Upload, X } from "lucide-react";
import { TooltipButton } from "@/components/TooltipButton";
import type { ViewRange } from "@/features/timeline/timeScale";
import type { ImportResult, TagDto } from "@timeline/shared";

interface SettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  savedViewRange?: ViewRange | null;
  savedTagFilterIds?: number[];
  savedTagFilterMode?: "and" | "or";
  textSearchQuery?: string;
  textSearchMode?: "name" | "nameAndNotes";
  showTagsOnTimeline?: boolean;
  onShowTagsOnTimelineChange?: (val: boolean) => void;
  highlightDependencies?: boolean;
  onHighlightDependenciesChange?: (val: boolean) => void;
  onClearSettings?: () => void;
}

function isoYear(year: number): string {
  return year < 0 ? "-" + String(-year).padStart(4, "0") : String(year).padStart(4, "0");
}

function msToDisplay(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const iso = `${isoYear(y)}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  try {
    return formatDisplay(iso);
  } catch {
    return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.${y}`;
  }
}

function hexToInt(hex: string): number {
  const h = hex.replace("#", "");
  return parseInt(h, 16);
}

function intToHex(color: number): string {
  return "#" + color.toString(16).padStart(6, "0");
}

type TabId = "interface" | "tags" | "import-export";

function TabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  const tabs: { id: TabId; label: string }[] = [
    { id: "interface", label: "Интерфейс" },
    { id: "tags", label: "Теги" },
    { id: "import-export", label: "Импорт/Экспорт" },
  ];
  return (
    <div className="mb-4 flex gap-1 border-b border-slate-200">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          className={`px-3 py-2 text-sm font-medium transition-colors ${
            active === t.id
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-slate-500 hover:text-slate-700"
          }`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function ImportSection() {
  const qc = useQueryClient();
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const result = await api.importExport.importXlsx(file);
      setImportResult(result);
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["timelines"] });
      qc.invalidateQueries({ queryKey: ["tags"] });
    } catch (err) {
      setImportResult({
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [{ row: 0, message: (err as Error).message }],
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
      <div className="mb-2 font-medium">Импорт из Excel</div>
      <p className="mb-2 text-xs text-slate-500">
        Загрузите .xlsx-файл, созданный через экспорт. Таймлайны и теги будут
        найдены по названию (или созданы, если не существуют). Если в колонке ID
        указан существующий ID события, оно будет обновлено.
      </p>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded bg-green-600 px-3 py-2 text-white hover:bg-green-700 disabled:opacity-50">
        <Upload size={16} />
        <span>{importing ? "Импорт..." : "Выбрать файл"}</span>
        <input
          type="file"
          accept=".xlsx"
          className="sr-only"
          disabled={importing}
          onChange={handleFile}
        />
      </label>

      {importResult && (
        <div className="mt-3 space-y-2">
          <div className="flex gap-4 text-xs font-medium">
            <span className="text-green-700">Создано: {importResult.created}</span>
            <span className="text-blue-700">Обновлено: {importResult.updated}</span>
            {importResult.skipped > 0 && (
              <span className="text-amber-700">Пропущено: {importResult.skipped}</span>
            )}
          </div>
          {importResult.errors.length > 0 && (
            <div className="max-h-32 overflow-y-auto rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
              {importResult.errors.map((e, i) => (
                <div key={i}>
                  {e.row > 0 ? `Строка ${e.row}: ` : ""}{e.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function SettingsSheet({
  open,
  onOpenChange,
  savedViewRange,
  savedTagFilterIds,
  savedTagFilterMode,
  textSearchQuery,
  textSearchMode,
  showTagsOnTimeline,
  onShowTagsOnTimelineChange,
  highlightDependencies,
  onHighlightDependenciesChange,
  onClearSettings,
}: SettingsSheetProps) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabId>("interface");
  const [exporting, setExporting] = useState(false);

  const { data: allTimelines = [] } = useQuery({
    queryKey: ["timelines"],
    queryFn: api.timelines.list,
    enabled: open,
  });
  const { data: allTags = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: () => api.tags.list(),
    enabled: open,
  });

  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#3b82f6");
  const [newTagPreview, setNewTagPreview] = useState("");
  const [editingTagId, setEditingTagId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editHex, setEditHex] = useState("#3b82f6");
  const [editPreviewUrl, setEditPreviewUrl] = useState("");
  const colorRef = useRef<HTMLInputElement>(null);

  const createTagMut = useMutation({
    mutationFn: () =>
      api.tags.create({ name: newTagName, color: hexToInt(newTagColor), previewUrl: newTagPreview || null }),
    onSuccess: () => {
      setNewTagName("");
      setNewTagColor("#3b82f6");
      setNewTagPreview("");
      qc.invalidateQueries({ queryKey: ["tags"] });
    },
  });

  const startTagEdit = (tag: TagDto) => {
    setEditingTagId(tag.id);
    setEditName(tag.name);
    setEditHex(intToHex(tag.color));
    setEditPreviewUrl(tag.previewUrl ?? "");
  };

  const cancelTagEdit = () => {
    setEditingTagId(null);
  };

  const saveTagMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name: string; color: number; previewUrl: string | null } }) =>
      api.tags.update(id, data),
    onSuccess: () => {
      setEditingTagId(null);
      qc.invalidateQueries({ queryKey: ["tags"] });
    },
    onError: (err: Error) => {
      alert("Ошибка сохранения: " + err.message);
    },
  });

  const visibleTimelinesCount = allTimelines.filter((t) => t.visible).length;

  const hasSavedSettings = Boolean(
    savedViewRange || (savedTagFilterIds && savedTagFilterIds.length > 0),
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange} side="right" title="Настройки">
      <TabBar active={activeTab} onChange={setActiveTab} />

      {activeTab === "interface" && (
        <section className="space-y-3">
          <h3 className="font-medium">Интерфейс</h3>

          <div className="text-sm">
            <span className="text-slate-500">Видимые таймлайны:</span>{" "}
            {visibleTimelinesCount} из {allTimelines.length}
          </div>

          {savedViewRange && (
            <div className="text-sm">
              <span className="text-slate-500">Период отображения:</span>
              <div className="mt-0.5 rounded bg-slate-50 px-2 py-1 text-xs text-slate-600">
                {msToDisplay(savedViewRange.startMs)} — {msToDisplay(savedViewRange.endMs)}
              </div>
            </div>
          )}

          {savedTagFilterIds && savedTagFilterIds.length > 0 && (
            <div className="text-sm">
              <span className="text-slate-500">Активные тэги:</span>
              <div className="mt-0.5 text-xs text-slate-600">
                {savedTagFilterIds.length} шт., режим «{savedTagFilterMode === "and" ? "И" : "Или"}»
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showTagsOnTimeline ?? false}
              onChange={(e) => onShowTagsOnTimelineChange?.(e.target.checked)}
              className="rounded"
            />
            <span>Отображать теги на таймлайне</span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={highlightDependencies ?? true}
              onChange={(e) => onHighlightDependenciesChange?.(e.target.checked)}
              className="rounded"
            />
            <span>Подсвечивать связанные события при наведении</span>
          </label>

          {hasSavedSettings && onClearSettings && (
            <TooltipButton
              label="Очистить сохранённые настройки"
              onClick={onClearSettings}
              className="rounded border border-red-300 p-2 text-red-600 hover:bg-red-50"
            >
              <Eraser size={16} />
            </TooltipButton>
          )}
        </section>
      )}

      {activeTab === "import-export" && (
        <section className="space-y-4">
          <h3 className="font-medium">Импорт / Экспорт</h3>

          <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="mb-2 font-medium">Экспорт в Excel</div>
            <p className="mb-2 text-xs text-slate-500">
              Скачать все события, таймлайны и теги текущей области в формате .xlsx.
              Файл содержит три листа: «Таймлайны», «Теги» и «События».
              На листе «События» настроены выпадающие списки для выбора таймлайнов и тегов.
            </p>
            <TooltipButton
              label={exporting ? "Экспорт..." : "Скачать .xlsx"}
              disabled={exporting}
              onClick={async () => {
                setExporting(true);
                try {
                  await api.importExport.exportXlsx({
                    tagFilterIds: savedTagFilterIds?.length ? savedTagFilterIds : undefined,
                    tagFilterMode: savedTagFilterIds?.length ? savedTagFilterMode : undefined,
                    textSearchQuery: textSearchQuery || undefined,
                    textSearchMode: textSearchQuery ? textSearchMode : undefined,
                  });
                } catch (err) {
                  alert("Ошибка экспорта: " + (err instanceof Error ? err.message : "Неизвестная ошибка"));
                } finally {
                  setExporting(false);
                }
              }}
              className="rounded bg-blue-600 p-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exporting ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
              <span>{exporting ? "Экспорт..." : "Скачать .xlsx"}</span>
            </TooltipButton>
          </div>

          <ImportSection />
        </section>
      )}

      {activeTab === "tags" && (
        <section className="space-y-4">
          <h3 className="font-medium">Управление тегами</h3>

          <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="mb-2 font-medium">Добавить тег</div>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  className="flex-1 rounded border px-2 py-1 text-xs"
                  placeholder="Название"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                />
                <input
                  type="color"
                  className="h-7 w-10 rounded border"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                />
              </div>
              <input
                className="w-full rounded border px-2 py-1 text-xs"
                placeholder="URL превью (необязательно)"
                value={newTagPreview}
                onChange={(e) => setNewTagPreview(e.target.value)}
              />
              <TooltipButton
                label="Добавить тег"
                onClick={() => createTagMut.mutate()}
                disabled={!newTagName.trim()}
                className="self-start rounded bg-blue-600 p-1.5 text-white disabled:opacity-50"
              >
                <Plus size={16} />
              </TooltipButton>
            </div>
          </div>

          <div className="space-y-1.5">
            {allTags.map((tag) => {
              const isEditing = editingTagId === tag.id;
              return isEditing ? (
                <div key={tag.id} className="flex flex-col gap-1 rounded border border-slate-200 bg-white p-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded border bg-slate-100"
                      title="Сменить цвет"
                      onClick={() => colorRef.current?.click()}
                    >
                      {editPreviewUrl ? (
                        <img src={editPreviewUrl} alt="" className="h-full w-full object-contain" />
                      ) : (
                        <span className="block h-full w-full" style={{ backgroundColor: editHex }} />
                      )}
                    </div>
                    <input
                      className="flex-1 rounded border px-2 py-1 text-sm"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                      placeholder="Название тега"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && editName.trim().length >= 1) {
                          saveTagMut.mutate({
                            id: tag.id,
                            data: {
                              name: editName.trim(),
                              color: hexToInt(editHex),
                              previewUrl: editPreviewUrl || null,
                            },
                          });
                        }
                        if (e.key === "Escape") cancelTagEdit();
                      }}
                    />
                    <div className="flex items-center gap-1">
                      {editPreviewUrl && (
                        <TooltipButton
                          label="Удалить превью"
                          onClick={() => setEditPreviewUrl("")}
                          className="rounded p-1 text-slate-600 hover:bg-slate-100 hover:text-red-600"
                        >
                          <ImageOff size={14} />
                        </TooltipButton>
                      )}
                      <TooltipButton
                        label="Сохранить"
                        onClick={() =>
                          saveTagMut.mutate({
                            id: tag.id,
                            data: {
                              name: editName.trim(),
                              color: hexToInt(editHex),
                              previewUrl: editPreviewUrl || null,
                            },
                          })
                        }
                        disabled={!editName.trim()}
                        className="rounded p-1 text-slate-600 hover:bg-slate-100 hover:text-blue-600 disabled:opacity-50"
                      >
                        <Check size={14} />
                      </TooltipButton>
                      <TooltipButton
                        label="Отмена"
                        onClick={cancelTagEdit}
                        className="rounded p-1 text-slate-600 hover:bg-slate-100"
                      >
                        <X size={14} />
                      </TooltipButton>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Link2 size={14} className="shrink-0 text-slate-400" />
                    <input
                      className="flex-1 rounded border px-2 py-0.5 text-xs"
                      placeholder="https://example.com/preview.png"
                      value={editPreviewUrl}
                      onChange={(e) => setEditPreviewUrl(e.target.value)}
                    />
                  </div>
                </div>
              ) : (
                <div
                  key={tag.id}
                  className="flex items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2 text-sm hover:bg-slate-50"
                >
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded bg-slate-100"
                    title="Цвет тега"
                  >
                    {tag.previewUrl ? (
                      <img src={tag.previewUrl} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <span className="block h-full w-full" style={{ backgroundColor: intToHex(tag.color) }} />
                    )}
                  </div>
                  <span className="flex-1 text-sm font-medium">{tag.name}</span>
                  <div className="flex items-center gap-1">
                    <TooltipButton
                      label="Редактировать"
                      onClick={() => startTagEdit(tag)}
                      className="rounded p-1 text-slate-600 hover:bg-slate-100 hover:text-blue-600"
                    >
                      <Pencil size={14} />
                    </TooltipButton>
                    <TooltipButton
                      label="Удалить"
                      onClick={() => {
                        if (confirm("Удалить тег?"))
                          api.tags.delete(tag.id).then(() => {
                            qc.invalidateQueries({ queryKey: ["tags"] });
                          });
                      }}
                      className="rounded p-1 text-slate-600 hover:bg-slate-100 hover:text-red-600"
                    >
                      <X size={14} />
                    </TooltipButton>
                  </div>
                </div>
              );
            })}
            {allTags.length === 0 && (
              <p className="text-xs text-slate-400">Нет тэгов</p>
            )}
          </div>
        </section>
      )}
      <input
        ref={colorRef}
        type="color"
        value={editHex}
        onChange={(e) => setEditHex(e.target.value)}
        className="sr-only"
      />
    </Sheet>
  );
}
