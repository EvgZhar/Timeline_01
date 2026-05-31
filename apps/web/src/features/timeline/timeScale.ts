import { formatDisplay, toDate } from "@timeline/shared";

const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;
const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Extract approximate astronomical year from a linear ms timestamp.
 */
export function msToYear(ms: number): number {
  return Math.round(1970 + ms / YEAR_MS);
}

export function msToMonth(ms: number): number {
  const year = msToYear(ms);
  const yearStart = (year - 1970) * YEAR_MS;
  return Math.floor((ms - yearStart) / MONTH_MS);
}

export function msToDay(ms: number): number {
  const year = msToYear(ms);
  const yearStart = (year - 1970) * YEAR_MS;
  const month = Math.floor((ms - yearStart) / MONTH_MS);
  const monthStart = yearStart + month * MONTH_MS;
  return Math.floor((ms - monthStart) / DAY_MS) + 1;
}

export interface ViewRange {
  startMs: number;
  endMs: number;
}

export function computeInitialRange(
  eventDates: { start: string; end: string }[],
): ViewRange {
  const now = Date.now();
  const hundredYears = 100 * YEAR_MS;

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

export function formatTick(ms: number, stepMs: number): string {
  const year = msToYear(ms);
  if (stepMs >= YEAR_MS * 0.9) {
    return year < 1 ? `${-year} г. до н.э.` : String(year);
  }

  if (stepMs >= MONTH_MS * 0.9) {
    const month = msToMonth(ms) + 1;
    const mStr = String(month).padStart(2, "0");
    return year < 1 ? `${mStr}.${-year} г. до н.э.` : `${mStr}.${year}`;
  }

  const month = msToMonth(ms) + 1;
  const day = msToDay(ms);
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  try {
    return formatDisplay(iso);
  } catch {
    return iso;
  }
}

export function generateTicks(range: ViewRange, width: number): { x: number; label: string }[] {
  const spanMs = range.endMs - range.startMs;
  const spanYears = spanMs / YEAR_MS;

  let stepMs: number;
  if (spanYears > 10000) stepMs = 1000 * YEAR_MS;
  else if (spanYears > 5000) stepMs = 500 * YEAR_MS;
  else if (spanYears > 2000) stepMs = 200 * YEAR_MS;
  else if (spanYears > 1000) stepMs = 100 * YEAR_MS;
  else if (spanYears > 500) stepMs = 50 * YEAR_MS;
  else if (spanYears > 200) stepMs = 20 * YEAR_MS;
  else if (spanYears > 100) stepMs = 10 * YEAR_MS;
  else if (spanYears > 50) stepMs = 5 * YEAR_MS;
  else if (spanYears > 20) stepMs = 2 * YEAR_MS;
  else if (spanYears > 10) stepMs = 1 * YEAR_MS;
  else if (spanYears > 5) stepMs = 6 * MONTH_MS;
  else if (spanYears > 2) stepMs = 3 * MONTH_MS;
  else if (spanYears > 1) stepMs = 1 * MONTH_MS;
  else if (spanYears > 0.5) stepMs = 14 * DAY_MS;
  else if (spanYears > 0.2) stepMs = 7 * DAY_MS;
  else stepMs = 1 * DAY_MS;

  const ticks: { x: number; label: string }[] = [];

  let t = Math.ceil(range.startMs / stepMs) * stepMs;
  while (t <= range.endMs) {
    ticks.push({ x: xForTime(t, range, width), label: formatTick(t, stepMs) });
    t += stepMs;
  }

  return ticks;
}
