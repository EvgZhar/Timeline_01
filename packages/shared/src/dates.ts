/** Display format: ДД.ММ.ГГГГ */
const DISPLAY_RE = /^(\d{2})\.(\d{2})\.(\d{4})$/;

/** Storage format: YYYY-MM-DD */
const STORAGE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

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
  return `${d}.${mo}.${y}`;
}

export function parseDisplay(input: string): string {
  const trimmed = input.trim();
  const m = DISPLAY_RE.exec(trimmed);
  if (!m) throw new Error("Дата должна быть в формате ДД.ММ.ГГГГ");
  const [, d, mo, y] = m;
  const day = Number(d);
  const month = Number(mo);
  const year = Number(y);
  if (month < 1 || month > 12) throw new Error("Некорректный месяц");
  const maxDay = daysInMonth(year, month);
  if (day < 1 || day > maxDay) throw new Error("Некорректный день");
  if (year < 1) throw new Error("Год должен быть ≥ 1 (до н. э. — в следующих версиях)");
  return toStorage(year, month, day);
}

export function toStorage(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function fromStorage(iso: string): HistoricalDate {
  const m = STORAGE_RE.exec(iso);
  if (!m) throw new Error(`Invalid ISO date: ${iso}`);
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    era: "CE",
  };
}

export function toDate(iso: string): Date {
  const { year, month, day } = fromStorage(iso);
  return new Date(Date.UTC(year, month - 1, day));
}

export function compareIso(a: string, b: string): number {
  return a.localeCompare(b);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}
