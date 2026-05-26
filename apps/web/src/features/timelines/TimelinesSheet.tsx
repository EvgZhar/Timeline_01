import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowDown, ArrowUp, Check, ImageOff, Link2, Pencil, Plus, Trash2, X } from "lucide-react";
import { api } from "@/api/client";
import { Sheet } from "@/components/Sheet";
import { TooltipButton } from "@/components/TooltipButton";

interface TimelinesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TimelinesSheet({ open, onOpenChange }: TimelinesSheetProps) {
  const qc = useQueryClient();
  const { data: timelines = [] } = useQuery({
    queryKey: ["timelines"],
    queryFn: api.timelines.list,
    enabled: open,
  });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editIconUrl, setEditIconUrl] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["timelines"] });
    qc.invalidateQueries({ queryKey: ["events"] });
  };

  const createMut = useMutation({
    mutationFn: () => api.timelines.create({ name, description: description || undefined }),
    onSuccess: () => {
      setName("");
      setDescription("");
      setShowForm(false);
      invalidate();
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.timelines.delete(id),
    onSuccess: invalidate,
  });

  const visibilityMut = useMutation({
    mutationFn: ({ id, visible }: { id: number; visible: boolean }) =>
      api.timelines.setVisibility(id, visible),
    onSuccess: invalidate,
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; iconUrl?: string | null } }) =>
      api.timelines.update(id, data),
    onSuccess: () => {
      setEditingId(null);
      invalidate();
    },
    onError: (err: Error) => {
      alert("Ошибка сохранения: " + err.message);
    },
  });

  const reorder = async (index: number, dir: -1 | 1) => {
    const ids = timelines.map((t) => t.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    await api.timelines.reorder(ids);
    invalidate();
  };

  const startEdit = (t: typeof timelines[number]) => {
    setEditingId(t.id);
    setEditName(t.name);
    setEditIconUrl(t.iconUrl);
  };

  const validName = name.trim().length >= 3;
  const validEditName = editName.trim().length >= 3;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Временные шкалы">
      <ul className="space-y-2">
        {timelines.map((t, i) => {
          const isEditing = editingId === t.id;

          return (
            <li
              key={t.id}
              className="group flex items-center gap-2 rounded border border-slate-200 p-2 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={t.visible}
                onChange={(e) =>
                  visibilityMut.mutate({ id: t.id, visible: e.target.checked })
                }
              />

              {isEditing ? (
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    {/* Icon preview */}
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded border bg-slate-100"
                      title="Preview"
                    >
                      {editIconUrl ? (
                        <img src={editIconUrl} alt="" className="h-full w-full object-contain" />
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </div>
                    <input
                      className="flex-1 rounded border px-2 py-1 text-sm"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                      placeholder="Название шкалы"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && validEditName) {
                          updateMut.mutate({ id: t.id, data: { name: editName.trim(), iconUrl: editIconUrl } });
                        }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <div className="flex items-center gap-1">
                      {editIconUrl && (
                        <TooltipButton
                          label="Удалить иконку"
                          onClick={() => setEditIconUrl(null)}
                          className="rounded p-1 text-slate-600 hover:bg-slate-100 hover:text-red-600"
                        >
                          <ImageOff size={14} />
                        </TooltipButton>
                      )}
                      <TooltipButton
                        label="Сохранить"
                        onClick={() =>
                          updateMut.mutate({ id: t.id, data: { name: editName.trim(), iconUrl: editIconUrl } })
                        }
                        disabled={!validEditName}
                        className="rounded p-1 text-slate-600 hover:bg-slate-100 hover:text-blue-600 disabled:opacity-50"
                      >
                        <Check size={14} />
                      </TooltipButton>
                      <TooltipButton
                        label="Отмена"
                        onClick={() => setEditingId(null)}
                        className="rounded p-1 text-slate-600 hover:bg-slate-100"
                      >
                        <X size={14} />
                      </TooltipButton>
                    </div>
                  </div>
                  {/* Icon URL input */}
                  <div className="flex items-center gap-1">
                    <Link2 size={14} className="shrink-0 text-slate-400" />
                    <input
                      className="flex-1 rounded border px-2 py-0.5 text-xs"
                      placeholder="https://example.com/icon.png"
                      value={editIconUrl ?? ""}
                      onChange={(e) => setEditIconUrl(e.target.value || null)}
                    />
                  </div>
                </div>
              ) : (
                <>
                  {/* Icon preview */}
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded border bg-slate-100"
                    title={t.iconUrl ? "Иконка шкалы" : "Нет иконки"}
                  >
                    {t.iconUrl ? (
                      <img src={t.iconUrl} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </div>

                  <span className="flex-1 text-sm font-medium">{t.name}</span>

                  <div className="hidden items-center gap-1 group-hover:flex">
                    <TooltipButton
                      label="Редактировать"
                      onClick={() => startEdit(t)}
                      className="rounded p-1 text-slate-600 hover:bg-slate-100 hover:text-blue-600"
                    >
                      <Pencil size={14} />
                    </TooltipButton>
                    <TooltipButton
                      label="Вверх"
                      onClick={() => reorder(i, -1)}
                      className="rounded p-1 text-slate-600 hover:bg-slate-100"
                    >
                      <ArrowUp size={14} />
                    </TooltipButton>
                    <TooltipButton
                      label="Вниз"
                      onClick={() => reorder(i, 1)}
                      className="rounded p-1 text-slate-600 hover:bg-slate-100"
                    >
                      <ArrowDown size={14} />
                    </TooltipButton>
                    <TooltipButton
                      label="Удалить"
                      onClick={() => {
                        if (confirm("Удалить временную шкалу?")) deleteMut.mutate(t.id);
                      }}
                      className="rounded p-1 text-slate-600 hover:bg-slate-100 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </TooltipButton>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>

      {showForm ? (
        <div className="mt-4 space-y-2 rounded border border-slate-200 p-3">
          <input
            className="w-full rounded border px-2 py-1 text-sm"
            placeholder="Наименование (≥3 символов)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <textarea
            className="w-full rounded border px-2 py-1 text-sm"
            placeholder="Описание"
            maxLength={255}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <TooltipButton
              label="Сохранить"
              onClick={() => createMut.mutate()}
              disabled={!validName || createMut.isPending}
              className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-50"
            >
              <Check size={16} />
            </TooltipButton>
            <TooltipButton
              label="Отмена"
              onClick={() => setShowForm(false)}
              className="rounded border px-3 py-1"
            >
              <X size={16} />
            </TooltipButton>
          </div>
        </div>
      ) : (
        <TooltipButton
          label="Добавить шкалу"
          onClick={() => setShowForm(true)}
          className="mt-4 flex w-full items-center justify-center rounded border border-dashed border-slate-300 py-2 hover:bg-slate-50"
        >
          <Plus size={16} />
        </TooltipButton>
      )}
    </Sheet>
  );
}
