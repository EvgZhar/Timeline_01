import { desc, eq, like, sql } from "drizzle-orm";
import type { TagDto } from "@timeline/shared";
import { db } from "../db/index.js";
import { tagEventLink, tagTable } from "../db/schema.js";

export async function listTags(q?: string): Promise<TagDto[]> {
  const rows = q
    ? await db
        .select()
        .from(tagTable)
        .where(like(tagTable.name, `%${q}%`))
        .orderBy(tagTable.name)
    : await db.select().from(tagTable).orderBy(tagTable.name);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    createdDateTime: r.createdDateTime,
  }));
}

export async function createTag(name: string, color: number): Promise<TagDto> {
  const [row] = await db.insert(tagTable).values({ name, color }).returning();
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdDateTime: row.createdDateTime,
  };
}

export async function getRecentTags(): Promise<TagDto[]> {
  const rows = await db
    .select({
      id: tagTable.id,
      name: tagTable.name,
      color: tagTable.color,
      createdDateTime: tagTable.createdDateTime,
      lastUsed: sql<string>`max(${tagEventLink.createdDateTime})`.as("lastUsed"),
    })
    .from(tagEventLink)
    .innerJoin(tagTable, eq(tagEventLink.tagId, tagTable.id))
    .groupBy(tagTable.id)
    .orderBy(desc(sql`lastUsed`))
    .limit(12);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    createdDateTime: r.createdDateTime,
  }));
}
