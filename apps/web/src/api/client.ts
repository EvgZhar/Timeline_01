import type {
  AuthResponse,
  AuthSettingsDto,
  CreateUserRequest,
  DataAreaDto,
  DependencyType,
  DocumentDto,
  EventDependencyDto,
  EventDto,
  ImportResult,
  LoginRequest,
  RegisterRequest,
  SettingsDto,
  TagDto,
  TimelineDto,
  UserDataAreaDto,
  UserDto,
  ExchangeOAuthCodeResponse,
} from "@timeline/shared";

async function refreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

function dispatchAuthExpired(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("auth:expired"));
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    ...init?.headers as Record<string, string>,
  };

  const res = await fetch(path, { ...init, headers, credentials: "include" });

  if (res.status === 401 && path !== "/api/auth/refresh" && path !== "/api/auth/login") {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const retryRes = await fetch(path, { ...init, headers, credentials: "include" });
      if (!retryRes.ok) {
        const body = await retryRes.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? retryRes.statusText);
      }
      if (retryRes.status === 204) return undefined as T;
      return retryRes.json() as Promise<T>;
    }
    dispatchAuthExpired();
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  auth: {
    login: (body: LoginRequest) =>
      request<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
    register: (body: RegisterRequest) =>
      request<AuthResponse>("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
    logout: () =>
      request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
    me: () => request<UserDto>("/api/auth/me"),
    getSettings: () => request<AuthSettingsDto>("/api/auth/settings"),
    putSettings: (body: { currentDataAreaId: number }) =>
      request<{ ok: boolean }>("/api/auth/settings", { method: "PUT", body: JSON.stringify(body) }),
    verifyEmail: (token: string) =>
      request<{ ok: boolean }>("/api/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) }),
    resendVerification: (email: string) =>
      request<{ ok: boolean }>("/api/auth/resend-verification", { method: "POST", body: JSON.stringify({ email }) }),
    forgotPassword: (email: string) =>
      request<{ ok: boolean }>("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }),
    resetPassword: (token: string, password: string) =>
      request<{ ok: boolean }>("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, password }) }),
    oauthCallback: (provider: string, code: string) =>
      request<{ code: string }>(`/api/auth/oauth/${provider}/callback`, { method: "POST", body: JSON.stringify({ code }) }),
    exchangeOAuthCode: (code: string) =>
      request<ExchangeOAuthCodeResponse>("/api/auth/exchange-oauth-code", { method: "POST", body: JSON.stringify({ code }) }),
    changePassword: (body: { currentPassword: string; newPassword: string }) =>
      request<{ ok: boolean }>("/api/auth/change-password", { method: "POST", body: JSON.stringify(body) }),
    updateProfile: (body: { firstName?: string; lastName?: string }) =>
      request<UserDto>("/api/auth/profile", { method: "PUT", body: JSON.stringify(body) }),
  },
  admin: {
    users: {
      list: () => request<UserDto[]>("/api/admin/users"),
      create: (body: CreateUserRequest) =>
        request<UserDto>("/api/admin/users/create", { method: "POST", body: JSON.stringify(body) }),
      update: (id: number, body: Record<string, unknown>) =>
        request<UserDto>(`/api/admin/users/${id}`, { method: "PUT", body: JSON.stringify(body) }),
      dataAreas: (id: number) => request<number[]>(`/api/admin/users/${id}/data-areas`),
    },
    nextUserCode: () => request<{ code: string; nextSerial: number }>("/api/admin/next-user-code"),
    dataAreas: {
      list: () => request<DataAreaDto[]>("/api/admin/data-areas"),
      create: (body: { name: string; description?: string }) =>
        request<DataAreaDto>("/api/admin/data-areas", { method: "POST", body: JSON.stringify(body) }),
      update: (id: number, body: { name?: string; description?: string | null }) =>
        request<DataAreaDto>(`/api/admin/data-areas/${id}`, { method: "PUT", body: JSON.stringify(body) }),
      delete: (id: number) => request<{ ok: boolean }>(`/api/admin/data-areas/${id}`, { method: "DELETE" }),
      users: (id: number) => request<UserDataAreaDto[]>(`/api/admin/data-areas/${id}/users`),
    },
    userDataArea: {
      set: (body: Record<string, unknown>) =>
        request<{ ok: boolean }>("/api/admin/user-data-area", { method: "POST", body: JSON.stringify(body) }),
      remove: (userId: number, dataAreaId: number) =>
        request<{ ok: boolean }>("/api/admin/user-data-area", {
          method: "DELETE",
          body: JSON.stringify({ userId, dataAreaId }),
        }),
    },
  },
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
    addDependency: (eventId: number, depEventId: number, dependencyType: DependencyType) =>
      request<EventDependencyDto>(`/api/events/${eventId}/dependencies`, {
        method: "POST",
        body: JSON.stringify({ depEventId, dependencyType }),
      }),
    updateDependency: (eventId: number, depEventId: number, dependencyType: DependencyType) =>
      request<void>(`/api/events/${eventId}/dependencies/${depEventId}`, {
        method: "PATCH",
        body: JSON.stringify({ dependencyType }),
      }),
    removeDependency: (eventId: number, depEventId: number) =>
      request<void>(`/api/events/${eventId}/dependencies/${depEventId}`, { method: "DELETE" }),
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
  },
  pdfExport: {
    exportPdf: async (
      events: unknown[],
      timelines: unknown[],
      visibleTimelineIds: number[],
      timelineSvg?: string,
      documentImages?: Record<number, string>,
    ) => {
      const body = JSON.stringify({ events, timelines, visibleTimelineIds, timelineSvg, documentImages });
      const res = await fetch("/api/pdf/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body,
      });
      if (res.status === 401) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          const retryRes = await fetch("/api/pdf/export", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body });
          if (!retryRes.ok) throw new Error("Ошибка экспорта PDF");
          const blob = await retryRes.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `timeline-export-${Date.now()}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
          return;
        }
        dispatchAuthExpired();
        throw new Error("Сессия истекла");
      }
      if (!res.ok) throw new Error("Ошибка экспорта PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `timeline-export-${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    },
  },
  importExport: {
    exportXlsx: async (filters?: {
      tagFilterIds?: number[];
      tagFilterMode?: "and" | "or";
      textSearchQuery?: string;
      textSearchMode?: "name" | "nameAndNotes";
    }) => {
      const qp = new URLSearchParams();
      if (filters?.tagFilterIds?.length) qp.set("tagFilterIds", filters.tagFilterIds.join(","));
      if (filters?.tagFilterMode) qp.set("tagFilterMode", filters.tagFilterMode);
      if (filters?.textSearchQuery) qp.set("textSearchQuery", filters.textSearchQuery);
      if (filters?.textSearchMode) qp.set("textSearchMode", filters.textSearchMode);
      const qs = qp.toString();
      const url = qs ? `/api/import-export/export?${qs}` : "/api/import-export/export";

      async function doFetch(): Promise<Response> {
        const res = await fetch(url, { credentials: "include" });
        if (res.status === 401) {
          const refreshed = await refreshAccessToken();
          if (refreshed) return fetch(url, { credentials: "include" });
        }
        return res;
      }

      const res = await doFetch();
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? res.statusText);
      }
      const blob = await res.blob();
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = `timeline-export-${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(dlUrl);
    },
    importXlsx: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return request<ImportResult>("/api/import-export/import", {
        method: "POST",
        body: formData,
        headers: {},
      });
    },
  },
};
