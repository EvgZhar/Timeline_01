import { Router } from "express";
import { eventCreateSchema } from "@timeline/shared";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { eventTable, eventTimelineLink, timelineTable } from "../db/schema.js";
import * as svc from "../services/eventsService.js";
import { authenticate } from "../middleware/authenticate.js";
import { checkPermission, getCurrentDataAreaId, getAllowedDataAreaIds } from "../services/permissionService.js";

export const eventsRouter = Router();

eventsRouter.get("/", authenticate, async (req, res, next) => {
  try {
    const timelineId = req.query.timelineId
      ? Number(req.query.timelineId)
      : undefined;
    const allowedIds = await getAllowedDataAreaIds(req.user!.userId, "canRead");
    res.json(await svc.listEvents(timelineId, allowedIds));
  } catch (e) {
    next(e);
  }
});

eventsRouter.get("/:id", authenticate, async (req, res, next) => {
  try {
    const allowedIds = await getAllowedDataAreaIds(req.user!.userId, "canRead");
    const row = await svc.getEvent(Number(req.params.id), allowedIds);
    if (!row) {
      res.status(404).json({ error: "Событие не найдено" });
      return;
    }
    res.json(row);
  } catch (e) {
    next(e);
  }
});

eventsRouter.post("/", authenticate, async (req, res, next) => {
  try {
    const body = eventCreateSchema.parse(req.body);
    const dataAreaId = await getCurrentDataAreaId(req.user!.userId);
    if (!(await checkPermission(req.user!.userId, dataAreaId, "canCreate"))) {
      res.status(403).json({ error: "Нет права на создание в текущей области" });
      return;
    }
    res.status(201).json(await svc.createEvent(body, dataAreaId));
  } catch (e) {
    next(e);
  }
});

eventsRouter.put("/:id", authenticate, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const body = eventCreateSchema.parse(req.body);
    const [existing] = await db
      .select({
        id: eventTable.id,
        dataAreaId: eventTable.dataAreaId,
        name: eventTable.name,
        startDate: eventTable.startDate,
        endDate: eventTable.endDate,
        notes: eventTable.notes,
      })
      .from(eventTable)
      .where(eq(eventTable.id, id))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Событие не найдено" });
      return;
    }
    if (existing.dataAreaId) {
      const endDate = body.endDate ?? body.startDate;
      const fieldsChanged =
        existing.name !== body.name ||
        existing.startDate !== body.startDate ||
        (existing.endDate ?? existing.startDate) !== endDate ||
        (existing.notes ?? null) !== (body.notes ?? null);
      if (fieldsChanged) {
        if (!(await checkPermission(req.user!.userId, existing.dataAreaId, "canUpdate"))) {
          res.status(403).json({ error: "Нет права на редактирование" });
          return;
        }
      } else {
        if (!(await checkPermission(req.user!.userId, existing.dataAreaId, "canRead"))) {
          res.status(404).json({ error: "Событие не найдено" });
          return;
        }
        // Find which timelines are newly being linked (not already linked)
        const existingLinks = await db
          .select({ timelineId: eventTimelineLink.timelineId })
          .from(eventTimelineLink)
          .where(and(eq(eventTimelineLink.eventId, id), inArray(eventTimelineLink.timelineId, body.timelineIds)));
        const alreadyLinked = new Set(existingLinks.map((l) => l.timelineId));
        const newTimelineIds = body.timelineIds.filter((tid) => !alreadyLinked.has(tid));
        for (const timelineId of newTimelineIds) {
          const [tl] = await db
            .select({ dataAreaId: timelineTable.dataAreaId })
            .from(timelineTable)
            .where(eq(timelineTable.id, timelineId))
            .limit(1);
          if (tl?.dataAreaId && !(await checkPermission(req.user!.userId, tl.dataAreaId, "canCreate"))) {
            res.status(403).json({ error: `Нет права на привязку к таймлайну ${timelineId}` });
            return;
          }
        }
      }
    }
    const row = await svc.updateEvent(id, body);
    if (!row) {
      res.status(404).json({ error: "Событие не найдено" });
      return;
    }
    res.json(row);
  } catch (e) {
    next(e);
  }
});

eventsRouter.delete("/:id", authenticate, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db.select({ dataAreaId: eventTable.dataAreaId }).from(eventTable).where(eq(eventTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Событие не найдено" });
      return;
    }
    if (existing.dataAreaId && !(await checkPermission(req.user!.userId, existing.dataAreaId, "canDelete"))) {
      res.status(403).json({ error: "Нет права на удаление" });
      return;
    }
    const ok = await svc.deleteEvent(id);
    if (!ok) {
      res.status(404).json({ error: "Событие не найдено" });
      return;
    }
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});
