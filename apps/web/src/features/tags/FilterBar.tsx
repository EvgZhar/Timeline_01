import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Search, X } from "lucide-react";

interface FilterBarProps {
  tagFilterIds: number[];
  tagFilterMode: "and" | "or";
  onRemoveTag: (tagId: number) => void;
  onReset: () => void;
  onSearch: () => void;
}

export function FilterBar({
  tagFilterIds,
  tagFilterMode,
  onRemoveTag,
  onReset,
  onSearch,
}: FilterBarProps) {
  const { data: allTags = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: () => api.tags.list(),
    staleTime: 30000,
  });

  if (tagFilterIds.length === 0) return null;

  return (
    <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/80 px-4 py-1.5">
      <button
        type="button"
        onClick={onSearch}
        className="rounded p-1 text-slate-500 hover:bg-slate-200"
        title="Редактировать фильтр"
      >
        <Search size={16} />
      </button>

      <span className="text-xs font-medium text-slate-500">Активные тэги:</span>

      <div className="flex flex-wrap gap-1">
        {allTags
          .filter((t) => tagFilterIds.includes(t.id))
          .map((t) => {
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
                <button
                  type="button"
                  onClick={() => onRemoveTag(t.id)}
                  className="hover:opacity-70"
                >
                  <X size={12} />
                </button>
              </span>
            );
          })}
      </div>

      <span className="text-xs text-slate-400">
        {tagFilterMode === "and" ? "И" : "Или"}
      </span>

      <button
        type="button"
        onClick={onReset}
        className="ml-auto rounded px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
      >
        <span className="flex items-center gap-1">
          <X size={12} />
          Сбросить
        </span>
      </button>
    </div>
  );
}
