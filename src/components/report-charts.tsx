"use client";

import { useId, useMemo, useState } from "react";
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

/** Sorted horizontal bars: the top ten named rows, then Unknown and Not matched rows in a muted colour, always shown. */
export function BarChart({ title, rows, dimension, metric }: { title: string; rows: ReportRow[]; dimension: string; metric: ReportMetric }) {
  const bars = useMemo(() => barRows(rows, dimension, metric.code), [rows, dimension, metric.code]);
  const max = Math.max(0, ...bars.map((b) => b.value));
  return (
    <ChartCard title={title} note={metric.label}>
      {bars.length === 0 ? (
        <p className="text-sm text-muted">Nothing to chart.</p>
      ) : (
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
      )}
    </ChartCard>
  );
}

/** Columns in the order the report gives (spend bands low to high). */
export function ColumnChart({ title, rows, dimension, metric }: { title: string; rows: ReportRow[]; dimension: string; metric: ReportMetric }) {
  const bars: Bar[] = useMemo(() => columnRows(rows, dimension, metric.code), [rows, dimension, metric.code]);
  const max = Math.max(0, ...bars.map((b) => b.value));
  return (
    <ChartCard title={title} note={metric.label}>
      {bars.length === 0 ? (
        <p className="text-sm text-muted">Nothing to chart.</p>
      ) : (
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
      )}
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
