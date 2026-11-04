// Reports: the shapes the API sends, how numbers and dates are written (rupees in lakh and crore, Indian grouping),
// and how a report's view is kept in the page address. Pure, so it is tested without a browser.

export type ReportFormat = "rupees" | "number" | "percent" | "date" | "month" | "text";
export type VisualType = "KPI" | "BAR" | "COLUMN" | "LINE" | "STACKED" | "PARETO" | "FUNNEL" | "HEATMAP" | "TABLE";

export interface ReportMetric {
  code: string;
  label: string;
  format: ReportFormat;
  definition: string;
  caveat: string | null;
  isKpi: boolean;
}

export interface ReportListItem {
  code: string;
  label: string;
  question: string;
  hasPeriod: boolean;
}

export interface ReportDomain {
  code: string;
  label: string;
  description: string | null;
  reports: ReportListItem[];
}

export interface ReportCatalogue {
  domains: ReportDomain[];
}

export interface ReportVisual {
  type: VisualType;
  title: string;
  /** The dimension on the x axis. */
  x: string | null;
  /** The measure on the y axis. */
  y: string | null;
}

export interface ReportDetail {
  code: string;
  label: string;
  question: string;
  domain: { code: string; label: string };
  version: number;
  periods: { code: string; label: string }[];
  defaultPeriod: string | null;
  metrics: ReportMetric[];
  rowDimension: { code: string; label: string };
  breakdowns: { code: string; label: string }[];
  filters: { column: string; label: string; operator: "IN"; editable: boolean }[];
  visuals: ReportVisual[];
}

export interface ReportRow {
  dims: Record<string, string>;
  values: Record<string, number | null>;
}

export interface ReportResult {
  report: { code: string; label: string; question: string };
  period: { code: string | null; label: string; from: string; to: string } | null;
  basis: "NET" | "PATIENT_PAYABLE";
  basisLabel: string;
  dataAsOf: string | null;
  refreshedAt: string | null;
  attributedShare: number | null;
  metrics: ReportMetric[];
  rows: ReportRow[];
  totals: Record<string, number | null>;
  smallGroupsMerged: number;
}

export interface RunBody {
  period?: string | { from: string; to: string };
  filters?: { column: string; values: string[] }[];
  breakdown?: string | null;
  /** Group by another dimension of the report than its row dimension (revenue by visit type, next to revenue by source). */
  groupBy?: string | null;
}

// ─── Numbers ─────────────────────────────────────────────────────────────────

const RUPEE = "₹";
const LAKH = 1e5;
const CRORE = 1e7;

/** 1234567 -> "12,34,567": the last three digits, then pairs. */
export function indianGrouping(whole: string): string {
  if (whole.length <= 3) return whole;
  const tail = whole.slice(-3);
  const head = whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `${head},${tail}`;
}

function grouped(n: number, decimals = 0): string {
  const fixed = Math.abs(n).toFixed(decimals);
  const [whole, frac] = fixed.split(".") as [string, string | undefined];
  return `${n < 0 && Number(fixed) !== 0 ? "-" : ""}${indianGrouping(whole)}${frac ? `.${frac}` : ""}`;
}

/** Whole rupees with Indian grouping: ₹12,34,567. */
export const formatRupees = (n: number) => `${n < 0 && Math.round(n) !== 0 ? "-" : ""}${RUPEE}${grouped(Math.abs(n))}`;

const oneDecimal = (n: number) => String(Number(n.toFixed(1)));

/** Short form for tiles: ₹12.3 L from a lakh, ₹1.2 Cr from a crore, full grouping below a lakh. */
export function formatRupeesCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= CRORE) return `${sign}${RUPEE}${oneDecimal(abs / CRORE)} Cr`;
  if (abs >= LAKH) return `${sign}${RUPEE}${oneDecimal(abs / LAKH)} L`;
  return formatRupees(n);
}

/** A whole number with Indian grouping: 1,23,456. */
export const formatNumber = (n: number) => grouped(Math.round(n));

/** A fraction as a percentage with at most one decimal: 0.1234 -> "12.3%", 1 -> "100%". */
export const formatPercent = (fraction: number) => `${oneDecimal(fraction * 100)}%`;

// ─── Dates ───────────────────────────────────────────────────────────────────

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = /^(\d{4})-(\d{2})-(\d{2})/;

/** "2026-09-05" -> "05-Sep-2026". Anything that isn't a day is returned as it came. */
export function formatDay(day: string): string {
  const m = DAY.exec(day);
  return m ? `${m[3]}-${MONTHS[Number(m[2]) - 1]}-${m[1]}` : day;
}

