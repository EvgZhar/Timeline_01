import { Router } from "express";
import {
  reorderTimelinesSchema,
  timelineCreateSchema,
  timelineUpdateSchema,
} from "@timeline/shared";
import * as svc from "../services/timelinesService.js";

export const timelinesRouter = Router();

timelinesRouter.get("/", async (_req, res, next) => {
  try {
    res.json(await svc.listTimelines());
  } catch (e) {
    next(e);
  }
});

timelinesRouter.post("/", async (req, res, next) => {
  try {
    const body = timelineCreateSchema.parse(req.body);
    res.status(201).json(await svc.createTimeline(body.name, body.description));
  } catch (e) {
    next(e);
  }
});

timelinesRouter.put("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const body = timelineUpdateSchema.parse(req.body);
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

timelinesRouter.delete("/:id", async (req, res, next) => {
  try {
    const ok = await svc.deleteTimeline(Number(req.params.id));
    if (!ok) {
      res.status(404).json({ error: "Шкала не найдена" });
      return;
    }
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});

timelinesRouter.patch("/:id/visibility", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const visible = Boolean(req.body.visible);
    await svc.setVisibility(id, visible);
    res.json({ id, visible });
  } catch (e) {
    next(e);
  }
});

timelinesRouter.post("/reorder", async (req, res, next) => {
  try {
    const { orderedIds } = reorderTimelinesSchema.parse(req.body);
    await svc.reorderTimelines(orderedIds);
    res.json(await svc.listTimelines());
  } catch (e) {
    next(e);
  }
});
