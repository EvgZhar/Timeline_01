import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/api/client";
import { Sheet } from "@/components/Sheet";

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

  const reorder = async (index: number, dir: -1 | 1) => {
    const ids = timelines.map((t) => t.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    await api.timelines.reorder(ids);
    invalidate();
  };

  const validName = name.trim().length >= 3;

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Временные шкалы">
      <ul className="space-y-2">
        {timelines.map((t, i) => (
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
            <span className="flex-1 text-sm font-medium">{t.name}</span>
            <div className="hidden gap-1 group-hover:flex">
              <button
                type="button"
                className="text-xs text-slate-600 hover:underline"
                onClick={() => reorder(i, -1)}
              >
                Вверх
              </button>
              <button
                type="button"
                className="text-xs text-slate-600 hover:underline"
                onClick={() => reorder(i, 1)}
              >
                Вниз
              </button>
              <button
                type="button"
                className="text-xs text-red-600 hover:underline"
                onClick={() => {
                  if (confirm("Удалить временную шкалу?")) deleteMut.mutate(t.id);
                }}
              >
                🗑
              </button>
            </div>
          </li>
        ))}
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
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!validName || createMut.isPending}
              className="rounded bg-blue-600 px-3 py-1 text-sm text-white disabled:opacity-50"
              onClick={() => createMut.mutate()}
            >
              Сохранить
            </button>
            <button
              type="button"
              className="rounded border px-3 py-1 text-sm"
              onClick={() => setShowForm(false)}
            >
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="mt-4 w-full rounded border border-dashed border-slate-300 py-2 text-sm hover:bg-slate-50"
          onClick={() => setShowForm(true)}
        >
          + Добавить шкалу
        </button>
      )}
    </Sheet>
  );
}
