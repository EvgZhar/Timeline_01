import { and, asc, eq, inArray, type SQL } from "drizzle-orm";
import type { EventCreate, EventDto } from "@timeline/shared";
import { db } from "../db/index.js";
import {
  documentEventLink,
  documentTable,
  eventTable,
  eventTimelineLink,
  tagEventLink,
  tagTable,
  timelineTable,
} from "../db/schema.js";
import { getTimelineIdsForEvents } from "./timelinesService.js";

async function loadEventRelations(eventIds: number[]): Promise<{
  timelines: Map<number, { id: number; name: string }[]>;
  tags: Map<number, { id: number; name: string; color: number; previewUrl: string | null; createdDateTime: string }[]>;
  documents: Map<
    number,
    {
      documentId: number;
      description: string;
      originalLink: string | null;
      storageLink: string | null;
      resourceType: string | null;
      isPrimary: boolean;
      createdDateTime: string;
    }[]
  >;
}> {
  const timelines = await getTimelineIdsForEvents(eventIds);

  const tagLinks =
    eventIds.length > 0
      ? await db
          .select({
            eventId: tagEventLink.eventId,
            id: tagTable.id,
            name: tagTable.name,
            color: tagTable.color,
            previewUrl: tagTable.previewUrl,
            createdDateTime: tagTable.createdDateTime,
          })
          .from(tagEventLink)
          .innerJoin(tagTable, eq(tagEventLink.tagId, tagTable.id))
          .where(inArray(tagEventLink.eventId, eventIds))
      : [];

  const docLinks =
    eventIds.length > 0
      ? await db
          .select({
            eventId: documentEventLink.eventId,
            documentId: documentTable.documentId,
            description: documentTable.description,
            originalLink: documentTable.originalLink,
            storageLink: documentTable.storageLink,
            resourceType: documentTable.resourceType,
            isPrimary: documentEventLink.isPrimary,
            createdDateTime: documentTable.createdDateTime,
          })
          .from(documentEventLink)
          .innerJoin(documentTable, eq(documentEventLink.documentId, documentTable.documentId))
          .where(inArray(documentEventLink.eventId, eventIds))
      : [];

  const documents = new Map<number, {
    documentId: number;
    description: string;
    originalLink: string | null;
    storageLink: string | null;
    resourceType: string | null;
    isPrimary: boolean;
    createdDateTime: string;
    eventId: number;
  }[]>();
  for (const d of docLinks) {
    const arr = documents.get(d.eventId) ?? [];
    arr.push({
      eventId: d.eventId,
      documentId: d.documentId,
      description: d.description,
      originalLink: d.originalLink,
      storageLink: d.storageLink,
      resourceType: d.resourceType,
      isPrimary: d.isPrimary,
      createdDateTime: d.createdDateTime?.toISOString() ?? new Date().toISOString(),
    });
    documents.set(d.eventId, arr);
  }

  const tagMap = new Map<number, { id: number; name: string; color: number; previewUrl: string | null; createdDateTime: string }[]>();
  for (const t of tagLinks) {
    const arr = tagMap.get(t.eventId) ?? [];
    arr.push({
      id: t.id,
      name: t.name,
      color: t.color,
      previewUrl: t.previewUrl,
      createdDateTime: t.createdDateTime?.toISOString() ?? new Date().toISOString(),
    });
    tagMap.set(t.eventId, arr);
  }

  return { timelines, tags: tagMap, documents };
}

function toDto(
  row: typeof eventTable.$inferSelect,
  rel: Awaited<ReturnType<typeof loadEventRelations>>,
): EventDto {
  return {
    id: row.id,
    name: row.name,
    startDate: row.startDate,
    endDate: row.endDate ?? row.startDate,
    notes: row.notes,
    dataAreaId: row.dataAreaId,
    createdDateTime: row.createdDateTime?.toISOString() ?? new Date().toISOString(),
    timelines: rel.timelines.get(row.id) ?? [],
    tags: (rel.tags.get(row.id) ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      previewUrl: t.previewUrl ?? undefined,
      createdDateTime: t.createdDateTime,
    })),
    documents: (rel.documents.get(row.id) ?? []).map((d) => ({
      documentId: d.documentId,
      description: d.description,
      originalLink: d.originalLink,
      storageLink: d.storageLink,
      resourceType: d.resourceType,
      isPrimary: d.isPrimary,
      createdDateTime: d.createdDateTime,
      previewUrl:
        d.storageLink && d.resourceType === "image"
          ? `/api/documents/${d.documentId}/preview`
          : d.originalLink ?? undefined,
    })),
  };
}

