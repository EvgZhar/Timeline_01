import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { Sheet } from "@/components/Sheet";

interface SettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsSheet({ open, onOpenChange }: SettingsSheetProps) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: api.settings.get,
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
    </Sheet>
  );
}
