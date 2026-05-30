import type { Request } from "express";
import { db } from "../db/index.js";
import { sysAuditLogTable } from "../db/schema.js";

export async function logAudit(
  userId: number | null,
  eventType: string,
  req: Request,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(sysAuditLogTable).values({
      userId,
      eventType,
      ipAddress: req.ip || null,
      userAgent: req.headers["user-agent"] || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });
  } catch (err) {
    console.error("Audit log failed:", err);
  }
}
