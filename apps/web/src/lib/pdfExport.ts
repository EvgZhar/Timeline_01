import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import type { EventDto, TimelineDto, DocumentDto } from "@timeline/shared";

const MARGIN = 10;
let pdf: jsPDF;

function addPageP(): jsPDF {
  pdf.addPage("a4", "p");
  pdf.setFont("helvetica", "normal");
  return pdf;
}

function wrap(text: string, maxW: number): string[] {
  return pdf.splitTextToSize(text, maxW);
}

async function docToPdf(doc: DocumentDto, x: number, y: number, maxW: number): Promise<number> {
  const isImage = doc.resourceType === "image" || !doc.resourceType;
  const imgUrl = doc.previewUrl ?? doc.originalLink;

  if (isImage && imgUrl) {
    try {
      const res = await fetch(imgUrl, { mode: "cors", credentials: "include" });
      const blob = await res.blob();
      const img = new Image();
      const imgLoaded = new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = URL.createObjectURL(blob);
      });
      await imgLoaded;
      const ratio = img.naturalWidth / img.naturalHeight;
      let iw = 40;
      let ih = iw / ratio;
      if (ih > 30) { ih = 30; iw = ih * ratio; }
      pdf.addImage(img, "PNG", x, y, iw, ih);
      URL.revokeObjectURL(img.src);
      if (doc.description) {
        pdf.setFontSize(8);
        pdf.text(doc.description, x + iw + 2, y + ih / 2 + 2);
      }
      return Math.max(ih, doc.description ? 10 : 0) + 3;
    } catch {
      pdf.setFontSize(8);
      const lines = wrap(`${doc.description}: ${doc.originalLink ?? ""}`, maxW);
      lines.forEach((l, i) => pdf.text(l, x, y + i * 4));
      return lines.length * 4 + 3;
    }
  }

  pdf.setFontSize(8);
  const lines = wrap(`${doc.description}: ${doc.originalLink ?? doc.storageLink ?? ""}`, maxW);
  lines.forEach((l, i) => pdf.text(l, x, y + i * 4));
  return lines.length * 4 + 3;
}

async function renderEvent(ev: EventDto, x: number, y: number, pageW: number, pageH: number): Promise<number> {
  const maxW = pageW - MARGIN * 2;
  let cursor = y;

  const bump = (dy: number) => { cursor += dy + 2; };
  const checkPage = () => {
    if (cursor > pageH - MARGIN - 20) {
      addPageP();
      cursor = MARGIN + 5;
    }
  };

  checkPage();
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  const nameLines = wrap(ev.name, maxW);
  nameLines.forEach((l, i) => pdf.text(l, x, cursor + i * 5));
  bump(nameLines.length * 5);

  checkPage();
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  const dateStr = ev.startDate === ev.endDate ? ev.startDate : `${ev.startDate} — ${ev.endDate}`;
  pdf.text(dateStr, x, cursor);
  bump(5);

  if (ev.tags.length > 0) {
    checkPage();
    pdf.setFontSize(9);
    const tagStr = ev.tags.map((t) => t.name).join(", ");
    pdf.text(`Теги: ${tagStr}`, x, cursor);
    bump(4);
  }

  if (ev.notes) {
    const plain = ev.notes.replace(/[#*_`\[\]()>|~\-\+]/g, "").replace(/\s+/g, " ").trim();
    if (plain.length > 0) {
      checkPage();
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "italic");
      const lines = wrap(plain.substring(0, 600), maxW).slice(0, 15);
      lines.forEach((l, i) => pdf.text(l, x, cursor + i * 4));
      bump(lines.length * 4);
      pdf.setFont("helvetica", "normal");
    }
  }

  if (ev.dependencies.length > 0) {
    checkPage();
    pdf.setFontSize(9);
    const depStrs = ev.dependencies.map((d) => `${d.depEventName ?? `#${d.depEventId}`} (${d.dependencyType})`);
    const depText = `Связи: ${depStrs.join("; ")}`;
    const lines = wrap(depText, maxW);
    lines.forEach((l, i) => pdf.text(l, x, cursor + i * 4));
    bump(lines.length * 4);
  }

  if (ev.documents.length > 0) {
    for (const doc of ev.documents) {
      checkPage();
      const used = await docToPdf(doc, x, cursor, maxW);
      bump(used);
    }
  }

  bump(3);

  return cursor - y;
}

export async function exportTimelineToPdf(
  container: HTMLElement,
  events: EventDto[],
  timelines: TimelineDto[],
  visibleTimelineIds: number[],
): Promise<void> {
  pdf = new jsPDF("l", "mm", "a4");
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  const canvas = await html2canvas(container, {
    useCORS: true,
    scale: 2,
    logging: false,
  });
  const imgData = canvas.toDataURL("image/png");
  const availW = pageW - MARGIN * 2;
  const availH = pageH - MARGIN * 2;
  const imgRatio = canvas.width / canvas.height;
  let imgW = availW;
  let imgH = availW / imgRatio;
  if (imgH > availH) {
    imgH = availH;
    imgW = availH * imgRatio;
  }
  pdf.addImage(imgData, "PNG", MARGIN, MARGIN, imgW, imgH);

  const visibleTls = timelines.filter((t) => visibleTimelineIds.includes(t.id));
  for (const tl of visibleTls) {
    const tlEvents = events.filter((ev) => ev.timelines.some((t) => t.id === tl.id));
    if (tlEvents.length === 0) continue;

    addPageP();
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    const titleLines = wrap(tl.name, pageW - MARGIN * 2);
    titleLines.forEach((l, i) => pdf.text(l, MARGIN, MARGIN + 10 + i * 6));

    let cursor = MARGIN + 10 + titleLines.length * 6 + 4;
    pdf.setDrawColor(200, 200, 200);
    pdf.line(MARGIN, cursor, pageW - MARGIN, cursor);
    cursor += 6;

    for (const ev of tlEvents) {
      const used = await renderEvent(ev, MARGIN + 2, cursor, pageW, pageH);
      cursor += used;
      if (cursor > pageH - MARGIN - 30) {
        addPageP();
        cursor = MARGIN + 10;
      }
    }
  }

  pdf.save(`timeline-export-${Date.now()}.pdf`);
}
