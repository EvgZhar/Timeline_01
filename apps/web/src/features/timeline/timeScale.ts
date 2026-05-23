import { formatDisplay, toDate } from "@timeline/shared";

export interface ViewRange {
  startMs: number;
  endMs: number;
}

export function computeInitialRange(
  eventDates: { start: string; end: string }[],
): ViewRange {
  const now = Date.now();
  const hundredYears = 100 * 365.25 * 24 * 60 * 60 * 1000;

  if (eventDates.length === 0) {
    return { startMs: now - hundredYears, endMs: now + hundredYears };
  }
  if (eventDates.length === 1) {
    const d = toDate(eventDates[0].start).getTime();
    return { startMs: d - hundredYears, endMs: d + hundredYears };
  }
  let min = Infinity;
  let max = -Infinity;
  for (const e of eventDates) {
    min = Math.min(min, toDate(e.start).getTime());
    max = Math.max(max, toDate(e.end).getTime());
  }
  const pad = (max - min) * 0.05 || hundredYears / 10;
  return { startMs: min - pad, endMs: max + pad };
}

export function xForTime(ms: number, range: ViewRange, width: number): number {
  const span = range.endMs - range.startMs || 1;
  return ((ms - range.startMs) / span) * width;
}

export function timeForX(x: number, range: ViewRange, width: number): number {
  const span = range.endMs - range.startMs || 1;
  return range.startMs + (x / width) * span;
}

export function formatTick(ms: number, spanYears: number): string {
  const d = new Date(ms);
  if (spanYears > 500) return String(d.getUTCFullYear());
  if (spanYears > 50) return String(d.getUTCFullYear());
  if (spanYears > 2) return String(d.getUTCFullYear());
  const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  try {
    return formatDisplay(iso);
  } catch {
    return iso;
  }
}

export function generateTicks(range: ViewRange, width: number): { x: number; label: string }[] {
  const spanMs = range.endMs - range.startMs;
  const spanYears = spanMs / (365.25 * 24 * 60 * 60 * 1000);
  let stepMs: number;
  if (spanYears > 2000) stepMs = 500 * 365.25 * 24 * 60 * 60 * 1000;
  else if (spanYears > 200) stepMs = 100 * 365.25 * 24 * 60 * 60 * 1000;
  else if (spanYears > 50) stepMs = 10 * 365.25 * 24 * 60 * 60 * 1000;
  else if (spanYears > 10) stepMs = 365.25 * 24 * 60 * 60 * 1000;
  else stepMs = 30 * 24 * 60 * 60 * 1000;

  const ticks: { x: number; label: string }[] = [];
  let t = Math.ceil(range.startMs / stepMs) * stepMs;
  while (t <= range.endMs) {
    ticks.push({
      x: xForTime(t, range, width),
      label: formatTick(t, spanYears),
    });
    t += stepMs;
  }
  return ticks;
}
