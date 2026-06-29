import { Router } from "express";
import { dependencyCreateSchema, dependencyUpdateSchema, eventCreateSchema } from "@timeline/shared";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { eventTable, eventTimelineLink, tagEventLink, tagTable, timelineTable, sysUserTable } from "../db/schema.js";
import * as svc from "../services/eventsService.js";
import { authenticate } from "../middleware/authenticate.js";
import { checkPermission, getCurrentDataAreaId, getAllowedDataAreaIds } from "../services/permissionService.js";
import { generateEventSummary } from "../services/aiService.js";
import * as tagsService from "../services/tagsService.js";

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
        // Check permissions for link changes
        // 1. New timeline links → canCreate on timeline's DataArea
        // 2. Removed timeline links → canDelete on link's DataArea
        // 3. Same for tag links
        const existingTimelineLinks = await db
          .select({ timelineId: eventTimelineLink.timelineId, dataAreaId: eventTimelineLink.dataAreaId })
          .from(eventTimelineLink)
          .where(eq(eventTimelineLink.eventId, id));
        const existingTimelineIds = new Set(existingTimelineLinks.map((l) => l.timelineId));
        const newTimelineIds = body.timelineIds.filter((tid) => !existingTimelineIds.has(tid));
        const removedTimelineIds = existingTimelineLinks.filter((l) => !body.timelineIds.includes(l.timelineId));

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
        for (const link of removedTimelineIds) {
          const [tlRow] = await db
            .select({ dataAreaId: timelineTable.dataAreaId })
            .from(timelineTable)
            .where(eq(timelineTable.id, link.timelineId))
            .limit(1);
          const areaId = link.dataAreaId ?? tlRow?.dataAreaId ?? null;
          if (areaId && !(await checkPermission(req.user!.userId, areaId, "canDelete"))) {
            res.status(403).json({ error: `Нет права на удаление связи с таймлайном ${link.timelineId}` });
            return;
          }
        }

        const existingTagLinks = await db
          .select({ tagId: tagEventLink.tagId, dataAreaId: tagEventLink.dataAreaId })
          .from(tagEventLink)
          .where(eq(tagEventLink.eventId, id));
        const existingTagIds = new Set(existingTagLinks.map((l) => l.tagId));
        const newTagIds = (body.tagIds ?? []).filter((tid) => !existingTagIds.has(tid));
        const removedTagIds = existingTagLinks.filter((l) => !(body.tagIds ?? []).includes(l.tagId));

        for (const tagId of newTagIds) {
          const [tg] = await db
            .select({ dataAreaId: tagTable.dataAreaId })
            .from(tagTable)
            .where(eq(tagTable.id, tagId))
            .limit(1);
          if (tg?.dataAreaId && !(await checkPermission(req.user!.userId, tg.dataAreaId, "canCreate"))) {
            res.status(403).json({ error: `Нет права на привязку тега ${tagId}` });
            return;
          }
        }
        for (const link of removedTagIds) {
          const [tgRow] = await db
            .select({ dataAreaId: tagTable.dataAreaId })
            .from(tagTable)
            .where(eq(tagTable.id, link.tagId))
            .limit(1);
          const areaId = link.dataAreaId ?? tgRow?.dataAreaId ?? null;
          if (areaId && !(await checkPermission(req.user!.userId, areaId, "canDelete"))) {
            res.status(403).json({ error: `Нет права на удаление связи с тегом ${link.tagId}` });
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

// ── AI Summary ──

eventsRouter.post("/:id/ai-summary", authenticate, async (req, res, next) => {
  try {
    const eventId = Number(req.params.id);
    const userId = req.user!.userId;

    const { notes: rawNotes, startDate, endDate } = req.body as {
      notes?: string;
      startDate?: string;
      endDate?: string;
    };

    const [existing] = await db
      .select({
        id: eventTable.id,
        name: eventTable.name,
        dataAreaId: eventTable.dataAreaId,
      })
      .from(eventTable)
      .where(eq(eventTable.id, eventId))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Событие не найдено" });
      return;
    }

    if (existing.dataAreaId && !(await checkPermission(userId, existing.dataAreaId, "canUpdate"))) {
      res.status(403).json({ error: "Нет права на редактирование" });
      return;
    }

    const [user] = await db
      .select({
        aiQuotaTotal: sysUserTable.aiQuotaTotal,
        aiQuotaUsed: sysUserTable.aiQuotaUsed,
      })
      .from(sysUserTable)
      .where(eq(sysUserTable.id, userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "Пользователь не найден" });
      return;
    }

    if (user.aiQuotaUsed >= user.aiQuotaTotal) {
      res.status(403).json({
        error: "Лимит запросов к AI-справке исчерпан",
        remaining: 0,
        total: user.aiQuotaTotal,
      });
      return;
    }

    const allowedIds = await getAllowedDataAreaIds(userId, "canRead");
    const allTags = await tagsService.listTags(undefined, allowedIds);

    const eventTagRows = await db
      .select({ tagId: tagEventLink.tagId })
      .from(tagEventLink)
      .where(eq(tagEventLink.eventId, eventId));
    const eventTagIds = new Set(eventTagRows.map((r) => r.tagId));

    const availableTags = allTags
      .filter((t) => !eventTagIds.has(t.id))
      .map((t) => ({ id: t.id, name: t.name }));

    const options = {
      startDate,
      endDate,
      notes: rawNotes,
      availableTags,
    };

    const result = await generateEventSummary(existing.name, options);

    await db
      .update(sysUserTable)
      .set({ aiQuotaUsed: sql`${sysUserTable.aiQuotaUsed} + 1` })
      .where(eq(sysUserTable.id, userId));

    res.json(result);
  } catch (e) {
    next(e);
  }
});

