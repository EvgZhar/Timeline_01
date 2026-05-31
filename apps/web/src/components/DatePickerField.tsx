import { Calendar } from "lucide-react";
import { formatDisplay, parseDisplay, toStorage, fromStorage } from "@timeline/shared";
import { useEffect, useRef, useState } from "react";

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
}

function getCalendarDays(year: number, month: number): (number | null)[] {
  const firstDay = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  let startWeekday = firstDay.getUTCDay(); // 0=Sun, 1=Mon
  if (startWeekday === 0) startWeekday = 7;
  const days: (number | null)[] = [];
  for (let i = 1; i < startWeekday; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);
  return days;
}

export function DatePickerField({ label, value, onChange, placeholder }: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [viewYear, setViewYear] = useState(new Date().getUTCFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getUTCMonth());
  const [era, setEra] = useState<"CE" | "BCE">("CE");
  const [yearStr, setYearStr] = useState(String(viewYear));
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputValue(value);
    try {
      const hd = fromStorage(parseDisplay(value));
      setViewYear(Math.abs(hd.year));
      setYearStr(String(Math.abs(hd.year)));
      setEra(hd.era);
      setViewMonth(hd.month - 1);
    } catch {
      // ignore invalid initial value
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
    const signedYear = era === "BCE" ? -viewYear : viewYear;
    const iso = toStorage(signedYear, viewMonth + 1, day);
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
    const hd = fromStorage(parseDisplay(value));
    const signedViewYear = era === "BCE" ? -viewYear : viewYear;
    if (hd.year === signedViewYear && hd.month - 1 === viewMonth) {
      selectedDay = hd.day;
    }
  } catch {
    // ignore
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm">
        {label}
        <div className="mt-1 flex items-center gap-1">
          <input
            className="w-full rounded border px-2 py-1"
            value={inputValue}
            placeholder={placeholder}
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
        <div className="absolute right-0 z-50 mt-1 w-64 rounded border bg-white p-2 shadow-lg">
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
                type="text"
                className="w-16 rounded border px-1 py-0.5 text-center text-sm"
                value={yearStr}
                onChange={(e) => setYearStr(e.target.value)}
                onBlur={() => {
                  const y = Number(yearStr);
                  if (!isNaN(y) && y >= 1) {
                    setViewYear(y);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const y = Number(yearStr);
                    if (!isNaN(y) && y >= 1) {
                      setViewYear(y);
                    }
                  }
                }}
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

          {/* Era row */}
          <div className="mb-2 flex justify-center gap-3 text-xs">
            <label className="flex cursor-pointer items-center gap-1">
              <input
                type="radio"
                name="era"
                checked={era === "CE"}
                onChange={() => setEra("CE")}
              />
              н.э.
            </label>
            <label className="flex cursor-pointer items-center gap-1">
              <input
                type="radio"
                name="era"
                checked={era === "BCE"}
                onChange={() => setEra("BCE")}
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
