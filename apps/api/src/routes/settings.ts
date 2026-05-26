import { Router } from "express";
import { settingsUpdateSchema } from "@timeline/shared";
import { getSettings, putSettings } from "../services/settings/settingsService.js";
import { authenticate } from "../middleware/authenticate.js";

export const settingsRouter = Router();

settingsRouter.get("/", authenticate, async (_req, res, next) => {
  try {
    res.json({ settings: await getSettings() });
  } catch (e) {
    next(e);
  }
});

settingsRouter.put("/", authenticate, async (req, res, next) => {
  try {
    const { settings } = settingsUpdateSchema.parse(req.body);
    const updated = await putSettings(settings);
    res.json({ settings: updated });
  } catch (e) {
    next(e);
  }
});
