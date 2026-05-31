import { Calendar } from "lucide-react";
import {
  formatDisplay,
  parseDisplay,
  daysInMonth,
  zellerWeekday,
  toStorage,
} from "@timeline/shared";
import { useEffect, useRef, useState, useCallback } from "react";

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

interface DatePickerFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  popupAlign?: "left" | "right";
}

function getCalendarDays(year: number, month: number): (number | null)[] {
  const totalDays = daysInMonth(year, month + 1);
  const startWeekday = zellerWeekday(year, month + 1, 1);
  const days: (number | null)[] = [];
  for (let i = 1; i <= startWeekday; i++) days.push(null);
  for (let d = 1; d <= totalDays; d++) days.push(d);
  return days;
}

function parseViewValue(value: string): {
  year: number;
  month: number;
  day: number | null;
} {
  try {
    const iso = parseDisplay(value);
    const parts = iso.split("-");
    return {
      year: Number(parts[0]),
      month: Number(parts[1]) - 1,
      day: Number(parts[2]),
    };
  } catch {
    return { year: new Date().getUTCFullYear(), month: new Date().getUTCMonth(), day: null };
  }
}

export function DatePickerField({ label, value, onChange, placeholder, popupAlign = "left" }: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [viewYear, setViewYear] = useState(new Date().getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getUTCMonth());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
    const parsed = parseViewValue(value);
    if (parsed.day !== null) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    try {
      parseDisplay(inputValue);
      onChange(inputValue);
    } catch {
      setInputValue(value);
    }
  };

  const selectDate = (day: number) => {
    const iso = toStorage(viewYear, viewMonth + 1, day);
    const display = formatDisplay(iso);
    onChange(display);
    setOpen(false);
  };

  const calendarDays = getCalendarDays(viewYear, viewMonth);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7));
  }

  let selectedDay: number | null = null;
  try {
    const iso = parseDisplay(value);
    const parts = iso.split("-");
    const sy = Number(parts[0]);
    const sm = Number(parts[1]);
    const sd = Number(parts[2]);
    if (sy === viewYear && sm - 1 === viewMonth) {
      selectedDay = sd;
    }
  } catch {
    // ignore
  }

  const isBce = viewYear < 1;

  const toggleEra = useCallback(() => {
    setViewYear((y) => (y < 1 ? (y === 0 ? 1 : -y) : -(y - 1)));
  }, []);

  const handleCalYearChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (raw === "" || raw === "-") return;
      const n = Number(raw);
      if (!Number.isNaN(n)) setViewYear(n);
    },
    [],
  );

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm">
        {label}
        <div className="mt-1 flex items-center gap-1">
          <input
            className="w-full rounded border px-2 py-1"
            value={inputValue}
            placeholder={placeholder ?? "ДД.ММ.ГГГГ"}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleInputBlur();
              }
            }}
          />
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="rounded border p-1 text-slate-600 hover:bg-slate-100"
            aria-label="Открыть календарь"
          >
            <Calendar size={18} />
          </button>
        </div>
      </label>

      {open && (
        <div className={`absolute z-50 mt-1 w-64 rounded border bg-white p-2 shadow-lg ${popupAlign === "right" ? "right-0" : "left-0"}`}>
          {/* Header: month/year selectors + arrows */}
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              className="rounded p-1 text-slate-600 hover:bg-slate-100"
              onClick={() => {
                if (viewMonth === 0) {
                  setViewMonth(11);
                  setViewYear((y) => y - 1);
                } else {
                  setViewMonth((m) => m - 1);
                }
              }}
            >
              ◀
            </button>

            <div className="flex items-center gap-1">
              <select
                className="rounded border px-1 py-0.5 text-sm"
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
              >
                {MONTHS.map((m, i) => (
                  <option key={i} value={i}>
                    {m}
                  </option>
                ))}
              </select>
              <input
                type="number"
                className="w-20 rounded border px-1 py-0.5 text-sm text-right"
                value={viewYear}
                onChange={handleCalYearChange}
              />
            </div>

            <button
              type="button"
              className="rounded p-1 text-slate-600 hover:bg-slate-100"
              onClick={() => {
                if (viewMonth === 11) {
                  setViewMonth(0);
                  setViewYear((y) => y + 1);
                } else {
                  setViewMonth((m) => m + 1);
                }
              }}
            >
              ▶
            </button>
          </div>

          {/* Era toggle */}
          <div className="mb-2 flex justify-center gap-3 text-xs">
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name={`era-${label}`}
                checked={!isBce}
                onChange={() => {
                  if (isBce) setViewYear((y) => (y === 0 ? 1 : -y));
                }}
              />
              н.э.
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name={`era-${label}`}
                checked={isBce}
                onChange={toggleEra}
              />
              до н.э.
            </label>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-0.5 text-center text-xs text-slate-500">
            {WEEKDAYS.map((wd) => (
              <div key={wd}>{wd}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {weeks.map((week, wi) =>
              week.map((day, di) => {
                const isSelected = day === selectedDay;
                return (
                  <button
                    key={`${wi}-${di}`}
                    type="button"
                    disabled={day === null}
                    onClick={() => day !== null && selectDate(day)}
                    className={`rounded p-1 text-center text-sm ${
                      day === null
                        ? "invisible"
                        : isSelected
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "hover:bg-slate-100"
                    }`}
                  >
                    {day ?? ""}
                  </button>
                );
              }),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
