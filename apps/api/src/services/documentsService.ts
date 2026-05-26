import { eq } from "drizzle-orm";
import { extname } from "node:path";
import type { DocumentDto } from "@timeline/shared";
import { db } from "../db/index.js";
import { documentEventLink, documentTable } from "../db/schema.js";


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
      isPrimary: documentEventLink.isPrimary,
    })
    .from(documentEventLink)
    .innerJoin(documentTable, eq(documentEventLink.documentId, documentTable.documentId))
    .where(eq(documentEventLink.eventId, eventId));

  return Promise.all(
    rows.map(async (r) => ({
      documentId: r.documentId,
      description: r.description,
      originalLink: r.originalLink,
      storageLink: r.storageLink,
      resourceType: r.resourceType,
      isPrimary: r.isPrimary,
      createdDateTime: r.createdDateTime?.toISOString() ?? new Date().toISOString(),
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
  dataAreaId?: number | null,
): Promise<DocumentDto> {
  const [doc] = await db
    .insert(documentTable)
    .values({
      description,
      originalLink,
      resourceType: resourceType ?? "image",
      dataAreaId,
    })
    .returning();

  const count = await countDocumentsForEvent(eventId);
  const isPrimary = count === 0;

  await db.insert(documentEventLink).values({ eventId, documentId: doc.documentId, isPrimary, dataAreaId });

  return {
    documentId: doc.documentId,
    description: doc.description,
    originalLink: doc.originalLink,
    storageLink: doc.storageLink,
    resourceType: doc.resourceType,
    isPrimary,
    createdDateTime: doc.createdDateTime?.toISOString() ?? new Date().toISOString(),
    previewUrl: originalLink,
  };
}

export async function createFromUpload(
  eventId: number,
  description: string,
  _buffer: Buffer,
  filename: string,
  mime?: string,
  dataAreaId?: number | null,
): Promise<DocumentDto> {
  const ext = extname(filename) || ".bin";
  const resourceType = detectType(filename, mime);

  const [doc] = await db
    .insert(documentTable)
    .values({
      description,
      resourceType,
      dataAreaId,
    })
    .returning();
  const count = await countDocumentsForEvent(eventId);
  const isPrimary = count === 0;

  await db.insert(documentEventLink).values({ eventId, documentId: doc.documentId, isPrimary, dataAreaId });

  return {
    documentId: doc.documentId,
    description: doc.description,
    originalLink: doc.originalLink,
    storageLink: doc.storageLink,
    resourceType: doc.resourceType,
    isPrimary,
    createdDateTime: doc.createdDateTime?.toISOString() ?? new Date().toISOString(),
    previewUrl: doc.originalLink ?? undefined,
  };
}

export async function getPreviewUrl(documentId: number): Promise<string | null> {
  const [doc] = await db
    .select()
    .from(documentTable)
    .where(eq(documentTable.documentId, documentId));
  if (!doc) return null;
  return doc.originalLink;
}

export async function setPrimary(documentId: number): Promise<DocumentDto> {
  const [link] = await db
    .select({ eventId: documentEventLink.eventId })
    .from(documentEventLink)
    .where(eq(documentEventLink.documentId, documentId));
  if (!link) throw new Error("Документ не привязан к событию");

  await db
    .update(documentEventLink)
    .set({ isPrimary: false })
    .where(eq(documentEventLink.eventId, link.eventId));
  await db
    .update(documentEventLink)
    .set({ isPrimary: true })
    .where(eq(documentEventLink.documentId, documentId));

  const docs = await listDocuments(link.eventId);
  const updated = docs.find((d) => d.documentId === documentId);
  if (!updated) throw new Error("Документ не найден после обновления");
  return updated;
}

export async function deleteDocument(documentId: number): Promise<boolean> {
  const [link] = await db
    .select({ eventId: documentEventLink.eventId, isPrimary: documentEventLink.isPrimary })
    .from(documentEventLink)
    .where(eq(documentEventLink.documentId, documentId));

  const [doc] = await db
    .select()
    .from(documentTable)
    .where(eq(documentTable.documentId, documentId));
  if (!doc) return false;
  const r = await db.delete(documentTable).where(eq(documentTable.documentId, documentId));
  const wasPrimary = link?.isPrimary;
  const eventId = link?.eventId;
  if (wasPrimary && eventId) {
    const remaining = await listDocuments(eventId);
    if (remaining.length > 0) {
      await setPrimary(remaining[0].documentId);
    }
  }
  return (r.rowCount ?? 0) > 0;
}

export async function countDocumentsForEvent(eventId: number): Promise<number> {
  const rows = await db
    .select()
    .from(documentEventLink)
    .where(eq(documentEventLink.eventId, eventId));
  return rows.length;
}