/** "2026-09-01" -> "Sep 2026". */
export function formatMonth(day: string): string {
  const m = DAY.exec(day);
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : day;
}

/** Writes a value the way its format says. A missing value is a dash, never a zero. */
export function formatValue(format: ReportFormat, value: number | string | null | undefined, compact = false): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return format === "date" ? formatDay(value) : format === "month" ? formatMonth(value) : value;
  switch (format) {
    case "rupees":
      return compact ? formatRupeesCompact(value) : formatRupees(value);
    case "percent":
      return formatPercent(value);
    case "number":
      return formatNumber(value);
    default:
      return String(value);
  }
}

/** A dimension value as shown: a month start (2026-04-01) as "Apr 2026", another day as a date, anything else as it is. */
export function formatDimension(value: string): string {
  const m = DAY.exec(value);
  if (!m || value.length !== 10) return value;
  return m[3] === "01" ? formatMonth(value) : formatDay(value);
}

// ─── Rows ────────────────────────────────────────────────────────────────────

/** Rows that say what could not be placed. They are always shown, in a muted colour, and never counted in a top 10. */
export const isMutedLabel = (label: string) => /^(unknown|not matched|other|no band)\b/i.test(label.trim());

/** Chart colour classes, in series order. Literal strings so Tailwind generates them; the colours are theme tokens. */
export const SERIES_FILL = ["bg-chart-blue", "bg-chart-orange", "bg-chart-green", "bg-chart-pink", "bg-chart-brown", "bg-chart-grey", "bg-chart-violet"] as const;
export const MUTED_FILL = "bg-chart-muted";

export interface Bar {
  label: string;
  value: number;
  muted: boolean;
}

/**
 * Largest first, the top `limit` named rows, then every muted row (Unknown, Not matched, Other) whatever its size.
 * A row with no value is left out of a chart; it stays in the table.
 */
export function barRows(rows: ReportRow[], dimension: string, metric: string, limit = 10): Bar[] {
  const all = rows
    .map((r) => ({ label: r.dims[dimension] ?? "", value: r.values[metric] }))
    .filter((r): r is { label: string; value: number } => r.value !== null && r.value !== undefined && r.label !== "")
    .map((r) => ({ ...r, muted: isMutedLabel(r.label) }));
  const named = all.filter((r) => !r.muted).sort((a, b) => b.value - a.value).slice(0, limit);
  const muted = all.filter((r) => r.muted).sort((a, b) => b.value - a.value);
  return [...named, ...muted];
}

/** The rows in the order the API gave them (band order, month order): for column charts. */
export function columnRows(rows: ReportRow[], dimension: string, metric: string): Bar[] {
  return rows
    .map((r) => ({ label: r.dims[dimension] ?? "", value: r.values[metric] }))
    .filter((r): r is { label: string; value: number } => r.value !== null && r.value !== undefined && r.label !== "")
    .map((r) => ({ ...r, muted: isMutedLabel(r.label) }));
}

export interface Stacked {
  /** The x values (months) in order. */
  xs: string[];
  /** One series per row-dimension value; values line up with xs. The last series may be the muted Other. */
  series: { label: string; muted: boolean; values: number[] }[];
}

/**
 * Rows with two dimensions into columns (x) stacked by series. At most `maxSeries` named series; the rest, and any muted
 * rows, are folded into one muted "Other" series so the legend stays readable and the columns still add up.
 */
export function pivotStacked(rows: ReportRow[], seriesDim: string, xDim: string, metric: string, maxSeries = 7): Stacked {
  const xs = [...new Set(rows.map((r) => r.dims[xDim]).filter((x): x is string => !!x))].sort();
  const totals = new Map<string, number>();
  for (const r of rows) {
    const s = r.dims[seriesDim];
    if (s !== undefined) totals.set(s, (totals.get(s) ?? 0) + (r.values[metric] ?? 0));
  }
  const named = [...totals]
    .filter(([label]) => !isMutedLabel(label))
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxSeries)
    .map(([label]) => label);
  const index = new Map(xs.map((x, i) => [x, i]));
  const series = new Map<string, number[]>(named.map((label) => [label, xs.map(() => 0)]));
  const other = xs.map(() => 0);
  let hasOther = false;
  for (const r of rows) {
    const i = index.get(r.dims[xDim] ?? "");
    const v = r.values[metric];
    if (i === undefined || v === null || v === undefined) continue;
    const mine = series.get(r.dims[seriesDim] ?? "");
    if (mine) mine[i]! += v;
    else {
      other[i]! += v;
      hasOther = true;
    }
  }
  const out = named.map((label) => ({ label, muted: false, values: series.get(label)! }));
  if (hasOther) out.push({ label: "Other and unknown", muted: true, values: other });
  return { xs, series: out };
}

