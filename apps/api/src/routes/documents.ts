import { Router } from "express";
import multer from "multer";
import { eq, inArray } from "drizzle-orm";
import { documentCreateUrlSchema } from "@timeline/shared";
import { db } from "../db/index.js";
import { documentTable, documentEventLink, eventTable } from "../db/schema.js";
import * as svc from "../services/documentsService.js";
import { authenticate } from "../middleware/authenticate.js";
import { checkPermission, getCurrentDataAreaId, getAllowedDataAreaIds } from "../services/permissionService.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

export const documentsRouter = Router();

async function getEventDataAreaId(eventId: number): Promise<number | null> {
  const [event] = await db.select({ dataAreaId: eventTable.dataAreaId }).from(eventTable).where(eq(eventTable.id, eventId)).limit(1);
  return event?.dataAreaId ?? null;
}

documentsRouter.get("/", authenticate, async (req, res, next) => {
  try {
    const eventId = Number(req.query.eventId);
    if (!eventId) {
      res.status(400).json({ error: "eventId обязателен" });
      return;
    }
    const allowed = await getAllowedDataAreaIds(req.user!.userId, "canRead");
    const areaId = await getEventDataAreaId(eventId);
    if (areaId && allowed.length > 0 && !allowed.includes(areaId)) {
      res.status(403).json({ error: "Нет доступа к событию" });
      return;
    }
    res.json(await svc.listDocuments(eventId));
  } catch (e) {
    next(e);
  }
});

documentsRouter.get("/:id/preview", async (req, res, next) => {
  try {
    const url = await svc.getPreviewUrl(Number(req.params.id));
    if (!url) {
      res.status(404).json({ error: "Документ не найден" });
      return;
    }
    res.redirect(url);
  } catch (e) {
    next(e);
  }
});

documentsRouter.post("/", authenticate, upload.single("file"), async (req, res, next) => {
  try {
    const eventId = Number(req.body.eventId);
    const description = req.body.description || req.file?.originalname || "Файл";

    const allowed = await getAllowedDataAreaIds(req.user!.userId, "canCreate");
    const areaId = await getEventDataAreaId(eventId);
    if (areaId && allowed.length > 0 && !allowed.includes(areaId)) {
      res.status(403).json({ error: "Нет права на создание вложений" });
      return;
    }

    const eventDataAreaId = await getEventDataAreaId(eventId);

    if (req.file) {
      const count = await svc.countDocumentsForEvent(eventId);
      if (count >= 10) {
        res.status(400).json({ error: "Максимум 10 вложений на событие" });
        return;
      }
      const doc = await svc.createFromUpload(eventId, description, req.file.buffer, req.file.originalname, req.file.mimetype, eventDataAreaId);
      res.status(201).json(doc);
      return;
    }

    const body = documentCreateUrlSchema.parse(req.body);
    const count = await svc.countDocumentsForEvent(body.eventId);
    if (count >= 10) {
      res.status(400).json({ error: "Максимум 10 вложений на событие" });
      return;
    }
    res.status(201).json(await svc.createFromUrl(body.eventId, body.description, body.originalLink, body.resourceType, eventDataAreaId));
  } catch (e) {
    next(e);
  }
});

documentsRouter.patch("/:id/primary", authenticate, async (req, res, next) => {
  try {
    const allowed = await getAllowedDataAreaIds(req.user!.userId, "canUpdate");
    const [link] = await db
      .select({ eventId: documentEventLink.eventId })
      .from(documentEventLink)
      .where(eq(documentEventLink.documentId, Number(req.params.id)))
      .limit(1);
    if (link) {
      const areaId = await getEventDataAreaId(link.eventId);
      if (areaId && allowed.length > 0 && !allowed.includes(areaId)) {
        res.status(403).json({ error: "Нет права на изменение" });
        return;
      }
    }
    const doc = await svc.setPrimary(Number(req.params.id));
    res.json(doc);
  } catch (e) {
    next(e);
  }
});

documentsRouter.delete("/:id", authenticate, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const allowed = await getAllowedDataAreaIds(req.user!.userId, "canDelete");
    const [link] = await db
      .select({ eventId: documentEventLink.eventId })
      .from(documentEventLink)
      .where(eq(documentEventLink.documentId, id))
      .limit(1);
    if (link) {
      const areaId = await getEventDataAreaId(link.eventId);
      if (areaId && allowed.length > 0 && !allowed.includes(areaId)) {
        res.status(403).json({ error: "Нет права на удаление" });
        return;
      }
    }
    const ok = await svc.deleteDocument(id);
    if (!ok) {
      res.status(404).json({ error: "Документ не найден" });
      return;
    }
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});
