"use client";

import { useId, useMemo, useState } from "react";
import { ColumnChartIcon, HBarsIcon, LineChartIcon, PieChartIcon, TableIcon } from "@/components/icons";
import {
  barRows,
  columnRows,
  formatDimension,
  formatValue,
  isMutedLabel,
  MUTED_FILL,
  pivotStacked,
  SERIES_FILL,
  sortRows,
  type Bar,
  type ReportMetric,
  type ReportResult,
  type ReportRow,
  type SortDir,
  type Stacked,
} from "@/lib/reports";

// Plain HTML and CSS charts: no chart library, every number is also text, and every colour is a theme token.

const pct = (value: number, max: number) => (max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0);

function ChartCard({ title, children, note }: { title: string; children: React.ReactNode; note?: React.ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="card p-4 sm:p-5">
      <h2 id={id} className="text-base font-bold">
        {title}
      </h2>
      {note && <p className="mt-0.5 text-sm text-muted">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** The totals row of tiles: one per measure marked as a key figure. Rupees are shortened (₹12.3 L) with the full amount on hover. */
export function KpiCards({ metrics, totals }: { metrics: ReportMetric[]; totals: Record<string, number | null> }) {
  const kpis = metrics.filter((m) => m.isKpi);
  if (kpis.length === 0) return null;
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Key figures">
      {kpis.map((m) => (
        <li key={m.code} className="card p-4">
          <p className="eyebrow">{m.label}</p>
          <p className="tabular mt-1 text-[22px] leading-tight font-extrabold sm:text-[26px]" title={formatValue(m.format, totals[m.code])}>
            {formatValue(m.format, totals[m.code], true)}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** The bars of a bar view: the top ten named rows, then Unknown, Not matched and Other in a muted colour. */
function BarsBody({ bars, metric }: { bars: Bar[]; metric: ReportMetric }) {
  const max = Math.max(0, ...bars.map((b) => b.value));
  if (bars.length === 0) return <p className="text-sm text-muted">Nothing to chart.</p>;
  return (
    <ul className="space-y-2.5">
      {bars.map((b) => (
        <li key={b.label} className={`grid grid-cols-[minmax(5.5rem,9rem)_1fr_auto] items-center gap-3 text-sm ${b.muted ? "text-muted" : ""}`}>
          <span className="truncate" title={b.label}>
            {formatDimension(b.label)}
          </span>
          <span className="h-3 overflow-hidden rounded-full bg-subtle" aria-hidden="true">
            <span className={`block h-full rounded-full ${b.muted ? MUTED_FILL : SERIES_FILL[0]}`} style={{ width: `${pct(b.value, max)}%` }} />
          </span>
          <span className="tabular min-w-16 text-right font-semibold">{formatValue(metric.format, b.value, true)}</span>
        </li>
      ))}
    </ul>
  );
}

/** The columns of a column view, in the order the report gives (spend bands low to high). */
function ColumnsBody({ bars, metric }: { bars: Bar[]; metric: ReportMetric }) {
  const max = Math.max(0, ...bars.map((b) => b.value));
  if (bars.length === 0) return <p className="text-sm text-muted">Nothing to chart.</p>;
  return (
    <ul className="flex gap-2 overflow-x-auto pb-1 sm:gap-3">
      {bars.map((b) => (
        <li key={b.label} className="flex min-w-14 flex-1 flex-col items-center text-center">
          <span className={`tabular text-xs font-semibold ${b.muted ? "text-muted" : ""}`}>{formatValue(metric.format, b.value, true)}</span>
          <span className="mt-1 flex h-40 w-full items-end justify-center" aria-hidden="true">
            <span className={`block w-full max-w-14 rounded-t-md ${b.muted ? MUTED_FILL : SERIES_FILL[0]}`} style={{ height: `${pct(b.value, max)}%`, minHeight: b.value > 0 ? 2 : 0 }} />
          </span>
          <span className={`mt-1.5 w-full truncate text-xs ${b.muted ? "text-muted" : "text-ink-soft"}`} title={b.label}>
            {formatDimension(b.label)}
          </span>
        </li>
      ))}
    </ul>
  );
}

// SVG fills and strokes are theme tokens too, written out whole so the stylesheet picks them up.
const SERIES_SVG = ["fill-chart-blue", "fill-chart-orange", "fill-chart-green", "fill-chart-pink", "fill-chart-brown", "fill-chart-grey", "fill-chart-violet"] as const;
const SERIES_DOT = SERIES_FILL;

/** A slice of a pie from angle a0 to a1 (radians, clockwise from the top). */
const slicePath = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const p = (a: number) => `${(cx + r * Math.cos(a - Math.PI / 2)).toFixed(2)} ${(cy + r * Math.sin(a - Math.PI / 2)).toFixed(2)}`;
  return `M${cx} ${cy} L${p(a0)} A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)} Z`;
};

/** Each row's share of the whole, as a pie with a legend that says every figure in text. Only rows above zero can be a slice. */
function PieBody({ bars, metric }: { bars: Bar[]; metric: ReportMetric }) {
  const parts = bars.filter((b) => b.value > 0);
  const total = parts.reduce((t, b) => t + b.value, 0);
  if (parts.length === 0 || total <= 0) return <p className="text-sm text-muted">Nothing to chart as shares.</p>;
  let from = 0;
  const slices = parts.map((b, i) => {
    const span = (b.value / total) * Math.PI * 2;
    const slice = { b, i, a0: from, a1: from + span };
    from += span;
    return slice;
  });
  const fillOf = (b: Bar, i: number) => (b.muted ? "fill-chart-muted" : SERIES_SVG[i % SERIES_SVG.length]);
  const dotOf = (b: Bar, i: number) => (b.muted ? MUTED_FILL : SERIES_DOT[i % SERIES_DOT.length]);
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-center">
      <svg viewBox="0 0 200 200" className="size-48 shrink-0" role="img" aria-label={`Share of ${metric.label} by group`}>
        {slices.length === 1 ? (
          <circle cx="100" cy="100" r="92" className={fillOf(slices[0]!.b, 0)} />
        ) : (
          slices.map((s) => <path key={s.b.label} d={slicePath(100, 100, 92, s.a0, s.a1)} className={`${fillOf(s.b, s.i)} stroke-surface`} strokeWidth="1.5" />)
        )}
      </svg>
      <ul className="w-full max-w-md space-y-1.5 text-sm">
        {slices.map(({ b, i }) => (
          <li key={b.label} className={`grid grid-cols-[auto_1fr_auto_3.5rem] items-center gap-2 ${b.muted ? "text-muted" : ""}`}>
            <span className={`size-3 rounded-sm ${dotOf(b, i)}`} aria-hidden="true" />
            <span className="truncate" title={b.label}>
              {formatDimension(b.label)}
            </span>
            <span className="tabular text-right font-semibold">{formatValue(metric.format, b.value, true)}</span>
            <span className="tabular text-right text-muted">{((b.value / total) * 100).toFixed(1)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The rows in report order joined by a line, each point labelled. Most useful when the rows follow time or an order. */
function LineBody({ bars, metric }: { bars: Bar[]; metric: ReportMetric }) {
  if (bars.length === 0) return <p className="text-sm text-muted">Nothing to chart.</p>;
  const W = 640;
  const H = 230;
  const pad = { l: 12, r: 12, t: 26, b: 34 };
  const max = Math.max(0, ...bars.map((b) => b.value));
  const x = (i: number) => (bars.length === 1 ? W / 2 : pad.l + (i * (W - pad.l - pad.r)) / (bars.length - 1));
  const y = (v: number) => pad.t + (1 - (max > 0 ? Math.max(0, v) / max : 0)) * (H - pad.t - pad.b);
  const points = bars.map((b, i) => `${x(i).toFixed(1)},${y(b.value).toFixed(1)}`).join(" ");
  const showValues = bars.length <= 14;
  const every = Math.max(1, Math.ceil(bars.length / 8));
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-56 w-full min-w-[30rem]" role="img" aria-label={`${metric.label} across ${bars.length} groups`}>
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} className="stroke-line" strokeWidth="1" />
        {bars.length > 1 && <polyline points={points} fill="none" className="stroke-chart-blue" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
        {bars.map((b, i) => (
          <g key={b.label}>
            <circle cx={x(i)} cy={y(b.value)} r="4" className={b.muted ? "fill-chart-muted" : "fill-chart-blue"}>
              <title>{`${b.label}: ${formatValue(metric.format, b.value)}`}</title>
            </circle>
            {showValues && (
              <text x={x(i)} y={y(b.value) - 10} textAnchor="middle" className="fill-ink text-[11px] font-semibold">
                {formatValue(metric.format, b.value, true)}
              </text>
            )}
            {i % every === 0 && (
              <text x={x(i)} y={H - 12} textAnchor="middle" className="fill-muted text-[11px]">
                {formatDimension(b.label).slice(0, 14)}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

/** Every row, largest first, with its share: the same numbers as the charts, as text. */
function ValuesTable({ rows, dimension, dimensionLabel, metric }: { rows: ReportRow[]; dimension: string; dimensionLabel: string; metric: ReportMetric }) {
  const list = rows
    .map((r) => ({ label: r.dims[dimension] ?? "", value: r.values[metric.code] }))
    .filter((r): r is { label: string; value: number } => r.value !== null && r.value !== undefined && r.label !== "")
    .sort((a, b) => b.value - a.value);
  const total = list.reduce((t, r) => t + Math.max(0, r.value), 0);
  if (list.length === 0) return <p className="text-sm text-muted">Nothing to show.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[20rem] text-left text-sm">
        <caption className="sr-only">{`${metric.label} by ${dimensionLabel}`}</caption>
        <thead className="border-b border-line text-muted">
          <tr>
            <th scope="col" className="py-2 pr-3 font-semibold">{dimensionLabel}</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">{metric.label}</th>
            <th scope="col" className="py-2 pl-3 text-right font-semibold">Share</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {list.map((r) => (
            <tr key={r.label} className={isMutedLabel(r.label) ? "text-muted" : ""}>
              <th scope="row" className="py-2 pr-3 font-normal">{formatDimension(r.label)}</th>
              <td className="tabular px-3 py-2 text-right font-semibold" title={formatValue(metric.format, r.value)}>{formatValue(metric.format, r.value, true)}</td>
              <td className="tabular py-2 pl-3 text-right text-muted">{total > 0 && r.value > 0 ? `${((r.value / total) * 100).toFixed(1)}%` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export type ChartView = "table" | "bar" | "column" | "pie" | "line";

const VIEWS: { id: ChartView; label: string; Icon: typeof TableIcon }[] = [
  { id: "table", label: "Table", Icon: TableIcon },
  { id: "bar", label: "Bar chart", Icon: HBarsIcon },
  { id: "column", label: "Column chart", Icon: ColumnChartIcon },
  { id: "pie", label: "Pie chart", Icon: PieChartIcon },
  { id: "line", label: "Line chart", Icon: LineChartIcon },
];

/**
 * One measure over one dimension, shown the way the person picks: a table, bars, columns, a pie or a line. The report says
 * which view it opens on; the buttons above the chart switch it without asking the server for anything.
 */
export function ChartPanel({ title, rows, dimension, dimensionLabel, metric, initial, status = "ready" }: { title: string; rows: ReportRow[]; dimension: string; dimensionLabel: string; metric: ReportMetric; initial: "bar" | "column"; status?: "ready" | "loading" | "failed" }) {
  const [view, setView] = useState<ChartView>(initial);
  const id = useId();
  const bars = useMemo(() => barRows(rows, dimension, metric.code), [rows, dimension, metric.code]);
  const inOrder = useMemo(() => columnRows(rows, dimension, metric.code), [rows, dimension, metric.code]);
  return (
    <section aria-labelledby={id} className="card p-4 sm:p-5">
      <h2 id={id} className="text-base font-bold">
        {title}
      </h2>
      <p className="mt-0.5 text-sm text-muted">{metric.label}</p>
      <div role="group" aria-label="Show this as" className="mt-3 inline-flex gap-1 rounded-lg bg-subtle p-1">
        {VIEWS.map(({ id: v, label, Icon }) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            aria-label={label}
            title={label}
            onClick={() => setView(v)}
            className="inline-flex size-9 items-center justify-center rounded-md text-muted transition-colors hover:text-ink aria-pressed:bg-surface aria-pressed:text-ink aria-pressed:shadow-[var(--shadow-card)]"
          >
            <Icon size={18} />
          </button>
        ))}
      </div>
      <div className="mt-4">
        {status === "loading" && (
          <p className="text-sm text-muted" role="status" aria-live="polite">
            Loading this chart…
          </p>
        )}
        {status === "failed" && <p className="text-sm text-bad">This chart couldn’t be loaded. Apply again to retry.</p>}
        {status === "ready" && view === "table" && <ValuesTable rows={rows} dimension={dimension} dimensionLabel={dimensionLabel} metric={metric} />}
        {status === "ready" && view === "bar" && <BarsBody bars={bars} metric={metric} />}
        {status === "ready" && view === "column" && <ColumnsBody bars={inOrder} metric={metric} />}
        {status === "ready" && view === "pie" && <PieBody bars={bars} metric={metric} />}
        {status === "ready" && view === "line" && <LineBody bars={inOrder} metric={metric} />}
      </div>
    </section>
  );
}

/** Sorted horizontal bars alone (no switcher). */
export function BarChart({ title, rows, dimension, metric }: { title: string; rows: ReportRow[]; dimension: string; metric: ReportMetric }) {
  const bars = useMemo(() => barRows(rows, dimension, metric.code), [rows, dimension, metric.code]);
  return (
    <ChartCard title={title} note={metric.label}>
      <BarsBody bars={bars} metric={metric} />
    </ChartCard>
  );
}

/** Columns alone (no switcher). */
export function ColumnChart({ title, rows, dimension, metric }: { title: string; rows: ReportRow[]; dimension: string; metric: ReportMetric }) {
  const bars: Bar[] = useMemo(() => columnRows(rows, dimension, metric.code), [rows, dimension, metric.code]);
  return (
    <ChartCard title={title} note={metric.label}>
      <ColumnsBody bars={bars} metric={metric} />
    </ChartCard>
  );
}

/** Columns for each x (month) stacked by the row dimension, with a legend. Only drawn when a breakdown is chosen. */
export function StackedChart({
  title,
  rows,
  seriesDim,
  xDim,
  metric,
}: {
  title: string;
  rows: ReportRow[];
  seriesDim: string;
  xDim: string;
  metric: ReportMetric;
}) {
  const data: Stacked = useMemo(() => pivotStacked(rows, seriesDim, xDim, metric.code), [rows, seriesDim, xDim, metric.code]);
  const totals = data.xs.map((_, i) => data.series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0));
  const max = Math.max(0, ...totals);
  const fill = (i: number, muted: boolean) => (muted ? MUTED_FILL : SERIES_FILL[i % SERIES_FILL.length]);
  return (
    <ChartCard title={title} note={metric.label}>
      {data.xs.length === 0 ? (
        <p className="text-sm text-muted">Nothing to chart.</p>
      ) : (
        <>
          <ul className="flex gap-2 overflow-x-auto pb-1 sm:gap-3">
            {data.xs.map((x, i) => (
              <li
                key={x}
                className="flex min-w-14 flex-1 flex-col items-center text-center"
                aria-label={`${formatDimension(x)}: ${data.series.map((s) => `${s.label} ${formatValue(metric.format, s.values[i], true)}`).join(", ")}`}
              >
                <span className="tabular text-xs font-semibold">{formatValue(metric.format, totals[i], true)}</span>
                <span className="mt-1 flex h-44 w-full items-end justify-center" aria-hidden="true">
                  <span className="flex w-full max-w-14 flex-col-reverse overflow-hidden rounded-t-md" style={{ height: `${pct(totals[i] ?? 0, max)}%` }}>
                    {data.series.map((s, si) => (
                      <span key={s.label} className={fill(si, s.muted)} style={{ height: `${pct(s.values[i] ?? 0, totals[i] ?? 0)}%` }} />
                    ))}
                  </span>
                </span>
                <span className="mt-1.5 w-full truncate text-xs text-ink-soft">{formatDimension(x)}</span>
              </li>
            ))}
          </ul>
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-sm" aria-label="Legend">
            {data.series.map((s, si) => (
              <li key={s.label} className="inline-flex items-center gap-1.5">
                <span className={`h-3 w-3 rounded-sm ${fill(si, s.muted)}`} aria-hidden="true" />
                <span className={s.muted ? "text-muted" : ""}>{s.label}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </ChartCard>
  );
}

const rowKey = (r: ReportRow) => Object.values(r.dims).join("\u0001");

/**
 * Every measure for every row, with a totals row. Columns sort. Share columns carry an in-cell bar. Unknown and Not
 * matched rows stay in the table, in a muted colour.
 */
export function ReportTable({
  title,
  result,
  dimensions,
}: {
  title: string;
  result: ReportResult;
  /** The dimensions that are columns, in order: the row dimension, and the breakdown when there is one. */
  dimensions: { code: string; label: string }[];
}) {
  const [sort, setSort] = useState<{ key: string; kind: "dim" | "metric"; dir: SortDir } | null>(null);
  const rows = useMemo(() => (sort ? sortRows(result.rows, sort.key, sort.kind, sort.dir) : result.rows), [result.rows, sort]);
  const toggle = (key: string, kind: "dim" | "metric") =>
    setSort((s) => (s && s.key === key ? { key, kind, dir: s.dir === "asc" ? "desc" : "asc" } : { key, kind, dir: kind === "dim" ? "asc" : "desc" }));
  const ariaSort = (key: string) => (sort?.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : "none");
  const isShare = (m: ReportMetric) => m.format === "percent" && /share/i.test(m.code);

  const header = (key: string, kind: "dim" | "metric", label: string, right: boolean) => (
    <th key={key} scope="col" aria-sort={ariaSort(key)} className={`px-3 py-2.5 font-semibold ${right ? "text-right" : "text-left"}`}>
      <button type="button" onClick={() => toggle(key, kind)} className={`inline-flex items-center gap-1 rounded-md hover:text-brand ${right ? "flex-row-reverse" : ""}`}>
        {label}
        <span aria-hidden="true" className="text-xs text-muted">
          {sort?.key === key ? (sort.dir === "asc" ? "▲" : "▼") : "⇅"}
        </span>
      </button>
    </th>
  );

  return (
    <ChartCard title={title}>
      <div className="-mx-4 overflow-x-auto sm:-mx-5">
        <table className="w-full min-w-[34rem] border-collapse text-sm">
          <caption className="sr-only">{title}</caption>
          <thead className="border-b border-line-strong text-xs text-muted">
            <tr>
              {dimensions.map((d, i) => (
                <th key={d.code} scope="col" aria-sort={ariaSort(d.code)} className={`py-2.5 text-left font-semibold ${i === 0 ? "pr-3 pl-4 sm:pl-5" : "px-3"}`}>
                  <button type="button" onClick={() => toggle(d.code, "dim")} className="inline-flex items-center gap-1 rounded-md hover:text-brand">
                    {d.label}
                    <span aria-hidden="true" className="text-xs text-muted">
                      {sort?.key === d.code ? (sort.dir === "asc" ? "▲" : "▼") : "⇅"}
                    </span>
                  </button>
                </th>
              ))}
              {result.metrics.map((m) => header(m.code, "metric", m.label, true))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => {
              const muted = Object.values(r.dims).some(isMutedLabel);
              return (
                <tr key={rowKey(r)} className={muted ? "text-muted" : ""}>
                  {dimensions.map((d, i) => (
                    <th key={d.code} scope={i === 0 ? "row" : undefined} className={`py-2.5 text-left font-medium ${i === 0 ? "pr-3 pl-4 sm:pl-5" : "px-3"}`}>
                      {formatDimension(r.dims[d.code] ?? "")}
                    </th>
                  ))}
                  {result.metrics.map((m) => {
                    const v = r.values[m.code];
                    return (
                      <td key={m.code} className="tabular px-3 py-2.5 text-right">
                        {formatValue(m.format, v)}
                        {isShare(m) && v !== null && v !== undefined && (
                          <span className="mt-1 ml-auto block h-1.5 w-20 overflow-hidden rounded-full bg-subtle" aria-hidden="true">
                            <span className={`block h-full rounded-full ${muted ? MUTED_FILL : SERIES_FILL[0]}`} style={{ width: `${pct(v, 1)}%` }} />
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-line-strong font-bold">
            <tr>
              <th scope="row" colSpan={dimensions.length} className="py-2.5 pr-3 pl-4 text-left sm:pl-5">
                Total
              </th>
              {result.metrics.map((m) => (
                <td key={m.code} className="tabular px-3 py-2.5 text-right">
                  {formatValue(m.format, result.totals[m.code])}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </ChartCard>
  );
}
