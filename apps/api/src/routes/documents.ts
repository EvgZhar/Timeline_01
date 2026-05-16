import { Router } from "express";
import multer from "multer";
import { documentCreateUrlSchema } from "@timeline/shared";
import * as svc from "../services/documentsService.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

export const documentsRouter = Router();

documentsRouter.get("/", async (req, res, next) => {
  try {
    const eventId = Number(req.query.eventId);
    if (!eventId) {
      res.status(400).json({ error: "eventId обязателен" });
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

documentsRouter.post("/", upload.single("file"), async (req, res, next) => {
  try {
    const eventId = Number(req.body.eventId);
    const description = req.body.description || req.file?.originalname || "Файл";

    if (req.file) {
      const count = await svc.countDocumentsForEvent(eventId);
      if (count >= 10) {
        res.status(400).json({ error: "Максимум 10 вложений на событие" });
        return;
      }
      const doc = await svc.createFromUpload(
        eventId,
        description,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
      );
      res.status(201).json(doc);
      return;
    }

    const body = documentCreateUrlSchema.parse(req.body);
    const count = await svc.countDocumentsForEvent(body.eventId);
    if (count >= 10) {
      res.status(400).json({ error: "Максимум 10 вложений на событие" });
      return;
    }
    res.status(201).json(
      await svc.createFromUrl(
        body.eventId,
        body.description,
        body.originalLink,
        body.resourceType,
      ),
    );
  } catch (e) {
    next(e);
  }
});

documentsRouter.delete("/:id", async (req, res, next) => {
  try {
    const ok = await svc.deleteDocument(Number(req.params.id));
    if (!ok) {
      res.status(404).json({ error: "Документ не найден" });
      return;
    }
    res.status(204).send();
  } catch (e) {
    next(e);
  }
});
