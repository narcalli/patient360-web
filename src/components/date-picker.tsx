"use client";

// A date field people can actually use: type the date (15081990 lays itself out as 15/08/1990), or open the calendar
// and jump straight to a month and year from the lists instead of clicking back month by month. Keyboard and screen
// readers work throughout.
//
// The value is a plain "YYYY-MM-DD" string (what <input type="date"> gives), "" while empty or not a complete,
// allowed date. min and max are "YYYY-MM-DD" too and are enforced as you type and in the calendar.
//
// To reuse in another project, copy this file, lib/date-picker.ts and the icons it imports. It uses these theme
// tokens (Tailwind classes): surface, subtle, line, line-strong, field-line, ink, ink-soft, muted, placeholder, brand,
// brand-line, on-brand, bad; the .field input class; and --radius-control.
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import {
  addDays, addMonths, clampDay, daysInMonth, formatDmy, inRange, maskDmy, monthGrid, parseDmy, parseIso, toIso, todayLocal, weekdayOf, yearSpan,
} from "@/lib/date-picker";
import { AlertIcon, CalendarIcon, ChevronLeft, ChevronRight } from "./icons";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = [["S", "Sunday"], ["M", "Monday"], ["T", "Tuesday"], ["W", "Wednesday"], ["T", "Thursday"], ["F", "Friday"], ["S", "Saturday"]] as const;
const POPOVER_WIDTH = 312; // 19.5rem
const POPOVER_HEIGHT = 392;