export type SortDir = "asc" | "desc";

/** Sorts a copy of the rows by a dimension (text) or a measure (number). Missing values go last either way. */
export function sortRows(rows: ReportRow[], key: string, kind: "dim" | "metric", dir: SortDir): ReportRow[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (kind === "dim") return sign * (a.dims[key] ?? "").localeCompare(b.dims[key] ?? "", "en", { numeric: true });
    const av = a.values[key];
    const bv = b.values[key];
    if (av === null || av === undefined) return bv === null || bv === undefined ? 0 : 1;
    if (bv === null || bv === undefined) return -1;
    return sign * (av - bv);
  });
}

/** Totals with nothing in them: no bills, nothing imported yet. */
export const isEmptyResult = (r: Pick<ReportResult, "rows" | "totals">) =>
  r.rows.length === 0 || Object.values(r.totals).every((v) => v === null || v === 0);

// ─── The view in the page address ────────────────────────────────────────────

export interface ReportView {
  /** A period code, or "custom". Empty: the report's default. */
  period: string;
  from: string;
  to: string;
  breakdown: string;
  filters: Record<string, string[]>;
}

export const EMPTY_VIEW: ReportView = { period: "", from: "", to: "", breakdown: "", filters: {} };

const FILTER_PREFIX = "f.";

/** The view held in a page address. Filters are one repeated parameter each: f.lead_source=A&f.lead_source=B. */
export function parseView(params: URLSearchParams): ReportView {
  const filters: Record<string, string[]> = {};
  for (const key of new Set(params.keys())) {
    if (!key.startsWith(FILTER_PREFIX)) continue;
    const values = params.getAll(key).filter(Boolean);
    if (values.length) filters[key.slice(FILTER_PREFIX.length)] = values;
  }
  return {
    period: params.get("period") ?? "",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    breakdown: params.get("breakdown") ?? "",
    filters,
  };
}

/** Writes a view into an address, leaving other parameters (the report code) as they are. Empty parts are dropped. */
export function writeView(base: URLSearchParams, view: ReportView): URLSearchParams {
  const next = new URLSearchParams();
  for (const [k, v] of base) if (!["period", "from", "to", "breakdown"].includes(k) && !k.startsWith(FILTER_PREFIX)) next.append(k, v);
  if (view.period) next.set("period", view.period);
  if (view.period === "custom") {
    if (view.from) next.set("from", view.from);
    if (view.to) next.set("to", view.to);
  }
  if (view.breakdown) next.set("breakdown", view.breakdown);
  for (const [column, values] of Object.entries(view.filters)) for (const v of values) next.append(`${FILTER_PREFIX}${column}`, v);
  return next;
}

/** The request body for a view. A custom range needs both days, else the report's own default period is used. */
export function runBody(view: ReportView, hasPeriod: boolean): RunBody {
  const body: RunBody = {};
  if (hasPeriod) {
    if (view.period === "custom" && view.from && view.to) body.period = { from: view.from, to: view.to };
    else if (view.period && view.period !== "custom") body.period = view.period;
  }
  const filters = Object.entries(view.filters).filter(([, v]) => v.length).map(([column, values]) => ({ column, values }));
  if (filters.length) body.filters = filters;
  if (view.breakdown) body.breakdown = view.breakdown;
  return body;
}

/**
 * The other axes the report's bars and columns are drawn on: a chart whose x is not the report's row dimension needs the
 * same numbers grouped by that dimension, which is a run of its own.
 */
export const extraAxes = (visuals: { type: string; x: string | null }[], rowDimension: string): string[] => [
  ...new Set(visuals.filter((v) => (v.type === "BAR" || v.type === "COLUMN") && v.x && v.x !== rowDimension).map((v) => v.x!)),
];

/** The view without its breakdown: the run that feeds the tiles, bars and columns, which must not be split. */
export const withoutBreakdown = (view: ReportView): ReportView => ({ ...view, breakdown: "" });

/** A custom range is usable when both days are set and the end is not before the start. */
export const customRangeProblem = (from: string, to: string): string | null =>
  !from || !to ? "Choose both days." : to < from ? "The end day is before the start day." : null;

/** A short sentence for what the totals cover, e.g. under the title. */
export function periodText(period: ReportResult["period"]): string | null {
  return period ? `${period.label}: ${formatDay(period.from)} to ${formatDay(period.to)}` : null;
}
