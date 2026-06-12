import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { generatePdf } from "../services/pdfService.js";

export const pdfRouter = Router();

pdfRouter.post("/export", authenticate, async (req, res, next) => {
  try {
    const { events, timelines, visibleTimelineIds, timelineSvg, titleMeta } = req.body;

    if (!Array.isArray(events) || !Array.isArray(timelines) || !Array.isArray(visibleTimelineIds)) {
      res.status(400).json({ error: "Неверные данные: ожидаются events, timelines, visibleTimelineIds" });
      return;
    }

    const pdfBuffer = await generatePdf(
      events,
      timelines,
      visibleTimelineIds,
      typeof timelineSvg === "string" ? timelineSvg : undefined,
      typeof titleMeta === "object" && titleMeta !== null
        ? { timelines: Array.isArray(titleMeta.timelines) ? titleMeta.timelines : undefined,
            filters: typeof titleMeta.filters === "string" ? titleMeta.filters : undefined,
            dateRange: typeof titleMeta.dateRange === "string" ? titleMeta.dateRange : undefined }
        : undefined,
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="timeline-export-${Date.now()}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (e) {
    next(e);
  }
});