export function DatePicker({
  label,
  value,
  onChange,
  min,
  max,
  optional = false,
  required = false,
  hint,
  error,
  disabled = false,
  size = "default",
  placeholder = "dd/mm/yyyy",
  autoComplete = "off",
  today: todayProp,
}: {
  label: string;
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  optional?: boolean;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string | null;
  disabled?: boolean;
  /** "compact" is for filter bars: a shorter box and smaller text. */
  size?: "default" | "compact";
  placeholder?: string;
  /** "bday" for a date of birth. */
  autoComplete?: string;
  /** Today as "YYYY-MM-DD", when the page works in another time zone than this device's. */
  today?: string;
}) {
  const id = useId();
  const today = todayProp ?? todayLocal();
  const [text, setText] = useState(value ? formatDmy(value) : "");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(today); // the day the calendar is on; its month is the one shown
  const [incomplete, setIncomplete] = useState(false);
  const [placement, setPlacement] = useState({ up: false, right: false });
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLTableElement>(null);
  const refocus = useRef(false);

  // What this text means to the page: a complete day inside the range, else "".
  const emitted = (t: string) => {
    const day = parseDmy(t);
    return day && inRange(day, min, max) ? day : "";
  };

  // The page changed the value (a form reset, a "from" date moved): show it.
  useEffect(() => {
    if (emitted(text) !== value) setText(value ? formatDmy(value) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const parsed = parseDmy(text);
  const problem =
    parsed && min && parsed < min ? `Choose a date on or after ${formatDmy(min)}.`
    : parsed && max && parsed > max ? `Choose a date on or before ${formatDmy(max)}.`
    : text.length === 10 && !parsed ? "That date doesn't exist."
    : incomplete ? "Enter the date as dd/mm/yyyy."
    : null;
  const note = error ?? problem;

  function typed(raw: string, caret: number | null) {
    const before = text.replace(/\D/g, "");
    let digits = raw.replace(/\D/g, "");
    // Backspace right after a slash only removed the slash: take the digit before it too.
    if (digits === before && raw.length < text.length && caret !== null) {
      const at = raw.slice(0, caret).replace(/\D/g, "").length;
      if (at > 0) digits = digits.slice(0, at - 1) + digits.slice(at);
    }
    const next = maskDmy(digits);
    setText(next);
    setIncomplete(false);
    const out = emitted(next);
    if (out !== value) onChange(out);
  }

  function pick(iso: string) {
    setText(iso ? formatDmy(iso) : "");
    setIncomplete(false);
    if (iso !== value) onChange(iso);
    setOpen(false);
    inputRef.current?.focus();
  }

  function openCalendar() {
    if (disabled) return;
    setCursor(clampDay(parsed && inRange(parsed, min, max) ? parsed : today, min, max));
    refocus.current = true;
    setOpen(true);
  }

  // Opens above or to the left when there is no room below or to the right.
  useLayoutEffect(() => {
    if (!open || !boxRef.current) return;
    const r = boxRef.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    setPlacement({
      up: below < POPOVER_HEIGHT && r.top > below,
      right: r.left + POPOVER_WIDTH > window.innerWidth - 8 && r.right - POPOVER_WIDTH >= 8,
    });
  }, [open]);

  // Keyboard moves put focus on the new day; mouse use on the month and year lists must not.
  useEffect(() => {
    if (!open || !refocus.current) return;
    refocus.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${cursor}"]`)?.focus();
  }, [open, cursor]);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const view = parseIso(cursor)!;
  const move = (iso: string) => {
    refocus.current = true;
    setCursor(clampDay(iso, min, max));
  };
  // Month and year lists keep the day number where the new month has it.
  const jump = (y: number, m: number) => setCursor(clampDay(toIso({ y, m, d: Math.min(view.d, daysInMonth(y, m)) }), min, max));

  const monthStart = toIso({ y: view.y, m: view.m, d: 1 });
  const monthEnd = toIso({ y: view.y, m: view.m, d: daysInMonth(view.y, view.m) });
  const prevDisabled = !!min && addDays(monthStart, -1) < min;
  const nextDisabled = !!max && addDays(monthEnd, 1) > max;
  const span = yearSpan(view.y, min, max);
  const years = Array.from({ length: span.to - span.from + 1 }, (_, i) => span.from + i);
  if (!(min && !max)) years.reverse(); // newest first, except for a field that only looks ahead
  const monthAllowed = (m: number) => {
    const first = toIso({ y: view.y, m, d: 1 });
    return inRange(first, undefined, max) && inRange(toIso({ y: view.y, m, d: daysInMonth(view.y, m) }), min);
  };
  const selected = parsed && inRange(parsed, min, max) ? parsed : "";

  function onGridKey(e: React.KeyboardEvent) {
    const steps: Record<string, string> = {
      ArrowLeft: addDays(cursor, -1),
      ArrowRight: addDays(cursor, 1),
      ArrowUp: addDays(cursor, -7),
      ArrowDown: addDays(cursor, 7),
      PageUp: addMonths(cursor, e.shiftKey ? -12 : -1),
      PageDown: addMonths(cursor, e.shiftKey ? 12 : 1),
      Home: addDays(cursor, -weekdayOf(cursor)),
      End: addDays(cursor, 6 - weekdayOf(cursor)),
    };
    const to = steps[e.key];
    if (to === undefined) return;
    e.preventDefault();
    move(to);
  }

  const compact = size === "compact";
  const navButton = "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-ink-soft hover:bg-subtle disabled:opacity-30 disabled:hover:bg-transparent";
  const listBox = "min-h-9 min-w-0 rounded-[var(--radius-control)] border border-line-strong bg-surface px-2 text-sm font-semibold text-ink";

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold">
        {label} {optional && <span className="font-normal text-muted">(optional)</span>}
      </label>
      <div
        ref={boxRef}
        className="relative mt-1.5"
        onBlur={(e) => {
          // Tabbing out closes it; clicking elsewhere is handled by the pointer listener.
          if (open && e.relatedTarget && !e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false);
        }}
      >
        <input
          id={id}
          ref={inputRef}
          className={`field tabular pr-12 ${compact ? "min-h-11 text-sm" : ""} ${error || problem ? "border-bad" : ""}`}
          inputMode="numeric"
          autoComplete={autoComplete}
          placeholder={placeholder}
          maxLength={10}
          value={text}
          disabled={disabled}
          aria-required={required || undefined}
          aria-invalid={note ? true : undefined}
          aria-describedby={note || hint ? `${id}-note` : undefined}
          onChange={(e) => typed(e.target.value, e.target.selectionStart)}
          onBlur={() => setIncomplete(text.length > 0 && !parsed)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && e.altKey) {
              e.preventDefault();
              openCalendar();
            }
          }}
        />
        <button
          type="button"
          className="absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[var(--radius-control)] text-ink-soft hover:bg-subtle disabled:opacity-50"
          aria-label={open ? "Close calendar" : "Open calendar"}
          aria-haspopup="dialog"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => (open ? setOpen(false) : openCalendar())}
        >
          <CalendarIcon size={20} />
        </button>

        {open && (
          <div
            role="dialog"
            aria-label={`Choose ${label.toLowerCase()}`}
            style={{ width: POPOVER_WIDTH }}
            className={`absolute z-30 max-w-[calc(100vw-1rem)] rounded-[var(--radius-control)] border border-line-strong bg-surface p-3 shadow-pop ${placement.up ? "bottom-full mb-1.5" : "top-full mt-1.5"} ${placement.right ? "right-0" : "left-0"}`}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                setOpen(false);
                inputRef.current?.focus();
              }
            }}
          >
            <div className="flex items-center gap-1">
              <button type="button" className={navButton} aria-label="Previous month" disabled={prevDisabled} onClick={() => setCursor(clampDay(addMonths(cursor, -1), min, max))}>
                <ChevronLeft size={18} />
              </button>
              <select className={`${listBox} flex-1`} aria-label="Month" value={view.m} onChange={(e) => jump(view.y, Number(e.target.value))}>
                {MONTHS.map((name, i) => (
                  <option key={name} value={i + 1} disabled={!monthAllowed(i + 1)}>{name}</option>
                ))}
              </select>
              <select className={`${listBox} w-[5.25rem]`} aria-label="Year" value={view.y} onChange={(e) => jump(Number(e.target.value), view.m)}>
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <button type="button" className={navButton} aria-label="Next month" disabled={nextDisabled} onClick={() => setCursor(clampDay(addMonths(cursor, 1), min, max))}>
                <ChevronRight size={18} />
              </button>
            </div>

            <table ref={gridRef} role="grid" aria-label={`${MONTHS[view.m - 1]} ${view.y}`} className="mt-2 w-full table-fixed border-separate border-spacing-0" onKeyDown={onGridKey}>
              <thead>
                <tr>
                  {WEEKDAYS.map(([short, full], i) => (
                    <th key={i} scope="col" abbr={full} className="h-8 text-xs font-semibold text-muted">{short}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthGrid(view.y, view.m).map((row) => (
                  <tr key={row[0]!.iso}>
                    {row.map((cell) => {
                      if (!cell.inMonth) return <td key={cell.iso} />;
                      const day = Number(cell.iso.slice(8));
                      const allowed = inRange(cell.iso, min, max);
                      const isSelected = cell.iso === selected;
                      const isToday = cell.iso === today;
                      return (
                        <td key={cell.iso} className="p-0 text-center">
                          <button
                            type="button"
                            data-day={cell.iso}
                            tabIndex={cell.iso === cursor ? 0 : -1}
                            disabled={!allowed}
                            aria-label={`${day} ${MONTHS[view.m - 1]} ${view.y}${isToday ? ", today" : ""}`}
                            aria-pressed={isSelected}
                            onClick={() => pick(cell.iso)}
                            className={`tabular mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm transition-colors ${
                              isSelected ? "bg-brand font-bold text-on-brand"
                              : allowed ? `text-ink hover:bg-subtle ${isToday ? "border border-brand-line font-bold" : ""}`
                              : "cursor-not-allowed text-muted opacity-40"
                            }`}
                          >
                            {day}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
              {value && !required ? (
                <button type="button" className="btn-ghost" onClick={() => pick("")}>Clear</button>
              ) : (
                <span />
              )}
              <button type="button" className="btn-ghost" disabled={!inRange(today, min, max)} onClick={() => pick(today)}>Today</button>
            </div>
          </div>
        )}
      </div>
      {(note || hint) && (
        <p id={`${id}-note`} className={`mt-1.5 flex items-start gap-1.5 text-sm ${note ? "font-semibold text-bad" : "text-muted"}`}>
          {note && <AlertIcon size={16} className="mt-px shrink-0" />}
          {note ?? hint}
        </p>
      )}
    </div>
  );
}
