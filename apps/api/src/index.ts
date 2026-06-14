import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { errorHandler } from "./middleware/errorHandler.js";
import { adminRouter } from "./routes/admin.js";
import { authRouter } from "./routes/auth.js";
import { oauthRouter } from "./routes/oauth.js";
import { documentsRouter } from "./routes/documents.js";
import { eventsRouter } from "./routes/events.js";
import { importExportRouter } from "./routes/importExport.js";
import { pdfRouter } from "./routes/pdf.js";
import { settingsRouter } from "./routes/settings.js";
import { tagsRouter } from "./routes/tags.js";
import { timelinesRouter } from "./routes/timelines.js";

const app = express();
app.set("trust proxy", 1);
const port = Number(process.env.PORT) || 3001;

// Persist JWT secret across restarts
if (!process.env.JWT_SECRET) {
  const secretFile = path.resolve("data/.jwt_secret");
  try {
    process.env.JWT_SECRET = readFileSync(secretFile, "utf-8").trim();
  } catch {
    process.env.JWT_SECRET = randomBytes(64).toString("hex");
    mkdirSync(path.dirname(secretFile), { recursive: true });
    writeFileSync(secretFile, process.env.JWT_SECRET);
  }
}

const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,
}));
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(cookieParser());
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/auth", oauthRouter);
app.use("/api/admin", adminRouter);
app.use("/api/timelines", timelinesRouter);
app.use("/api/events", eventsRouter);
app.use("/api/tags", tagsRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/import-export", importExportRouter);
app.use("/api/pdf", pdfRouter);
app.use("/api/settings", settingsRouter);

app.use(errorHandler);

// Serve web frontend in production
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDist = path.resolve(__dirname, "../../web/dist");
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get("/{*path}", (_req, res) => {
    res.sendFile(path.join(webDist, "index.html"));
  });
  console.log(`Serving frontend from ${webDist}`);
} else {
  console.log(`Frontend build not found at ${webDist} — API-only mode`);
}

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
