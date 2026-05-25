import type {
  DocumentDto,
  EventDto,
  SettingsDto,
  TagDto,
  TimelineDto,
  YandexStatusDto,
} from "@timeline/shared";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  timelines: {
    list: () => request<TimelineDto[]>("/api/timelines"),
    create: (body: { name: string; description?: string }) =>
      request<TimelineDto>("/api/timelines", { method: "POST", body: JSON.stringify(body) }),
    update: (id: number, body: { name?: string; description?: string; iconUrl?: string | null }) =>
      request<TimelineDto>(`/api/timelines/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    delete: (id: number) => request<void>(`/api/timelines/${id}`, { method: "DELETE" }),
    setVisibility: (id: number, visible: boolean) =>
      request<{ id: number; visible: boolean }>(`/api/timelines/${id}/visibility`, {
        method: "PATCH",
        body: JSON.stringify({ visible }),
      }),
    reorder: (orderedIds: number[]) =>
      request<TimelineDto[]>("/api/timelines/reorder", {
        method: "POST",
        body: JSON.stringify({ orderedIds }),
      }),
  },
  events: {
    list: (timelineId?: number) =>
      request<EventDto[]>(
        timelineId ? `/api/events?timelineId=${timelineId}` : "/api/events",
      ),
    get: (id: number) => request<EventDto>(`/api/events/${id}`),
    create: (body: unknown) =>
      request<EventDto>("/api/events", { method: "POST", body: JSON.stringify(body) }),
    update: (id: number, body: unknown) =>
      request<EventDto>(`/api/events/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    delete: (id: number) => request<void>(`/api/events/${id}`, { method: "DELETE" }),
  },
  tags: {
    list: (q?: string) =>
      request<TagDto[]>(q ? `/api/tags?q=${encodeURIComponent(q)}` : "/api/tags"),
    recent: () => request<TagDto[]>("/api/tags/recent"),
    create: (body: { name: string; color: number; previewUrl?: string | null }) =>
      request<TagDto>("/api/tags", { method: "POST", body: JSON.stringify(body) }),
    update: (id: number, body: { name?: string; color?: number; previewUrl?: string | null }) =>
      request<TagDto>(`/api/tags/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    delete: (id: number) => request<void>(`/api/tags/${id}`, { method: "DELETE" }),
  },
  documents: {
    list: (eventId: number) =>
      request<DocumentDto[]>(`/api/documents?eventId=${eventId}`),
    createFromUrl: (body: {
      eventId: number;
      description: string;
      originalLink: string;
      resourceType?: string;
    }) =>
      request<DocumentDto>("/api/documents", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    delete: (id: number) =>
      request<void>(`/api/documents/${id}`, { method: "DELETE" }),
    setPrimary: (id: number) =>
      request<DocumentDto>(`/api/documents/${id}/primary`, { method: "PATCH" }),
  },
  settings: {
    get: () => request<SettingsDto>("/api/settings"),
    put: (settings: Record<string, string | null>) =>
      request<SettingsDto>("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ settings }),
      }),
    yandexStatus: () => request<YandexStatusDto>("/api/settings/yandex/status"),
    testYandex: () =>
      request<{ ok: boolean; folder: string }>("/api/settings/yandex/test", {
        method: "POST",
      }),
  },
};
