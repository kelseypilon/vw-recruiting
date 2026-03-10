"use client";

import { useState, useRef, useEffect, useMemo } from "react";

/* ── Types ──────────────────────────────────────────────────────── */

interface DateTimePickerProps {
  /** ISO-ish value like "2026-03-15T14:30" (same format as datetime-local) */
  value: string;
  /** Called with same format string */
  onChange: (value: string) => void;
  /** Optional className for the outer wrapper */
  className?: string;
  /** Placeholder text when no value is selected */
  placeholder?: string;
}

/* ── Helpers ─────────────────────────────────────────────────────── */

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Parse a datetime-local string into parts, or return null */
function parseValue(val: string) {
  if (!val) return null;
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  return {
    year: d.getFullYear(),
    month: d.getMonth(),
    day: d.getDate(),
    hours: d.getHours(),
    minutes: d.getMinutes(),
  };
}

/** Build a datetime-local string from parts */
function buildValue(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number
): string {
  return `${year}-${pad(month + 1)}-${pad(day)}T${pad(hours)}:${pad(minutes)}`;
}

/** Get the calendar grid for a given month */
function getCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: { day: number; inMonth: boolean; date: Date }[] = [];

  // Previous month trailing days
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    cells.push({ day: d, inMonth: false, date: new Date(year, month - 1, d) });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, inMonth: true, date: new Date(year, month, d) });
  }

  // Next month leading days (fill to 42 = 6 rows)
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, inMonth: false, date: new Date(year, month + 1, d) });
  }

  return cells;
}

/* ── Component ──────────────────────────────────────────────────── */

