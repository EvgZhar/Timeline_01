import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import type { DocumentDto } from "@timeline/shared";
import { db } from "../db/index.js";
import { documentEventLink, documentTable } from "../db/schema.js";
import {
  buildEventFilePath,
  ensureAppFolder,
  getDownloadUrl,
  upload,
  deleteResource,
} from "../integrations/yandex-disk/client.js";
import { isYandexConfigured } from "../services/settings/settingsService.js";

const MIME_MAP: Record<string, string> = {
  ".jpg": "image",
  ".jpeg": "image",
  ".png": "image",
  ".gif": "image",
  ".webp": "image",
  ".pdf": "pdf",
};

function detectType(filename: string, mime?: string): string {
  const ext = extname(filename).toLowerCase();
  if (MIME_MAP[ext]) return MIME_MAP[ext];
  if (mime?.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  return "image";
}

export async function listDocuments(eventId: number): Promise<DocumentDto[]> {
  const rows = await db
    .select({
      documentId: documentTable.documentId,
      description: documentTable.description,
      originalLink: documentTable.originalLink,
      storageLink: documentTable.storageLink,
      resourceType: documentTable.resourceType,
      createdDateTime: documentTable.createdDateTime,
    })
    .from(documentEventLink)
    .innerJoin(documentTable, eq(documentEventLink.documentId, documentTable.documentId))
    .where(eq(documentEventLink.eventId, eventId));

  return Promise.all(
    rows.map(async (r) => ({
      ...r,
      previewUrl:
        r.storageLink && r.resourceType === "image"
          ? `/api/documents/${r.documentId}/preview`
          : r.originalLink ?? undefined,
    })),
  );
}

export async function createFromUrl(
  eventId: number,
  description: string,
  originalLink: string,
  resourceType?: string,
): Promise<DocumentDto> {
  const [doc] = await db
    .insert(documentTable)
    .values({
      description,
      originalLink,
      resourceType: resourceType ?? "image",
    })
    .returning();
  await db.insert(documentEventLink).values({ eventId, documentId: doc.documentId });
  return {
    documentId: doc.documentId,
    description: doc.description,
    originalLink: doc.originalLink,
    storageLink: doc.storageLink,
    resourceType: doc.resourceType,
    createdDateTime: doc.createdDateTime,
    previewUrl: originalLink,
  };
}

export async function createFromUpload(
  eventId: number,
  description: string,
  buffer: Buffer,
  filename: string,
  mime?: string,
): Promise<DocumentDto> {
  if (!(await isYandexConfigured())) {
    throw new Error("Настройте Яндекс.Диск в параметрах");
  }
  await ensureAppFolder();
  const ext = extname(filename) || ".bin";
  const diskPath = await buildEventFilePath(eventId, `${randomUUID()}${ext}`);
  await upload(diskPath, buffer, mime);
  const resourceType = detectType(filename, mime);

  const [doc] = await db
    .insert(documentTable)
    .values({
      description,
      storageLink: diskPath,
      resourceType,
    })
    .returning();
  await db.insert(documentEventLink).values({ eventId, documentId: doc.documentId });

  return {
    documentId: doc.documentId,
    description: doc.description,
    originalLink: doc.originalLink,
    storageLink: doc.storageLink,
    resourceType: doc.resourceType,
    createdDateTime: doc.createdDateTime,
    previewUrl: `/api/documents/${doc.documentId}/preview`,
  };
}

export async function getPreviewUrl(documentId: number): Promise<string | null> {
  const [doc] = await db
    .select()
    .from(documentTable)
    .where(eq(documentTable.documentId, documentId));
  if (!doc) return null;
  if (doc.storageLink) return getDownloadUrl(doc.storageLink);
  return doc.originalLink;
}

export async function deleteDocument(documentId: number): Promise<boolean> {
  const [doc] = await db
    .select()
    .from(documentTable)
    .where(eq(documentTable.documentId, documentId));
  if (!doc) return false;
  if (doc.storageLink) {
    try {
      await deleteResource(doc.storageLink);
    } catch (e) {
      console.warn("Yandex delete failed:", e);
    }
  }
  const r = await db.delete(documentTable).where(eq(documentTable.documentId, documentId));
  return r.changes > 0;
}

export async function countDocumentsForEvent(eventId: number): Promise<number> {
  const rows = await db
    .select()
    .from(documentEventLink)
    .where(eq(documentEventLink.eventId, eventId));
  return rows.length;
}
