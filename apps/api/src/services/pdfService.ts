import puppeteer from "puppeteer";
import { formatDisplay, fromStorage, formatCenturyYear } from "@timeline/shared";

interface EventDocDto {
  documentId: number;
  description: string;
  originalLink: string | null;
  previewUrl: string | null;
  resourceType: string | null;
}

interface EventDependencyDto {
  depEventId: number;
  depEventName: string | null;
  dependencyType: string;
}

interface EventDto {
  id: number;
  name: string;
  startDate: string;
  endDate: string | null;
  notes: string | null;
  tags: { id: number; name: string; color: number }[];
  documents: EventDocDto[];
  dependencies: EventDependencyDto[];
  timelines: { id: number; name: string }[];
}

interface TimelineDto {
  id: number;
  name: string;
  description: string | null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateRange(startIso: string, endIso: string | null): string {
  if (!endIso || startIso === endIso) {
    return formatDisplay(startIso);
  }

  const start = fromStorage(startIso);
  const end = fromStorage(endIso);

  const isEndDec31 = end.month === 12 && end.day === 31;
  const isEndJan1 = end.month === 1 && end.day === 1;

  if (isEndDec31 || isEndJan1) {
    const sya = start.year;
    const eya = end.year;
    const yr = (y: number) => y < 0 ? `${-y} г днэ` : `${y} г`;
    const startIsJan1 = start.month === 1 && start.day === 1;
    const endIsJan1 = end.month === 1 && end.day === 1;
    const startCentury = startIsJan1 ? formatCenturyYear(start.year) : null;
    const endCentury = endIsJan1 ? formatCenturyYear(end.year) : null;

    if (startCentury && endCentury && sya === eya) {
      return startCentury;
    } else if (startCentury && endCentury) {
      return `${startCentury} – ${endCentury}`;
    } else if (startCentury && !endCentury) {
      return `${startCentury} – ${yr(eya)}`;
    } else if (!startCentury && endCentury) {
      return `${yr(sya)} – ${endCentury}`;
    } else {
      return sya === eya ? yr(sya) : `${yr(sya)} – ${yr(eya)}`;
    }
  }

  return `${formatDisplay(startIso)} – ${formatDisplay(endIso)}`;
}

function guessMime(url: string): string | null {
  const ext = url.split(".").pop()?.toLowerCase().split("?")[0];
  switch (ext) {
    case "jpg": case "jpeg": return "image/jpeg";
    case "png": return "image/png";
    case "gif": return "image/gif";
    case "webp": return "image/webp";
    case "svg": return "image/svg+xml";
    case "avif": return "image/avif";
    case "ico": return "image/x-icon";
    default: return null;
  }
}

async function downloadAsDataUrl(url: string, signal: AbortSignal): Promise<string | null> {
  try {
    const response = await fetch(url, { signal });
    if (!response.ok) return null;

    const contentLength = response.headers.get("content-length");
    if (contentLength && Number(contentLength) > 10 * 1024 * 1024) return null;

    const contentType = response.headers.get("content-type");
    if (!contentType?.startsWith("image/")) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > 10 * 1024 * 1024) return null;

    const base64 = buffer.toString("base64");
    return `data:${contentType};base64,${base64}`;
  } catch {
    return null;
  }
}

