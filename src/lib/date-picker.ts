// Calendar-day arithmetic for the date picker. Days are plain "YYYY-MM-DD" strings (the same shape <input type="date">
// uses), so there is no time zone to shift them. Pure functions with no imports: copy this file to reuse it elsewhere.

export type Ymd = { y: number; m: number; d: number };

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

export const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

export const toIso = ({ y, m, d }: Ymd) => `${pad(y, 4)}-${pad(m)}-${pad(d)}`;

/** "2026-10-26" → parts; null unless it is a real calendar day (no 31 Feb). */
export function parseIso(iso: string): Ymd | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m) ? { y, m, d } : null;
}

/** Digits only, laid out as dd/mm/yyyy as they are typed: "1508" → "15/08", "15081990" → "15/08/1990". */
export function maskDmy(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** "15/08/1990" → "1990-08-15"; null while it is incomplete or not a real day. */
export function parseDmy(text: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!match) return null;
  const day = { y: Number(match[3]), m: Number(match[2]), d: Number(match[1]) };
  // A year like 0020 is a typo, never a birth date or a report date.
  return day.y >= 1000 && parseIso(toIso(day)) ? toIso(day) : null;
}

export function formatDmy(iso: string): string {
  const p = parseIso(iso);
  return p ? `${pad(p.d)}/${pad(p.m)}/${pad(p.y, 4)}` : "";
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(iso: string): number {
  const p = parseIso(iso)!;
  return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
}

/** Same-shape ISO strings sort like dates, so range checks are string comparisons. */
export function inRange(iso: string, min?: string, max?: string): boolean {
  return (!min || iso >= min) && (!max || iso <= max);
}

export function addDays(iso: string, n: number): string {
  const p = parseIso(iso)!;
  const t = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
  return toIso({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() });
}

/** Moves by whole months and keeps the day when the month has it (31 Jan + 1 month → 28 Feb). */
export function addMonths(iso: string, n: number): string {
  const p = parseIso(iso)!;
  const index = p.y * 12 + (p.m - 1) + n;
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return toIso({ y, m, d: Math.min(p.d, daysInMonth(y, m)) });
}

/** The nearest allowed day to `iso`. */
export function clampDay(iso: string, min?: string, max?: string): string {
  if (min && iso < min) return min;
  if (max && iso > max) return max;
  return iso;
}

export type Cell = { iso: string; inMonth: boolean };

/** Six rows of seven days for a month, Sunday first, so the calendar never changes height. */
export function monthGrid(y: number, m: number): Cell[][] {
  const first = toIso({ y, m, d: 1 });
  const lead = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const rows: Cell[][] = [];
  for (let r = 0; r < 6; r++) {
    const row: Cell[] = [];
    for (let c = 0; c < 7; c++) {
      const iso = addDays(first, r * 7 + c - lead);
      row.push({ iso, inMonth: Number(iso.slice(5, 7)) === m });
    }
    rows.push(row);
  }
  return rows;
}

/** The years offered in the year list. Open-ended ranges get a sensible span around `anchorYear`. */
export function yearSpan(anchorYear: number, min?: string, max?: string): { from: number; to: number } {
  const from = min ? Number(min.slice(0, 4)) : (max ? Number(max.slice(0, 4)) : anchorYear) - 120;
  const to = max ? Number(max.slice(0, 4)) : (min ? Number(min.slice(0, 4)) : anchorYear) + 20;
  return { from, to: Math.max(from, to) };
}

/** Today's day on this device's clock. */
export function todayLocal(now = new Date()): string {
  return toIso({ y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() });
}
