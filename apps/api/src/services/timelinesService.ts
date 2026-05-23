import { asc, eq, inArray, sql } from "drizzle-orm";
import type { TimelineDto } from "@timeline/shared";
import { db } from "../db/index.js";
import { eventTimelineLink, timelineTable, userPreferences } from "../db/schema.js";

export async function listTimelines(): Promise<TimelineDto[]> {
  const timelines = await db
    .select()
    .from(timelineTable)
    .orderBy(asc(timelineTable.sortIndex), asc(timelineTable.id));

  const prefs = await db.select().from(userPreferences);
  const prefMap = new Map(prefs.map((p) => [p.timelineId, p.visible]));

  return timelines.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    iconUrl: t.iconUrl,
    sortIndex: t.sortIndex ?? 0,
    visible: prefMap.get(t.id) ?? true,
    createdDateTime: t.createdDateTime,
  }));
}

export async function createTimeline(name: string, description?: string): Promise<TimelineDto> {
  const [maxRow] = await db
    .select({ m: sql<number>`coalesce(max(${timelineTable.sortIndex}), -1)` })
    .from(timelineTable);
  const sortIndex = (maxRow?.m ?? -1) + 1;

  const [row] = await db
    .insert(timelineTable)
    .values({ name, description: description ?? null, sortIndex })
    .returning();

  await db.insert(userPreferences).values({ timelineId: row.id, visible: true });

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    iconUrl: row.iconUrl,
    sortIndex: row.sortIndex ?? 0,
    visible: true,
    createdDateTime: row.createdDateTime,
  };
}

export async function updateTimeline(
  id: number,
  data: { name?: string; description?: string; iconUrl?: string | null },
): Promise<TimelineDto | null> {
  const [row] = await db
    .update(timelineTable)
    .set(data)
    .where(eq(timelineTable.id, id))
    .returning();
  if (!row) return null;
  const list = await listTimelines();
  return list.find((t) => t.id === id) ?? null;
}

export async function deleteTimeline(id: number): Promise<boolean> {
  const r = await db.delete(timelineTable).where(eq(timelineTable.id, id));
  return r.changes > 0;
}

export async function setVisibility(id: number, visible: boolean): Promise<void> {
  const [existing] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.timelineId, id));
  if (existing) {
    await db
      .update(userPreferences)
      .set({ visible })
      .where(eq(userPreferences.timelineId, id));
  } else {
    await db.insert(userPreferences).values({ timelineId: id, visible });
  }
}

export async function reorderTimelines(orderedIds: number[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(timelineTable)
      .set({ sortIndex: i })
      .where(eq(timelineTable.id, orderedIds[i]));
  }
}

export async function getTimelineIdsForEvents(eventIds: number[]) {
  if (eventIds.length === 0) return new Map<number, { id: number; name: string }[]>();
  const links = await db
    .select({
      eventId: eventTimelineLink.eventId,
      id: timelineTable.id,
      name: timelineTable.name,
    })
    .from(eventTimelineLink)
    .innerJoin(timelineTable, eq(eventTimelineLink.timelineId, timelineTable.id))
    .where(inArray(eventTimelineLink.eventId, eventIds));

  const map = new Map<number, { id: number; name: string }[]>();
  for (const l of links) {
    const arr = map.get(l.eventId) ?? [];
    arr.push({ id: l.id, name: l.name });
    map.set(l.eventId, arr);
  }
  return map;
}