export async function listEvents(timelineId?: number, allowedDataAreaIds?: number[]): Promise<EventDto[]> {
  let eventIds: number[] | undefined;
  if (timelineId) {
    const links = await db
      .select({ eventId: eventTimelineLink.eventId })
      .from(eventTimelineLink)
      .where(eq(eventTimelineLink.timelineId, timelineId));
    eventIds = links.map((l) => l.eventId);
    if (eventIds.length === 0) return [];
  }

  const conditions: SQL[] = [];

  if (eventIds !== undefined) {
    conditions.push(inArray(eventTable.id, eventIds));
  }

  if (allowedDataAreaIds && allowedDataAreaIds.length > 0) {
    conditions.push(inArray(eventTable.dataAreaId, allowedDataAreaIds));
  }

  const rows = conditions.length > 0
    ? await db.select().from(eventTable).where(and(...conditions)).orderBy(asc(eventTable.startDate))
    : await db.select().from(eventTable).orderBy(asc(eventTable.startDate));

  const ids = rows.map((r) => r.id);
  const rel = await loadEventRelations(ids);
  return rows.map((r) => toDto(r, rel));
}

export async function getEvent(id: number, allowedDataAreaIds?: number[]): Promise<EventDto | null> {
  const [row] = await db.select().from(eventTable).where(eq(eventTable.id, id)).limit(1);
  if (!row) return null;
  if (allowedDataAreaIds && allowedDataAreaIds.length > 0 && row.dataAreaId && !allowedDataAreaIds.includes(row.dataAreaId)) {
    return null;
  }
  const rel = await loadEventRelations([id]);
  return toDto(row, rel);
}

export async function createEvent(data: EventCreate, dataAreaId?: number | null): Promise<EventDto> {
  const endDate = data.endDate ?? data.startDate;
  const [row] = await db
    .insert(eventTable)
    .values({
      name: data.name,
      startDate: data.startDate,
      endDate,
      notes: data.notes ?? null,
      dataAreaId,
    })
    .returning();

  await syncEventLinks(row.id, data);
  return (await getEvent(row.id))!;
}

export async function updateEvent(id: number, data: EventCreate): Promise<EventDto | null> {
  const endDate = data.endDate ?? data.startDate;
  const [existing] = await db
    .select({ dataAreaId: eventTable.dataAreaId })
    .from(eventTable)
    .where(eq(eventTable.id, id))
    .limit(1);
  if (!existing) return null;
  const [row] = await db
    .update(eventTable)
    .set({
      name: data.name,
      startDate: data.startDate,
      endDate,
      notes: data.notes ?? null,
    })
    .where(eq(eventTable.id, id))
    .returning();
  await db.delete(eventTimelineLink).where(eq(eventTimelineLink.eventId, id));
  await db.delete(tagEventLink).where(eq(tagEventLink.eventId, id));
  await syncEventLinks(id, data);
  return getEvent(id);
}

async function syncEventLinks(eventId: number, data: EventCreate): Promise<void> {
  if (data.timelineIds.length > 0) {
    const timelines = await db
      .select({ id: timelineTable.id, dataAreaId: timelineTable.dataAreaId })
      .from(timelineTable)
      .where(inArray(timelineTable.id, data.timelineIds));
    const areaById = new Map(timelines.map((t) => [t.id, t.dataAreaId]));
    for (const timelineId of data.timelineIds) {
      await db.insert(eventTimelineLink).values({ eventId, timelineId, dataAreaId: areaById.get(timelineId) ?? null });
    }
  }
  if ((data.tagIds ?? []).length > 0) {
    const tags = await db
      .select({ id: tagTable.id, dataAreaId: tagTable.dataAreaId })
      .from(tagTable)
      .where(inArray(tagTable.id, data.tagIds!));
    const areaById = new Map(tags.map((t) => [t.id, t.dataAreaId]));
    for (const tagId of data.tagIds!) {
      await db.insert(tagEventLink).values({ eventId, tagId, dataAreaId: areaById.get(tagId) ?? null });
    }
  }
}

export async function deleteEvent(id: number): Promise<boolean> {
  const r = await db.delete(eventTable).where(eq(eventTable.id, id));
  return (r.rowCount ?? 0) > 0;
}
