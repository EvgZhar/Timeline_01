import { formatCenturyYear, formatDisplay, toDate } from "@timeline/shared";

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

export function formatTick(ms: number, stepMs: number): string {
  const yearMs = 365.25 * 24 * 60 * 60 * 1000;
  const monthMs = 30 * 24 * 60 * 60 * 1000;

  if (stepMs >= yearMs * 0.9) {
    const d = new Date(ms);
    return formatCenturyYear(d.getUTCFullYear()) ?? `${d.getUTCFullYear()}`;
  }

  const d = new Date(ms);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;

  if (stepMs >= monthMs * 0.9) {
    return `${String(month).padStart(2, "0")}.${year}`;
  }

  const day = d.getUTCDate();
  const yStr = year < 0 ? "-" + String(-year).padStart(4, "0") : String(year).padStart(4, "0");
  const iso = `${yStr}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  try {
    return formatDisplay(iso);
  } catch {
    return iso;
  }
}

export function generateTicks(range: ViewRange, width: number): { x: number; label: string }[] {
  const spanMs = range.endMs - range.startMs;
  const dayMs = 24 * 60 * 60 * 1000;
  const yearMs = 365.25 * dayMs;
  const monthMs = 30 * dayMs;
  const spanYears = spanMs / yearMs;

  let stepMs: number;
  if (spanYears > 10000) stepMs = 1000 * yearMs;
  else if (spanYears > 5000) stepMs = 500 * yearMs;
  else if (spanYears > 2000) stepMs = 200 * yearMs;
  else if (spanYears > 1000) stepMs = 100 * yearMs;
  else if (spanYears > 500) stepMs = 50 * yearMs;
  else if (spanYears > 200) stepMs = 20 * yearMs;
  else if (spanYears > 100) stepMs = 10 * yearMs;
  else if (spanYears > 50) stepMs = 5 * yearMs;
  else if (spanYears > 20) stepMs = 2 * yearMs;
  else if (spanYears > 10) stepMs = 1 * yearMs;
  else if (spanYears > 5) stepMs = 6 * monthMs;
  else if (spanYears > 2) stepMs = 3 * monthMs;
  else if (spanYears > 1) stepMs = 1 * monthMs;
  else if (spanYears > 0.5) stepMs = 14 * dayMs;
  else if (spanYears > 0.2) stepMs = 7 * dayMs;
  else stepMs = 1 * dayMs;

  const ticks: { x: number; label: string }[] = [];

  if (stepMs >= monthMs * 0.9 && stepMs < yearMs * 0.9) {
    // Month-level stepping: iterate by calendar months to avoid drift
    const d = new Date(range.startMs);
    d.setUTCDate(1);
    d.setUTCHours(0, 0, 0, 0);
    const stepMonths = Math.round(stepMs / monthMs);
    const current = new Date(d);
    while (current.getTime() <= range.endMs) {
      const ms = current.getTime();
      if (ms >= range.startMs) {
        ticks.push({ x: xForTime(ms, range, width), label: formatTick(ms, stepMs) });
      }
      current.setUTCMonth(current.getUTCMonth() + stepMonths);
    }
  } else {
    let t = Math.ceil(range.startMs / stepMs) * stepMs;
    while (t <= range.endMs) {
      ticks.push({ x: xForTime(t, range, width), label: formatTick(t, stepMs) });
      t += stepMs;
    }
  }

  return ticks;
}
