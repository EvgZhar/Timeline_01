import { Router } from "express";
import {
  reorderTimelinesSchema,
  timelineCreateSchema,
  timelineUpdateSchema,
} from "@timeline/shared";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { timelineTable } from "../db/schema.js";
import * as svc from "../services/timelinesService.js";
import { authenticate } from "../middleware/authenticate.js";
import { checkPermission, getCurrentDataAreaId, getAllowedDataAreaIds } from "../services/permissionService.js";

export const timelinesRouter = Router();

timelinesRouter.get("/", authenticate, async (req, res, next) => {
  try {
    const allowedIds = await getAllowedDataAreaIds(req.user!.userId, "canRead");
    res.json(await svc.listTimelines(req.user!.userId, allowedIds));
  } catch (e) {
    next(e);
  }
});

timelinesRouter.post("/", authenticate, async (req, res, next) => {
  try {
    const body = timelineCreateSchema.parse(req.body);
    const dataAreaId = await getCurrentDataAreaId(req.user!.userId);
    if (!(await checkPermission(req.user!.userId, dataAreaId, "canCreate"))) {
      res.status(403).json({ error: "Нет права на создание в текущей области" });
      return;
    }
    res.status(201).json(await svc.createTimeline(body.name, req.user!.userId, body.description, dataAreaId));
  } catch (e) {
    next(e);
  }
});

timelinesRouter.put("/:id", authenticate, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const body = timelineUpdateSchema.parse(req.body);
    const [existing] = await db.select({ dataAreaId: timelineTable.dataAreaId }).from(timelineTable).where(eq(timelineTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Шкала не найдена" });
      return;
    }
    if (existing.dataAreaId && !(await checkPermission(req.user!.userId, existing.dataAreaId, "canUpdate"))) {
      res.status(403).json({ error: "Нет права на редактирование" });
      return;
    }
    const row = await svc.updateTimeline(id, body);
    if (!row) {
      res.status(404).json({ error: "Шкала не найдена" });
      return;
    }
    res.json(row);
  } catch (e) {
    next(e);
  }
});

timelinesRouter.delete("/:id", authenticate, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db.select({ dataAreaId: timelineTable.dataAreaId }).from(timelineTable).where(eq(timelineTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Шкала не найдена" });
      return;
    }
    if (existing.dataAreaId && !(await checkPermission(req.user!.userId, existing.dataAreaId, "canDelete"))) {
      res.status(403).json({ error: "Нет права на удаление" });
      return;
    }
    const ok = await svc.deleteTimeline(id);
    if (!ok) {
      res.status(404).json({ error: "Шкала не найдена" });
      return;
    }
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

timelinesRouter.patch("/:id/visibility", authenticate, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db.select({ dataAreaId: timelineTable.dataAreaId }).from(timelineTable).where(eq(timelineTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Шкала не найдена" });
      return;
    }
    if (existing.dataAreaId && !(await checkPermission(req.user!.userId, existing.dataAreaId, "canRead"))) {
      res.status(403).json({ error: "Нет доступа к шкале" });
      return;
    }
    const visible = Boolean(req.body.visible);
    await svc.setVisibility(id, req.user!.userId, visible);
    res.json({ id, visible });
  } catch (e) {
    next(e);
  }
});

timelinesRouter.post("/reorder", authenticate, async (req, res, next) => {
  try {
    const { orderedIds } = reorderTimelinesSchema.parse(req.body);
    await svc.reorderTimelines(orderedIds);
    const allowedIds = await getAllowedDataAreaIds(req.user!.userId, "canRead");
    res.json(await svc.listTimelines(req.user!.userId, allowedIds));
  } catch (e) {
    next(e);
  }
});