export default function DateTimePicker({
  value,
  onChange,
  className = "",
  placeholder = "Select date & time",
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial value or use today for navigation
  const parsed = parseValue(value);
  const now = new Date();
  const [viewYear, setViewYear] = useState(parsed?.year ?? now.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.month ?? now.getMonth());

  // Selected date parts
  const [selectedYear, setSelectedYear] = useState(parsed?.year ?? 0);
  const [selectedMonth, setSelectedMonth] = useState(parsed?.month ?? 0);
  const [selectedDay, setSelectedDay] = useState(parsed?.day ?? 0);
  const hasDate = selectedYear > 0;

  // Time parts (default to 9:00 AM)
  const h24 = parsed?.hours ?? 9;
  const [hour12, setHour12] = useState(() => {
    const h = h24 % 12;
    return h === 0 ? 12 : h;
  });
  const [minute, setMinute] = useState(parsed?.minutes ?? 0);
  const [amPm, setAmPm] = useState<"AM" | "PM">(() => (h24 >= 12 ? "PM" : "AM"));

  // Sync when external value changes
  useEffect(() => {
    const p = parseValue(value);
    if (p) {
      setSelectedYear(p.year);
      setSelectedMonth(p.month);
      setSelectedDay(p.day);
      setViewYear(p.year);
      setViewMonth(p.month);
      const h = p.hours % 12;
      setHour12(h === 0 ? 12 : h);
      setMinute(p.minutes);
      setAmPm(p.hours >= 12 ? "PM" : "AM");
    }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  // Compute display text
  const displayText = useMemo(() => {
    if (!hasDate) return "";
    const d = new Date(selectedYear, selectedMonth, selectedDay);
    const dateStr = d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const timeStr = `${hour12}:${pad(minute)} ${amPm}`;
    return `${dateStr} at ${timeStr}`;
  }, [hasDate, selectedYear, selectedMonth, selectedDay, hour12, minute, amPm]);

  const calendarDays = useMemo(
    () => getCalendarDays(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function isSameDay(a: Date, year: number, month: number, day: number) {
    return (
      a.getFullYear() === year &&
      a.getMonth() === month &&
      a.getDate() === day
    );
  }

  function emitChange(
    y: number,
    m: number,
    d: number,
    h12: number,
    min: number,
    ap: "AM" | "PM"
  ) {
    let hours24 = h12 % 12;
    if (ap === "PM") hours24 += 12;
    onChange(buildValue(y, m, d, hours24, min));
  }

  function handleDayClick(cell: { day: number; inMonth: boolean; date: Date }) {
    const y = cell.date.getFullYear();
    const m = cell.date.getMonth();
    const d = cell.date.getDate();
    setSelectedYear(y);
    setSelectedMonth(m);
    setSelectedDay(d);
    setViewYear(y);
    setViewMonth(m);
    emitChange(y, m, d, hour12, minute, amPm);
  }

  function handlePrevMonth() {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function handleNextMonth() {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  function handleHourChange(h: number) {
    setHour12(h);
    if (hasDate) emitChange(selectedYear, selectedMonth, selectedDay, h, minute, amPm);
  }

  function handleMinuteChange(m: number) {
    setMinute(m);
    if (hasDate) emitChange(selectedYear, selectedMonth, selectedDay, hour12, m, amPm);
  }

  function handleAmPmChange(ap: "AM" | "PM") {
    setAmPm(ap);
    if (hasDate) emitChange(selectedYear, selectedMonth, selectedDay, hour12, minute, ap);
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 rounded-lg border border-[#a59494]/40 text-sm text-left bg-white focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition flex items-center gap-2"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#a59494"
          strokeWidth="2"
          className="shrink-0"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span className={displayText ? "text-[#272727]" : "text-[#a59494]"}>
          {displayText || placeholder}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 bg-white rounded-xl border border-[#a59494]/20 shadow-xl p-4 w-[300px] left-0">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-md hover:bg-[#f5f0f0] transition text-[#272727]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-[#272727]">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-md hover:bg-[#f5f0f0] transition text-[#272727]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div
                key={d}
                className="text-center text-[10px] font-semibold text-[#a59494] uppercase py-1"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {calendarDays.map((cell, i) => {
              const isToday = isSameDay(
                today,
                cell.date.getFullYear(),
                cell.date.getMonth(),
                cell.date.getDate()
              );
              const isSelected =
                hasDate &&
                isSameDay(
                  cell.date,
                  selectedYear,
                  selectedMonth,
                  selectedDay
                );

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleDayClick(cell)}
                  className={`
                    w-full aspect-square flex items-center justify-center rounded-md text-xs transition
                    ${!cell.inMonth ? "text-[#a59494]/40" : "text-[#272727]"}
                    ${isSelected ? "bg-brand text-white font-semibold" : ""}
                    ${isToday && !isSelected ? "ring-1 ring-brand font-semibold" : ""}
                    ${!isSelected ? "hover:bg-[#f5f0f0]" : ""}
                  `}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="border-t border-[#a59494]/10 my-3" />

          {/* Time picker */}
          <div className="flex items-center gap-2">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#a59494"
              strokeWidth="2"
              className="shrink-0"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <select
              value={hour12}
              onChange={(e) => handleHourChange(Number(e.target.value))}
              className="px-2 py-1.5 rounded-md border border-[#a59494]/30 text-sm text-[#272727] bg-white focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
            >
              {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
            <span className="text-sm font-semibold text-[#272727]">:</span>
            <select
              value={minute}
              onChange={(e) => handleMinuteChange(Number(e.target.value))}
              className="px-2 py-1.5 rounded-md border border-[#a59494]/30 text-sm text-[#272727] bg-white focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
            >
              {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
                <option key={m} value={m}>
                  {pad(m)}
                </option>
              ))}
            </select>
            <div className="flex rounded-md border border-[#a59494]/30 overflow-hidden">
              <button
                type="button"
                onClick={() => handleAmPmChange("AM")}
                className={`px-2.5 py-1.5 text-xs font-semibold transition ${
                  amPm === "AM"
                    ? "bg-brand text-white"
                    : "bg-white text-[#272727] hover:bg-[#f5f0f0]"
                }`}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => handleAmPmChange("PM")}
                className={`px-2.5 py-1.5 text-xs font-semibold transition ${
                  amPm === "PM"
                    ? "bg-brand text-white"
                    : "bg-white text-[#272727] hover:bg-[#f5f0f0]"
                }`}
              >
                PM
              </button>
            </div>
          </div>

          {/* Done button */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full mt-3 px-3 py-2 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-semibold transition"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
