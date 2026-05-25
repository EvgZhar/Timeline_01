import { Router } from "express";
import { settingsUpdateSchema } from "@timeline/shared";
import { ensureAppFolder, getDiskInfo } from "../integrations/yandex-disk/client.js";
import {
  getSettings,
  getYandexBaseFolder,
  isYandexConfigured,
  putSettings,
} from "../services/settings/settingsService.js";
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

settingsRouter.get("/yandex/status", authenticate, async (_req, res, next) => {
  try {
    res.json({
      configured: await isYandexConfigured(),
      baseFolder: await getYandexBaseFolder(),
    });
  } catch (e) {
    next(e);
  }
});

settingsRouter.post("/yandex/test", authenticate, async (_req, res, next) => {
  try {
    const folder = await ensureAppFolder();
    const info = await getDiskInfo();
    res.json({
      ok: true,
      folder,
      totalSpace: info.total_space,
      usedSpace: info.used_space,
    });
  } catch (e) {
    next(e);
  }
});
