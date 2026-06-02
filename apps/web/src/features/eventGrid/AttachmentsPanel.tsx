import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Check, ExternalLink, Plus } from "lucide-react";
import { api } from "@/api/client";
import { TooltipButton } from "@/components/TooltipButton";
import type { DocumentDto } from "@timeline/shared";

interface AttachmentsPanelProps {
  eventId: number;
}

function DocThumbnail({ doc }: { doc: DocumentDto }) {
  const isImage = doc.resourceType === "image" || !doc.resourceType;
  const url = doc.previewUrl ?? doc.originalLink ?? null;

  if (isImage && url) {
    return (
      <img
        src={url}
        alt={doc.description}
        className="h-10 w-10 shrink-0 rounded object-cover"
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-slate-100 text-xs text-slate-400">
      {doc.resourceType ?? "?"}
    </div>
  );
}

export function AttachmentsPanel({ eventId }: AttachmentsPanelProps) {
  const { data: docs = [], refetch: refetchDocs } = useQuery({
    queryKey: ["event-documents", eventId],
    queryFn: () => api.documents.list(eventId),
  });

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

  const [newDocDescription, setNewDocDescription] = useState("");
  const [newDocUrl, setNewDocUrl] = useState("");
  const [newDocType, setNewDocType] = useState("image");

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <h3 className="mb-2 text-sm font-medium text-slate-500">
        Приложения{docs.length > 0 ? ` (${docs.length})` : ""}
      </h3>

      <div className="space-y-2">
        {docs.map((doc) => (
          <div key={doc.documentId} className="flex items-start gap-2 rounded border border-slate-200 p-2">
            <DocThumbnail doc={doc} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{doc.description}</p>
              {doc.originalLink && (
                <p className="truncate text-[10px] text-slate-400">{doc.originalLink}</p>
              )}
            </div>
            {doc.originalLink && (
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
      </div>

      <div className="mt-3 space-y-2 rounded border border-dashed border-slate-300 p-3">
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
            onClick={() => addDocMut.mutate({
              eventId,
              description: newDocDescription,
              originalLink: newDocUrl,
              resourceType: newDocType,
            })}
            disabled={!newDocUrl.trim() || !newDocDescription.trim()}
            className="rounded bg-blue-600 p-2 text-white disabled:opacity-50"
          >
            <Plus size={16} />
          </TooltipButton>
        </div>
      </div>
    </div>
  );
}
