/** Display format: ДД.ММ.ГГГГ */
const DISPLAY_RE = /^(\d{2})\.(\d{2})\.(\d{1,4})$/;

/** BCE display format: ДД.ММ.ГГГГ днэ (backward compat: до н.э.) */
const BCE_DISPLAY_RE = /^(\d{2})\.(\d{2})\.(\d{1,4}) (?:днэ|до н\.э\.)$/;

/** Storage format: YYYY-MM-DD (year may be negative) */
const STORAGE_RE = /^(-?\d+)-(\d{2})-(\d{2})$/;

export interface HistoricalDate {
  year: number;
  month: number;
  day: number;
  era: "CE" | "BCE";
}

export function formatDisplay(iso: string): string {
  const m = STORAGE_RE.exec(iso);
  if (!m) throw new Error(`Invalid ISO date: ${iso}`);
  const [, y, mo, d] = m;
  const year = Number(y);
  if (year < 0) {
    return `${d}.${mo}.${String(-year)} днэ`;
  }
  return `${d}.${mo}.${String(year)}`;
}

export function parseDisplay(input: string): string {
  const trimmed = input.trim();

  let m = BCE_DISPLAY_RE.exec(trimmed);
  if (m) {
    const [, d, mo, y] = m;
    const day = Number(d);
    const month = Number(mo);
    const year = -Number(y);
    if (month < 1 || month > 12) throw new Error("Некорректный месяц");
    const maxDay = daysInMonth(Math.abs(year), month);
    if (day < 1 || day > maxDay) throw new Error("Некорректный день");
    return toStorage(year, month, day);
  }

  m = DISPLAY_RE.exec(trimmed);
  if (!m) throw new Error("Дата должна быть в формате ДД.ММ.ГГГГ или ДД.ММ.ГГГГ днэ");
  const [, d, mo, y] = m;
  const day = Number(d);
  const month = Number(mo);
  const year = Number(y);
  if (month < 1 || month > 12) throw new Error("Некорректный месяц");
  const maxDay = daysInMonth(year, month);
  if (day < 1 || day > maxDay) throw new Error("Некорректный день");
  if (year < 1) throw new Error("Год должен быть ≥ 1");
  return toStorage(year, month, day);
}

export function toStorage(year: number, month: number, day: number): string {
  const yStr = year < 0
    ? `-${String(-year).padStart(4, "0")}`
    : String(year).padStart(4, "0");
  return `${yStr}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function fromStorage(iso: string): HistoricalDate {
  const m = STORAGE_RE.exec(iso);
  if (!m) throw new Error(`Invalid ISO date: ${iso}`);
  const year = Number(m[1]);
  return {
    year,
    month: Number(m[2]),
    day: Number(m[3]),
    era: year > 0 ? "CE" : "BCE",
  };
}

export function toDate(iso: string): Date {
  const { year, month, day } = fromStorage(iso);
  if (year < 1) {
    return new Date((year - 1970) * 365.25 * 24 * 60 * 60 * 1000);
  }
  return new Date(Date.UTC(year, month - 1, day));
}

const ROMAN: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
  [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

function toRoman(n: number): string {
  let r = "";
  for (const [v, s] of ROMAN) {
    while (n >= v) { r += s; n -= v; }
  }
  return r;
}

export function formatCenturyYear(year: number): string | null {
  const absYear = Math.abs(year);
  if (absYear === 0 || absYear % 100 !== 0) return null;
  const century = Math.ceil(absYear / 100);
  const suffix = year < 0 ? " в днэ" : " в";
  return `${toRoman(century)}${suffix}`;
}

export function compareIso(a: string, b: string): number {
  const ma = STORAGE_RE.exec(a);
  const mb = STORAGE_RE.exec(b);
  if (!ma || !mb) throw new Error(`Invalid ISO date for comparison: ${a}, ${b}`);
  const ya = Number(ma[1]), yb = Number(mb[1]);
  if (ya !== yb) return ya - yb;
  return a.slice(5).localeCompare(b.slice(5));
}

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeap(Math.abs(year)) ? 29 : 28;
  return MONTH_DAYS[month - 1];
}
