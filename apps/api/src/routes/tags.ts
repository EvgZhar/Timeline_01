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
    res.status(201).json(await svc.createTag(body.name, body.color));
  } catch (e) {
    next(e);
  }
});
