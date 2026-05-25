import { Router } from "express";
import { tagCreateSchema } from "@timeline/shared";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { tagTable } from "../db/schema.js";
import * as svc from "../services/tagsService.js";
import { authenticate } from "../middleware/authenticate.js";
import { checkPermission, getCurrentDataAreaId, getAllowedDataAreaIds } from "../services/permissionService.js";

export const tagsRouter = Router();

tagsRouter.get("/recent", authenticate, async (_req, res, next) => {
  try {
    res.json(await svc.getRecentTags());
  } catch (e) {
    next(e);
  }
});

tagsRouter.get("/", authenticate, async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const allowedIds = await getAllowedDataAreaIds(req.user!.userId, "canRead");
    res.json(await svc.listTags(q, allowedIds));
  } catch (e) {
    next(e);
  }
});

tagsRouter.post("/", authenticate, async (req, res, next) => {
  try {
    const body = tagCreateSchema.parse(req.body);
    const dataAreaId = await getCurrentDataAreaId(req.user!.userId);
    if (!(await checkPermission(req.user!.userId, dataAreaId, "canCreate"))) {
      res.status(403).json({ error: "Нет права на создание в текущей области" });
      return;
    }
    res.status(201).json(await svc.createTag(body.name, body.color, dataAreaId, body.previewUrl ?? undefined));
  } catch (e) {
    next(e);
  }
});

tagsRouter.put("/:id", authenticate, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { name, color, previewUrl } = req.body;
    const [existing] = await db.select({ dataAreaId: tagTable.dataAreaId }).from(tagTable).where(eq(tagTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Тег не найден" });
      return;
    }
    if (existing.dataAreaId && !(await checkPermission(req.user!.userId, existing.dataAreaId, "canUpdate"))) {
      res.status(403).json({ error: "Нет права на редактирование" });
      return;
    }
    res.json(await svc.updateTag(id, { name, color, previewUrl }));
  } catch (e) {
    next(e);
  }
});

tagsRouter.delete("/:id", authenticate, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db.select({ dataAreaId: tagTable.dataAreaId }).from(tagTable).where(eq(tagTable.id, id)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Тег не найден" });
      return;
    }
    if (existing.dataAreaId && !(await checkPermission(req.user!.userId, existing.dataAreaId, "canDelete"))) {
      res.status(403).json({ error: "Нет права на удаление" });
      return;
    }
    await svc.deleteTag(id);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
});
