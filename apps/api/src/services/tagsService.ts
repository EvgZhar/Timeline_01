import { desc, eq, like, sql } from "drizzle-orm";
import type { TagDto } from "@timeline/shared";
import { db } from "../db/index.js";
import { tagEventLink, tagTable } from "../db/schema.js";

function toDto(row: typeof tagTable.$inferSelect): TagDto {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    previewUrl: row.previewUrl ?? undefined,
    createdDateTime: row.createdDateTime,
  };
}

export async function listTags(q?: string): Promise<TagDto[]> {
  const rows = q
    ? await db
        .select()
        .from(tagTable)
        .where(like(tagTable.name, `%${q}%`))
        .orderBy(tagTable.name)
    : await db.select().from(tagTable).orderBy(tagTable.name);
  return rows.map(toDto);
}

export async function createTag(name: string, color: number, previewUrl?: string): Promise<TagDto> {
  const [row] = await db.insert(tagTable).values({ name, color, previewUrl }).returning();
  return toDto(row);
}

export async function updateTag(
  id: number,
  data: { name?: string; color?: number; previewUrl?: string | null },
): Promise<TagDto> {
  const values: Record<string, unknown> = {};
  if (data.name !== undefined) values.name = data.name;
  if (data.color !== undefined) values.color = data.color;
  if (data.previewUrl !== undefined) values.previewUrl = data.previewUrl;
  const [row] = await db.update(tagTable).set(values).where(eq(tagTable.id, id)).returning();
  return toDto(row);
}

export async function deleteTag(id: number): Promise<void> {
  await db.delete(tagTable).where(eq(tagTable.id, id));
}

export async function getRecentTags(): Promise<TagDto[]> {
  const rows = await db
    .select({
      id: tagTable.id,
      name: tagTable.name,
      color: tagTable.color,
      previewUrl: tagTable.previewUrl,
      createdDateTime: tagTable.createdDateTime,
      lastUsed: sql<string>`max(${tagEventLink.createdDateTime})`.as("lastUsed"),
    })
    .from(tagEventLink)
    .innerJoin(tagTable, eq(tagEventLink.tagId, tagTable.id))
    .groupBy(tagTable.id)
    .orderBy(desc(sql`lastUsed`))
    .limit(12);
  return rows.map(toDto);
}
