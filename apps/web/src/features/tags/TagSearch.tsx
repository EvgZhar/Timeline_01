import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { api } from "@/api/client";
import { Search, X } from "lucide-react";
import type { TagDto } from "@timeline/shared";

interface TagSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTagIds: number[];
  mode: "and" | "or";
  onApply: (tagIds: number[], mode: "and" | "or") => void;
  onReset: () => void;
}

function TagPill({
  tag,
  selected,
  onClick,
}: {
  tag: TagDto;
  selected: boolean;
  onClick: () => void;
}) {
  const hex = tag.color.toString(16).padStart(6, "0");
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors"
      style={
        selected
          ? { backgroundColor: `#${hex}`, color: "#fff" }
          : {
              backgroundColor: `#${hex}1A`,
              border: `1px solid #${hex}`,
              color: "#1e293b",
            }
      }
    >
      <span className="inline-block h-3 w-3 shrink-0 overflow-hidden rounded-sm">
        {tag.previewUrl ? (
          <img src={tag.previewUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="block h-full w-full" style={{ backgroundColor: `#${hex}` }} />
        )}
      </span>
      {tag.name}
    </button>
  );
}

export function TagSearch({
  open,
  onOpenChange,
  selectedTagIds,
  mode,
  onApply,
  onReset,
}: TagSearchProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [localTagIds, setLocalTagIds] = useState<number[]>(selectedTagIds);
  const [localMode, setLocalMode] = useState<"and" | "or">(mode);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: allTags = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: () => api.tags.list(),
    enabled: open,
    staleTime: 30000,
  });

  const { data: recentTags = [] } = useQuery({
    queryKey: ["tags", "recent"],
    queryFn: api.tags.recent,
    enabled: open,
  });

  const { data: searchedTags = [] } = useQuery({
    queryKey: ["tags", "search", searchQuery],
    queryFn: () => api.tags.list(searchQuery),
    enabled: open && searchQuery.trim().length > 0,
  });

  useEffect(() => {
    if (open) {
      setLocalTagIds(selectedTagIds);
      setLocalMode(mode);
      setSearchQuery("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, selectedTagIds, mode]);

  const displayTags = (searchQuery.trim() ? searchedTags : recentTags).filter(
    (t) => !localTagIds.includes(t.id),
  );

  const toggleTag = (tagId: number) => {
    setLocalTagIds((ids) =>
      ids.includes(tagId) ? ids.filter((x) => x !== tagId) : [...ids, tagId],
    );
  };

  const handleApply = () => {
    onApply(localTagIds, localMode);
    onOpenChange(false);
  };

  const handleReset = () => {
    onReset();
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={() => onOpenChange(false)}
      />
      <div className="fixed left-1/2 top-24 z-50 w-[420px] max-w-[90vw] -translate-x-1/2 rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-base font-semibold">Поиск по тэгам</h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4">
          {localTagIds.length > 0 && (
            <div className="mb-3">
              <div className="mb-1 text-xs font-medium text-slate-500">
                Активные тэги:
              </div>
              <div className="flex flex-wrap gap-1">
                {allTags
                  .filter((t) => localTagIds.includes(t.id))
                  .map((t) => {
                    const hex = t.color.toString(16).padStart(6, "0");
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleTag(t.id)}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        <span className="inline-block h-3 w-3 shrink-0 overflow-hidden rounded-sm">
                          {t.previewUrl ? (
                            <img src={t.previewUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="block h-full w-full" style={{ backgroundColor: `#${hex}` }} />
                          )}
                        </span>
                        {t.name}
                        <X size={12} />
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          <div className="relative mb-3">
            <Search
              size={16}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              ref={inputRef}
              className="w-full rounded border border-slate-300 py-2 pl-8 pr-3 text-sm outline-none focus:border-blue-400"
              placeholder="Поиск тэгов..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="mb-4 flex flex-wrap gap-1.5">
            {displayTags.map((t) => (
              <TagPill
                key={t.id}
                tag={t}
                selected={localTagIds.includes(t.id)}
                onClick={() => toggleTag(t.id)}
              />
            ))}
            {displayTags.length === 0 && !searchQuery.trim() && (
              <p className="text-xs text-slate-400">Нет недавних тэгов</p>
            )}
            {searchQuery.trim() && searchedTags.length === 0 && (
              <p className="text-xs text-slate-400">Нет совпадений</p>
            )}
          </div>

          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm text-slate-600">Условие:</span>
            <div className="flex overflow-hidden rounded border border-slate-300">
              <button
                type="button"
                className={`px-3 py-1 text-sm transition-colors ${
                  localMode === "and"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
                onClick={() => setLocalMode("and")}
              >
                И
              </button>
              <button
                type="button"
                className={`border-l border-slate-300 px-3 py-1 text-sm transition-colors ${
                  localMode === "or"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                }`}
                onClick={() => setLocalMode("or")}
              >
                Или
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
              disabled={localTagIds.length === 0}
              onClick={handleApply}
            >
              Применить
            </button>
            {selectedTagIds.length > 0 && (
              <button
                type="button"
                className="rounded border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                onClick={handleReset}
              >
                Сбросить
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
