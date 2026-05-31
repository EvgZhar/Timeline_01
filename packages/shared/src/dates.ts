/** Display format: ДД.ММ.ГГГГ или ДД.ММ.ГГГГ до н.э. */
const DISPLAY_RE = /^(\d{2})\.(\d{2})\.(-?\d{1,5})\s*(до н\.э\.)?$/;

/** Storage format: YYYY-MM-DD (ISO 8601 extended, negative years for BCE) */
const STORAGE_RE = /^(-?\d{1,5})-(\d{2})-(\d{2})$/;

export interface HistoricalDate {
  year: number;
  month: number;
  day: number;
  era: "CE" | "BCE";
}

const ROMAN: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
  [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

export function toRoman(n: number): string {
  if (n < 1 || n > 10000) throw new Error("Year out of range for Roman numeral");
  let result = "";
  let remaining = n;
  for (const [value, numeral] of ROMAN) {
    while (remaining >= value) {
      result += numeral;
      remaining -= value;
    }
  }
  return result;
}

/**
 * If the date is January 1 of a century year (multiple of 100),
 * return a compact century string like "XII век" or "V век д.н.э.".
 * Otherwise return null.
 */
export function formatCentury(iso: string): string | null {
  const parts = iso.split("-");
  if (parts.length !== 3) return null;
  const [, month, day] = parts;
  if (month !== "01" || day !== "01") return null;

  const y = Number(parts[0]);
  if (y % 100 !== 0) return null;

  let century: number;
  let suffix: string;

  if (y >= 1) {
    century = Math.floor(y / 100) + 1;
    suffix = "";
  } else if (y === 0) {
    century = 1;
    suffix = " д.н.э.";
  } else {
    century = Math.ceil((1 - y) / 100);
    suffix = " д.н.э.";
  }

  return `${toRoman(century)} век${suffix}`;
}

export function formatDisplay(iso: string): string {
  const m = STORAGE_RE.exec(iso);
  if (!m) throw new Error(`Invalid ISO date: ${iso}`);
  const [, y, mo, d] = m;
  const yearNum = Number(y);
  const suffix = yearNum < 1 ? " до н.э." : "";
  const absYear = yearNum < 0 ? -yearNum : yearNum;
  return `${d}.${mo}.${absYear}${suffix}`;
}

export function parseDisplay(input: string): string {
  const trimmed = input.trim();
  const m = DISPLAY_RE.exec(trimmed);
  if (!m) throw new Error("Дата должна быть в формате ДД.ММ.ГГГГ или ДД.ММ.ГГГГ до н.э.");
  const [, d, mo, yStr, bce] = m;
  const day = Number(d);
  const month = Number(mo);
  const absYear = Number(yStr);
  if (month < 1 || month > 12) throw new Error("Некорректный месяц");
  if (absYear < 1) throw new Error("Некорректный год");
  const year = bce ? -absYear : absYear;
  const maxDay = daysInMonth(year, month);
  if (day < 1 || day > maxDay) throw new Error("Некорректный день");
  return toStorage(year, month, day);
}

export function toStorage(year: number, month: number, day: number): string {
  const abs = Math.abs(year);
  const sign = year < 0 ? "-" : "";
  return `${sign}${String(abs).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function fromStorage(iso: string): HistoricalDate {
  const m = STORAGE_RE.exec(iso);
  if (!m) throw new Error(`Invalid ISO date: ${iso}`);
  const year = Number(m[1]);
  return {
    year,
    month: Number(m[2]),
    day: Number(m[3]),
    era: year < 1 ? "BCE" : "CE",
  };
}

const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;
const MONTH_MS = 30.4375 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Convert an ISO date to a linear ms timestamp.
 * For CE years uses Date.UTC for exact calendar alignment.
 * For BCE years falls back to a linear year-based approximation.
 */
export function toDate(iso: string): Date {
  const { year, month, day } = fromStorage(iso);
  if (year >= 1) {
    return new Date(Date.UTC(year, month - 1, day));
  }
  // BCE: JS Date cannot represent negative years, use linear mapping
  const ms = (year - 1970) * YEAR_MS + (month - 1) * MONTH_MS + (day - 1) * DAY_MS;
  return new Date(ms);
}

export function compareIso(a: string, b: string): number {
  const ay = Number(a.split("-")[0]);
  const by = Number(b.split("-")[0]);
  if (ay !== by) return ay - by;
  return a.localeCompare(b);
}

/**
 * Proleptic Gregorian: days in month for any year (including BCE).
 */
export function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const isLeap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return isLeap ? 29 : 28;
  }
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/**
 * Zeller's congruence: day of week (0=Sun…6=Sat) for proleptic Gregorian.
 */
export function zellerWeekday(year: number, month: number, day: number): number {
  if (month < 3) { year--; month += 12; }
  const y = year < 0 ? year + 1 : year;
  const q = day;
  const m = month;
  const k = y % 100;
  const j = Math.floor(y / 100);
  const h = (q + Math.floor(13 * (m + 1) / 5) + k + Math.floor(k / 4) + Math.floor(j / 4) - 2 * j) % 7;
  return ((h + 6) % 7 + 7) % 7; // 0=Mon…6=Sun
}
