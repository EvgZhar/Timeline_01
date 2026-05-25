import { getSecret, getYandexBaseFolder } from "../../services/settings/settingsService.js";

const API_BASE = "https://cloud-api.yandex.net/v1/disk";

export class YandexDiskError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function getToken(): Promise<string> {
  const token = await getSecret("yandex.oauthToken");
  if (!token) throw new YandexDiskError("Яндекс.Диск не настроен", 503);
  return token;
}

async function yandexFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `OAuth ${token}`,
      Accept: "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new YandexDiskError(text || res.statusText, res.status);
  }
  return res;
}

export async function getDiskInfo(): Promise<{ total_space: number; used_space: number }> {
  const res = await yandexFetch("");
  return res.json() as Promise<{ total_space: number; used_space: number }>;
}

export async function ensureFolder(path: string): Promise<void> {
  const encoded = encodeURIComponent(path);
  const check = await fetch(`${API_BASE}/resources?path=${encoded}`, {
    headers: { Authorization: `OAuth ${await getToken()}`, Accept: "application/json" },
  });
  if (check.ok) return;
  if (check.status !== 404) {
    const text = await check.text();
    throw new YandexDiskError(text, check.status);
  }
  await yandexFetch(`/resources?path=${encoded}`, { method: "PUT" });
}

export async function upload(path: string, body: Buffer, contentType?: string): Promise<void> {
  const encoded = encodeURIComponent(path);
  const res = await yandexFetch(`/resources/upload?path=${encoded}&overwrite=true`);
  const { href, method } = (await res.json()) as { href: string; method: string };
  const put = await fetch(href, {
    method: method || "PUT",
    body: body as unknown as BodyInit,
    headers: contentType ? { "Content-Type": contentType } : undefined,
  });
  if (!put.ok) throw new YandexDiskError("Upload failed", put.status);
}

export async function getDownloadUrl(path: string): Promise<string> {
  const encoded = encodeURIComponent(path);
  const res = await yandexFetch(`/resources/download?path=${encoded}`);
  const { href } = (await res.json()) as { href: string };
  return href;
}

export async function deleteResource(path: string): Promise<void> {
  const encoded = encodeURIComponent(path);
  await yandexFetch(`/resources?path=${encoded}&permanently=true`, { method: "DELETE" });
}

export function buildEventFilePath(eventId: number, filename: string): Promise<string> {
  return getYandexBaseFolder().then((base) => {
    const folder = base.endsWith("/") ? base : `${base}/`;
    return `${folder}events/${eventId}/${filename}`;
  });
}

export async function ensureAppFolder(): Promise<string> {
  const base = await getYandexBaseFolder();
  await ensureFolder(base);
  return base;
}
