import puppeteer from "puppeteer";

interface EventDocDto {
  id: number;
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

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

function buildHtml(
  events: EventDto[],
  timelines: TimelineDto[],
  visibleTimelineIds: number[],
  timelineImage?: string,
): string {
  const visibleTls = timelines.filter((t) => visibleTimelineIds.includes(t.id));

  let timelineHtml = "";
  if (timelineImage) {
    timelineHtml = `
    <div class="timeline-image-container">
      <img src="${escapeHtml(timelineImage)}" alt="Таймлайн" />
    </div>
    <div class="page-break"></div>`;
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
      const dateStr =
        ev.startDate === ev.endDate || !ev.endDate
          ? formatDate(ev.startDate)
          : `${formatDate(ev.startDate)} – ${formatDate(ev.endDate)}`;

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
        const link = doc.originalLink ?? doc.previewUrl ?? "";
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
  @page { margin: 20mm 15mm; }
  * { box-sizing: border-box; }
  body {
    font-family: Helvetica, Arial, sans-serif;
    font-size: 12pt;
    line-height: 1.5;
    color: #1a1a1a;
    margin: 0;
    padding: 0;
  }
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
  .timeline-image-container {
    width: 100%;
    text-align: center;
    page-break-inside: avoid;
    margin: 10mm 0;
  }
  .timeline-image-container img {
    max-width: 100%;
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
  <div class="page-break"></div>
  ${timelineHtml}
  ${eventsHtml}
  <div class="footer">Создано в pretty-timeline.ru</div>
</body>
</html>`;
}

export async function generatePdf(
  events: EventDto[],
  timelines: TimelineDto[],
  visibleTimelineIds: number[],
  timelineImage?: string,
): Promise<Buffer> {
  const html = buildHtml(events, timelines, visibleTimelineIds, timelineImage);

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
