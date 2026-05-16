import { Router } from "express";
import { eventCreateSchema } from "@timeline/shared";
import * as svc from "../services/eventsService.js";

export const eventsRouter = Router();

eventsRouter.get("/", async (req, res, next) => {
  try {
    const timelineId = req.query.timelineId
      ? Number(req.query.timelineId)
      : undefined;
    res.json(await svc.listEvents(timelineId));
  } catch (e) {
    next(e);
  }
});

eventsRouter.get("/:id", async (req, res, next) => {
  try {
    const row = await svc.getEvent(Number(req.params.id));
    if (!row) {
      res.status(404).json({ error: "Событие не найдено" });
      return;
    }
    res.json(row);
  } catch (e) {
    next(e);
  }
});

eventsRouter.post("/", async (req, res, next) => {
  try {
    const body = eventCreateSchema.parse(req.body);
    res.status(201).json(await svc.createEvent(body));
  } catch (e) {
    next(e);
  }
});

eventsRouter.put("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const body = eventCreateSchema.parse(req.body);
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

eventsRouter.delete("/:id", async (req, res, next) => {
  try {
    const ok = await svc.deleteEvent(Number(req.params.id));
    if (!ok) {
      res.status(404).json({ error: "Событие не найдено" });
      return;
    }
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});