// ── Event Dependencies ──

eventsRouter.post("/:id/dependencies", authenticate, async (req, res, next) => {
  try {
    const eventId = Number(req.params.id);
    const body = dependencyCreateSchema.parse(req.body);

    const [existing] = await db.select({ dataAreaId: eventTable.dataAreaId }).from(eventTable).where(eq(eventTable.id, eventId)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Событие не найдено" });
      return;
    }
    const [depExists] = await db.select({ id: eventTable.id }).from(eventTable).where(eq(eventTable.id, body.depEventId)).limit(1);
    if (!depExists) {
      res.status(404).json({ error: "Зависимое событие не найдено" });
      return;
    }
    if (eventId === body.depEventId) {
      res.status(400).json({ error: "Событие не может зависеть от самого себя" });
      return;
    }

    const dataAreaId = existing.dataAreaId;
    if (dataAreaId) {
      if (!(await checkPermission(req.user!.userId, dataAreaId, "canUpdate"))) {
        res.status(403).json({ error: "Нет права на редактирование" });
        return;
      }
    }

    const dep = await svc.addDependency(eventId, body, dataAreaId);
    res.status(201).json(dep);
  } catch (e) {
    next(e);
  }
});

eventsRouter.patch("/:id/dependencies/:depId", authenticate, async (req, res, next) => {
  try {
    const eventId = Number(req.params.id);
    const depEventId = Number(req.params.depId);
    const body = dependencyUpdateSchema.parse(req.body);

    const [existing] = await db.select({ dataAreaId: eventTable.dataAreaId }).from(eventTable).where(eq(eventTable.id, eventId)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Событие не найдено" });
      return;
    }
    if (existing.dataAreaId && !(await checkPermission(req.user!.userId, existing.dataAreaId, "canUpdate"))) {
      res.status(403).json({ error: "Нет права на редактирование" });
      return;
    }

    const ok = await svc.updateDependency(eventId, depEventId, body);
    if (!ok) {
      res.status(404).json({ error: "Зависимость не найдена" });
      return;
    }
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

eventsRouter.delete("/:id/dependencies/:depId", authenticate, async (req, res, next) => {
  try {
    const eventId = Number(req.params.id);
    const depEventId = Number(req.params.depId);

    const [existing] = await db.select({ dataAreaId: eventTable.dataAreaId }).from(eventTable).where(eq(eventTable.id, eventId)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Событие не найдено" });
      return;
    }
    if (existing.dataAreaId && !(await checkPermission(req.user!.userId, existing.dataAreaId, "canDelete"))) {
      res.status(403).json({ error: "Нет права на удаление" });
      return;
    }

    const ok = await svc.removeDependency(eventId, depEventId);
    if (!ok) {
      res.status(404).json({ error: "Зависимость не найдена" });
      return;
    }
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});
