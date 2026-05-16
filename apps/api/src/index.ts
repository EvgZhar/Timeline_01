import cors from "cors";
import express from "express";
import helmet from "helmet";
import { errorHandler } from "./middleware/errorHandler.js";
import { documentsRouter } from "./routes/documents.js";
import { eventsRouter } from "./routes/events.js";
import { settingsRouter } from "./routes/settings.js";
import { tagsRouter } from "./routes/tags.js";
import { timelinesRouter } from "./routes/timelines.js";

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: true }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/timelines", timelinesRouter);
app.use("/api/events", eventsRouter);
app.use("/api/tags", tagsRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/settings", settingsRouter);

app.use(errorHandler);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