function buildHtml(
  events: EventDto[],
  timelines: TimelineDto[],
  visibleTimelineIds: number[],
  imageMap: Map<number, string>,
  timelineSvg?: string,
  titleMeta?: { timelines?: string[]; filters?: string; dateRange?: string },
): string {
  const visibleTls = timelines.filter((t) => visibleTimelineIds.includes(t.id));

  let timelineHtml = "";
  if (timelineSvg) {
    timelineHtml = `
  <div class="landscape">
    <div class="timeline-svg-container">
      ${timelineSvg}
    </div>
  </div>`;
  }

  let eventsHtml = "";
  for (const tl of visibleTls) {
    const tlEvents = events.filter((ev) =>
      ev.timelines.some((t) => t.id === tl.id),
    );
    if (tlEvents.length === 0) continue;

    eventsHtml += `<div class="timeline-section">
      <div class="timeline-header">${escapeHtml(tl.name)}</div>
      <div class="timeline-desc">${escapeHtml(tl.description ?? "")}</div>`;

    for (const ev of tlEvents) {
      const dateStr = formatDateRange(ev.startDate, ev.endDate);

      let tagsHtml = "";
      if (ev.tags.length > 0) {
        const tagNames = ev.tags.map((t) => escapeHtml(t.name)).join(", ");
        tagsHtml = `<div class="event-tags"><strong>Метки:</strong> ${tagNames}</div>`;
      }

      let notesHtml = "";
      if (ev.notes) {
        const plain = ev.notes
          .replace(/[#*_`\[\]()>|~\-+]/g, "")
          .replace(/\s+/g, " ")
          .trim();
        if (plain.length > 0) {
          notesHtml = `<div class="event-notes">${escapeHtml(plain.substring(0, 600))}</div>`;
        }
      }

      let depsHtml = "";
      if (ev.dependencies.length > 0) {
        const depStrs = ev.dependencies.map(
          (d) =>
            `${escapeHtml(d.depEventName ?? `#${d.depEventId}`)} (${d.dependencyType})`,
        );
        depsHtml = `<div class="event-deps"><strong>Зависимости:</strong> ${depStrs.join("; ")}</div>`;
      }

      let docsHtml = "";
      for (const doc of ev.documents) {
        if (doc.resourceType === "image") {
          const dataUrl = imageMap.get(doc.documentId);
          if (dataUrl) {
            docsHtml += `<div class="event-doc-img"><img src="${escapeHtml(dataUrl)}" alt="${escapeHtml(doc.description)}" /><div class="event-doc-label">${escapeHtml(doc.description)}</div></div>`;
            continue;
          }
        }
        const link = doc.originalLink ?? doc.previewUrl;
        if (link) {
          docsHtml += `<div class="event-doc"><a href="${escapeHtml(link)}">${escapeHtml(doc.description)}</a></div>`;
        } else {
          docsHtml += `<div class="event-doc">${escapeHtml(doc.description)}</div>`;
        }
      }

      eventsHtml += `<div class="event">
        <div class="event-name">${escapeHtml(ev.name)}</div>
        <div class="event-date">${escapeHtml(dateStr)}</div>
        ${tagsHtml}
        ${notesHtml}
        ${depsHtml}
        ${docsHtml}
      </div>`;
    }

    eventsHtml += `</div>`;
  }

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<style>
  @page landscape { size: landscape; margin: 10mm; }
  @page portrait { size: portrait; margin: 20mm 15mm; }
  @page { size: portrait; margin: 20mm 15mm; }
  * { box-sizing: border-box; }
  body {
    font-family: Helvetica, Arial, sans-serif;
    font-size: 12pt;
    line-height: 1.5;
    color: #1a1a1a;
    margin: 0;
    padding: 0;
  }
  .landscape { page: landscape; page-break-before: always; }
  .title {
    font-size: 24pt;
    font-weight: bold;
    text-align: center;
    margin-top: 60mm;
    margin-bottom: 10mm;
  }
  .subtitle {
    font-size: 14pt;
    text-align: center;
    color: #555;
    margin-bottom: 40mm;
  }
  .page-break { page-break-before: always; }
  .timeline-svg-container {
    width: 100%;
    page-break-inside: avoid;
    margin: 3mm 0;
  }
  .timeline-svg-container svg {
    width: 100%;
    height: auto;
  }
  .timeline-section { margin-bottom: 10mm; }
  .timeline-header {
    font-size: 18pt;
    font-weight: bold;
    color: #1e3a5f;
    border-bottom: 2px solid #1e3a5f;
    padding-bottom: 3mm;
    margin-bottom: 5mm;
    margin-top: 10mm;
  }
  .timeline-desc {
    font-size: 10pt;
    color: #666;
    margin-bottom: 5mm;
  }
  .event {
    margin-bottom: 5mm;
    padding: 3mm 4mm;
    border: 1px solid #d0d0d0;
    border-radius: 2mm;
    page-break-inside: avoid;
  }
  .event-name {
    font-size: 13pt;
    font-weight: bold;
    color: #1a1a1a;
  }
  .event-date {
    font-size: 11pt;
    color: #4a4a4a;
    margin-top: 1mm;
  }
  .event-tags {
    font-size: 10pt;
    color: #555;
    margin-top: 1mm;
  }
  .event-notes {
    font-size: 10pt;
    color: #444;
    font-style: italic;
    margin-top: 1mm;
  }
  .event-deps {
    font-size: 10pt;
    color: #666;
    margin-top: 1mm;
  }
  .event-doc {
    font-size: 9pt;
    color: #2266aa;
    margin-top: 0.5mm;
    word-break: break-all;
  }
  .event-doc a {
    color: #2266aa;
    text-decoration: underline;
  }
  .event-doc-img {
    margin-top: 1mm;
    page-break-inside: avoid;
  }
  .event-doc-img img {
    max-width: 100%;
    max-height: 60mm;
    display: block;
    border: 1px solid #ddd;
    border-radius: 1mm;
  }
  .event-doc-label {
    font-size: 8pt;
    color: #666;
    margin-top: 0.5mm;
  }
  .meta-table {
    margin: 5mm auto 20mm;
    max-width: 120mm;
  }
  .meta-table td {
    padding: 1.5mm 3mm;
    font-size: 11pt;
    vertical-align: top;
  }
  .meta-table td:first-child {
    font-weight: bold;
    color: #1e3a5f;
    white-space: nowrap;
    width: 1%;
  }
  .meta-table td:last-child {
    color: #333;
  }
  .footer {
    text-align: center;
    font-size: 9pt;
    color: #999;
    margin-top: 10mm;
  }
</style>
</head>
<body>
  <div class="title">Хронология событий</div>
  <div class="subtitle">Экспорт из pretty-timeline.ru</div>
  ${titleMeta ? `<table class="meta-table">${titleMeta.timelines?.length ? `<tr><td>Таймлайны</td><td>${titleMeta.timelines.map(escapeHtml).join(", ")}</td></tr>` : ""}${titleMeta.dateRange ? `<tr><td>Период</td><td>${escapeHtml(titleMeta.dateRange)}</td></tr>` : ""}${titleMeta.filters ? `<tr><td>Фильтры</td><td>${escapeHtml(titleMeta.filters)}</td></tr>` : ""}</table>` : ""}
  ${timelineHtml ? "" : '<div class="page-break"></div>'}
  ${timelineHtml}
  ${eventsHtml}
  <div class="footer">Создано в pretty-timeline.ru</div>
</body>
</html>`;
}

const MAX_IMAGES = 20;
const DOWNLOAD_TIMEOUT_MS = 60000;

export async function generatePdf(
  events: EventDto[],
  timelines: TimelineDto[],
  visibleTimelineIds: number[],
  timelineSvg?: string,
  titleMeta?: { timelines?: string[]; filters?: string; dateRange?: string },
): Promise<Buffer> {
  const imageMap = new Map<number, string>();
  const imageDocs: EventDocDto[] = [];
  for (const ev of events) {
    for (const doc of ev.documents) {
      if (doc.resourceType === "image" && (doc.previewUrl ?? doc.originalLink)) {
        imageDocs.push(doc);
      }
    }
  }

  const toDownload = imageDocs.slice(0, MAX_IMAGES);
  if (toDownload.length > 0) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
    const tasks = toDownload.map((doc) => {
      const url = doc.previewUrl ?? doc.originalLink!;
      return downloadAsDataUrl(url, controller.signal).then((dataUrl) => {
        if (dataUrl) imageMap.set(doc.documentId, dataUrl);
      });
    });
    await Promise.allSettled(tasks);
    clearTimeout(timer);
  }

  const html = buildHtml(events, timelines, visibleTimelineIds, imageMap, timelineSvg, titleMeta);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
