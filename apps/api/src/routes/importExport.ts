import { Router } from "express";
import multer from "multer";
import { authenticate } from "../middleware/authenticate.js";
import { getAllowedDataAreaIds, getCurrentDataAreaId, checkPermission } from "../services/permissionService.js";
import * as svc from "../services/importExportService.js";
import type { ExportFilters } from "../services/importExportService.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const importExportRouter = Router();

importExportRouter.get("/export", authenticate, async (req, res, next) => {
  try {
    const allowedIds = await getAllowedDataAreaIds(req.user!.userId, "canRead");
    if (allowedIds.length === 0) {
      res.status(403).json({ error: "Нет доступа к данным" });
      return;
    }

    const filters: ExportFilters = {};

    const rawTagIds = req.query.tagFilterIds;
    if (typeof rawTagIds === "string" && rawTagIds) {
      filters.tagFilterIds = rawTagIds.split(",").map(Number).filter((n) => n > 0);
    }
    const rawTagMode = req.query.tagFilterMode;
    if (rawTagMode === "and" || rawTagMode === "or") {
      filters.tagFilterMode = rawTagMode;
    }
    const rawSearch = req.query.textSearchQuery;
    if (typeof rawSearch === "string") {
      filters.textSearchQuery = rawSearch;
    }
    const rawSearchMode = req.query.textSearchMode;
    if (rawSearchMode === "name" || rawSearchMode === "nameAndNotes") {
      filters.textSearchMode = rawSearchMode;
    }
    const rawDateFrom = req.query.dateFrom;
    if (typeof rawDateFrom === "string") {
      filters.dateFrom = rawDateFrom;
    }
    const rawDateTo = req.query.dateTo;
    if (typeof rawDateTo === "string") {
      filters.dateTo = rawDateTo;
    }

    const buf = await svc.generateExportXlsx(allowedIds, filters);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="timeline-export-${Date.now()}.xlsx"`);
    res.send(buf);
  } catch (e) {
    next(e);
  }
});

importExportRouter.post("/import", authenticate, upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Файл не загружен" });
      return;
    }
    const dataAreaId = await getCurrentDataAreaId(req.user!.userId);
    if (!(await checkPermission(req.user!.userId, dataAreaId, "canCreate"))) {
      res.status(403).json({ error: "Нет права на создание в текущей области" });
      return;
    }
    const result = await svc.processImportXlsx(req.file.buffer, dataAreaId);
    res.json(result);
  } catch (e) {
    next(e);
  }
});
