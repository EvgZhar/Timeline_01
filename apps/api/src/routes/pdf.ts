import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { generatePdf } from "../services/pdfService.js";

export const pdfRouter = Router();

pdfRouter.post("/export", authenticate, async (req, res, next) => {
  try {
    const { events, timelines, visibleTimelineIds, timelineSvg } = req.body;

    if (!Array.isArray(events) || !Array.isArray(timelines) || !Array.isArray(visibleTimelineIds)) {
      res.status(400).json({ error: "Неверные данные: ожидаются events, timelines, visibleTimelineIds" });
      return;
    }

    const cookies: { name: string; value: string }[] = [];
    if (req.cookies?.accessToken) {
      cookies.push({ name: "accessToken", value: req.cookies.accessToken });
    }
    if (req.cookies?.refreshToken) {
      cookies.push({ name: "refreshToken", value: req.cookies.refreshToken });
    }

    const pdfBuffer = await generatePdf(
      events,
      timelines,
      visibleTimelineIds,
      typeof timelineSvg === "string" ? timelineSvg : undefined,
      cookies.length > 0 ? cookies : undefined,
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="timeline-export-${Date.now()}.pdf"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (e) {
    next(e);
  }
});
