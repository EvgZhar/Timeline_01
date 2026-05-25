import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { sysUserDataArea, sysUserSettingsTable, sysUserTable } from "../db/schema.js";

type Action = "canRead" | "canCreate" | "canUpdate" | "canDelete";

export async function getAllowedDataAreaIds(userId: number, action?: Action): Promise<number[]> {
  const conditions = [eq(sysUserDataArea.userId, userId)];
  if (action) {
    conditions.push(eq(sysUserDataArea[action], true));
  }

  const rows = await db
    .select({ dataAreaId: sysUserDataArea.dataAreaId })
    .from(sysUserDataArea)
    .where(and(...conditions));
  return rows.map((r) => r.dataAreaId);
}

export async function checkPermission(
  userId: number,
  dataAreaId: number,
  action: Action,
): Promise<boolean> {
  const [row] = await db
    .select()
    .from(sysUserDataArea)
    .where(and(
      eq(sysUserDataArea.userId, userId),
      eq(sysUserDataArea.dataAreaId, dataAreaId),
      eq(sysUserDataArea[action], true),
    ))
    .limit(1);
  return !!row;
}

export async function getCurrentDataAreaId(userId: number): Promise<number> {
  const [settings] = await db
    .select()
    .from(sysUserSettingsTable)
    .where(eq(sysUserSettingsTable.userId, userId))
    .limit(1);

  if (settings?.currentDataAreaId) return settings.currentDataAreaId;

  const [user] = await db
    .select()
    .from(sysUserTable)
    .where(eq(sysUserTable.id, userId))
    .limit(1);

  return user?.defaultDataAreaId ?? 0;
}

export async function getUserIdsWithAccess(dataAreaId: number): Promise<number[]> {
  const rows = await db
    .select({ userId: sysUserDataArea.userId })
    .from(sysUserDataArea)
    .where(eq(sysUserDataArea.dataAreaId, dataAreaId));
  return rows.map((r) => r.userId);
}
