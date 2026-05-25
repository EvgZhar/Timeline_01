import { Router } from "express";
import { tagCreateSchema } from "@timeline/shared";
import * as svc from "../services/tagsService.js";

export const tagsRouter = Router();

tagsRouter.get("/recent", async (_req, res, next) => {
  try {
    res.json(await svc.getRecentTags());
  } catch (e) {
    next(e);
  }
});

tagsRouter.get("/", async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    res.json(await svc.listTags(q));
  } catch (e) {
    next(e);
  }
});

tagsRouter.post("/", async (req, res, next) => {
  try {
    const body = tagCreateSchema.parse(req.body);
    res.status(201).json(await svc.createTag(body.name, body.color, body.previewUrl));
  } catch (e) {
    next(e);
  }
});

tagsRouter.put("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { name, color, previewUrl } = req.body;
    res.json(await svc.updateTag(id, { name, color, previewUrl }));
  } catch (e) {
    next(e);
  }
});

tagsRouter.delete("/:id", async (req, res, next) => {
  try {
    await svc.deleteTag(Number(req.params.id));
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
