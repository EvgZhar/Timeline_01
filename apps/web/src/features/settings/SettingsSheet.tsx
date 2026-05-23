import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDisplay } from "@timeline/shared";
import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { Sheet } from "@/components/Sheet";
import type { ViewRange } from "@/features/timeline/timeScale";

interface SettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  savedViewRange?: ViewRange | null;
  savedTagFilterIds?: number[];
  savedTagFilterMode?: "and" | "or";
  onClearSettings?: () => void;
}

function msToDisplay(ms: number): string {
  const d = new Date(ms);
  const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  return formatDisplay(iso);
}

export function SettingsSheet({
  open,
  onOpenChange,
  savedViewRange,
  savedTagFilterIds,
  savedTagFilterMode,
  onClearSettings,
}: SettingsSheetProps) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: api.settings.get,
    enabled: open,
  });
  const { data: allTimelines = [] } = useQuery({
    queryKey: ["timelines"],
    queryFn: api.timelines.list,
    enabled: open,
  });
  const [token, setToken] = useState("");
  const [baseFolder, setBaseFolder] = useState("app:/timeline/");
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    if (data?.settings) {
      const bf = data.settings["yandex.baseFolder"];
      if (typeof bf === "string") setBaseFolder(bf);
    }
  }, [data]);

  const saveMut = useMutation({
    mutationFn: () =>
      api.settings.put({
        ...(token.trim() ? { "yandex.oauthToken": token.trim() } : {}),
        "yandex.baseFolder": baseFolder,
      }),
    onSuccess: () => {
      setToken("");
      qc.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  const testMut = useMutation({
    mutationFn: api.settings.testYandex,
    onSuccess: (r) => setTestResult(`OK: ${r.folder}`),
    onError: (e: Error) => setTestResult(`Ошибка: ${e.message}`),
  });

  const tokenConfigured =
    data?.settings["yandex.oauthToken"] &&
    typeof data.settings["yandex.oauthToken"] === "object";

  const visibleTimelinesCount = allTimelines.filter((t) => t.visible).length;

  const hasSavedSettings = Boolean(
    savedViewRange || (savedTagFilterIds && savedTagFilterIds.length > 0),
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange} side="right" title="Настройки">
      <section className="space-y-4">
        <h3 className="font-medium">Яндекс.Диск</h3>
        <p className="text-xs text-slate-500">
          OAuth-токен с правами cloud_api:disk.read и cloud_api:disk.write
        </p>
        <label className="block text-sm">
          OAuth-токен
          <input
            type="password"
            className="mt-1 w-full rounded border px-2 py-1"
            placeholder={tokenConfigured ? "•••••••• (задан)" : "Вставьте токен"}
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Папка на Диске
          <input
            className="mt-1 w-full rounded border px-2 py-1"
            value={baseFolder}
            onChange={(e) => setBaseFolder(e.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded bg-blue-600 px-3 py-1 text-sm text-white"
            onClick={() => saveMut.mutate()}
          >
            Сохранить
          </button>
          <button
            type="button"
            className="rounded border px-3 py-1 text-sm"
            onClick={() => testMut.mutate()}
          >
            Проверить подключение
          </button>
        </div>
        {testResult && <p className="text-sm text-slate-600">{testResult}</p>}
      </section>

      <hr className="my-4 border-slate-200" />

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

        {hasSavedSettings && onClearSettings && (
          <button
            type="button"
            className="rounded border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
            onClick={onClearSettings}
          >
            Очистить сохранённые настройки
          </button>
        )}
      </section>
    </Sheet>
  );
}
