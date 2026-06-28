import { useMutation, useQueryClient } from "@tanstack/react-query";
import { dependencyTypeLabel, parseDisplay } from "@timeline/shared";
import { Loader, Plus } from "lucide-react";
import { useState } from "react";
import { api } from "@/api/client";
import { DatePickerField } from "@/components/DatePickerField";
import { Dialog } from "@/components/Dialog";
import type { DependencyType } from "@timeline/shared";

interface CreateRelatedEventDialogProps {
  open: boolean;
  onClose: () => void;
  sourceEventId: number;
  sourceEventName: string;
  sourceTimelineIds: number[];
  onCreate: () => void;
  onCreateAndOpen: (id: number) => void;
}

const DEPENDENCY_TYPES: DependencyType[] = ["influences", "influenced_by", "part_of", "contains"];

export function CreateRelatedEventDialog({
  open,
  onClose,
  sourceEventId,
  sourceEventName,
  sourceTimelineIds,
  onCreate,
  onCreateAndOpen,
}: CreateRelatedEventDialogProps) {
  const qc = useQueryClient();
  const [connectionType, setConnectionType] = useState<DependencyType>("influences");
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const valid = name.trim().length > 0 && startDate.trim().length > 0;

  const relatedMut = useMutation({
    mutationFn: async (mode: "create" | "createAndOpen") => {
      const newEvent = await api.events.create({
        name: name.trim(),
        startDate: parseDisplay(startDate),
        endDate: endDate.trim() ? parseDisplay(endDate) : undefined,
        timelineIds: sourceTimelineIds.length > 0 ? sourceTimelineIds : [],
        tagIds: [],
      });
      await api.events.addDependency(sourceEventId, newEvent.id, connectionType);
      return { newEvent, mode };
    },
    onSuccess: ({ newEvent, mode }) => {
      qc.invalidateQueries({ queryKey: ["events"] });
      qc.invalidateQueries({ queryKey: ["event", sourceEventId] });
      setName("");
      setStartDate("");
      setEndDate("");
      setConnectionType("influences");
      if (mode === "createAndOpen") {
        onCreateAndOpen(newEvent.id);
      } else {
        onCreate();
      }
    },
    onError: (err: Error) => {
      alert(err.message);
    },
  });

  const handleClose = () => {
    if (relatedMut.isPending) return;
    setName("");
    setStartDate("");
    setEndDate("");
    setConnectionType("influences");
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && handleClose()}
      title="Создать связанное событие"
      footer={
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleClose}
            className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            Отмена
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => relatedMut.mutate("create")}
              disabled={!valid || relatedMut.isPending}
              className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {relatedMut.isPending ? <Loader size={14} className="animate-spin" /> : <Plus size={14} />}
              Создать
            </button>
            <button
              type="button"
              onClick={() => relatedMut.mutate("createAndOpen")}
              disabled={!valid || relatedMut.isPending}
              className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              Создать и открыть
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-500">
          Будет создано новое событие и связана с &laquo;{sourceEventName}&raquo;
        </p>

        {/* Connection type */}
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">Тип связи</legend>
          <div className="flex flex-wrap gap-2">
            {DEPENDENCY_TYPES.map((t) => (
              <label
                key={t}
                className={`flex cursor-pointer items-center gap-1.5 rounded border px-2.5 py-1.5 text-sm transition-colors ${
                  connectionType === t
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="connectionType"
                  value={t}
                  checked={connectionType === t}
                  onChange={() => setConnectionType(t)}
                  className="sr-only"
                />
                {dependencyTypeLabel(t, false)}
              </label>
            ))}
          </div>
        </fieldset>

        {/* Name */}
        <label className="block text-sm">
          Наименование
          <input
            className="mt-1 w-full rounded border px-2 py-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название события"
            autoFocus
          />
        </label>

        {/* Dates */}
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
      </div>
    </Dialog>
  );
}
