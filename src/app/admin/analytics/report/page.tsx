"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnalyticsIcon, ChevronLeft, InfoIcon } from "@/components/icons";
import { BarChart, ColumnChart, KpiCards, ReportTable, StackedChart } from "@/components/report-charts";
import { ReportFilterBar, type FilterOptions } from "@/components/report-filters";
import { EmptyState, ErrorBanner, PageHeader, RowsSkeleton, useAreaBase } from "@/components/staff-ui";
import { api, ApiError } from "@/lib/api";
import { formatDateTime, todayIst } from "@/lib/format";
import {
  EMPTY_VIEW,
  formatDay,
  formatPercent,
  isEmptyResult,
  parseView,
  periodText,
  runBody,
  withoutBreakdown,
  writeView,
  type ReportDetail,
  type ReportMetric,
  type ReportResult,
  type ReportView,
} from "@/lib/reports";

/** One report: filters, key figures, the report's own charts in order, the table, and how its numbers are worked out. */
export default function ReportPageRoute() {
  return (
    <Suspense>
      <Report />
    </Suspense>
  );
}

type Failure = "load" | "forbidden" | "missing" | null;
const failureOf = (e: unknown): Failure => (e instanceof ApiError ? (e.status === 403 ? "forbidden" : e.status === 404 ? "missing" : "load") : "load");

function Report() {
  const base = useAreaBase();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const code = params.get("code") ?? "";
  const query = params.toString();
  const view = useMemo(() => parseView(new URLSearchParams(query)), [query]);

  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [options, setOptions] = useState<FilterOptions>({});
  const [result, setResult] = useState<ReportResult | null>(null);
  const [split, setSplit] = useState<ReportResult | null>(null);
  const [failure, setFailure] = useState<Failure>(null);
  const [running, setRunning] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // The report's setup, and the values each of its filters offers.
  useEffect(() => {
    if (!code) {
      setFailure("missing");
      return;
    }
    let live = true;
    setDetail(null);
    setFailure(null);
    api
      .get<ReportDetail>(`/reports/${encodeURIComponent(code)}`)
      .then((d) => {
        if (!live) return;
        setDetail(d);
        setOptions(Object.fromEntries(d.filters.filter((f) => f.editable).map((f) => [f.column, { values: [], loading: true, failed: false }])));
        for (const f of d.filters.filter((x) => x.editable)) {
          api
            .get<{ values: string[] }>(`/reports/${encodeURIComponent(code)}/options/${encodeURIComponent(f.column)}`)
            .then((o) => live && setOptions((all) => ({ ...all, [f.column]: { values: o.values, loading: false, failed: false } })))
            .catch(() => live && setOptions((all) => ({ ...all, [f.column]: { values: [], loading: false, failed: true } })));
        }
      })
      .catch((e) => live && setFailure(failureOf(e)));
    return () => {
      live = false;
    };
  }, [code, attempt]);

  // The numbers. Key figures, bars and columns come from a run that is not split, so they are exact; a chosen
  // breakdown is a second run for the stacked chart and the table.
  useEffect(() => {
    if (!detail) return;
    let live = true;
    setRunning(true);
    setFailure(null);
    const path = `/reports/${encodeURIComponent(detail.code)}/run`;
    const hasPeriod = detail.periods.length > 0;
    const main = api.post<ReportResult>(path, runBody(withoutBreakdown(view), hasPeriod));
    const second = view.breakdown ? api.post<ReportResult>(path, runBody(view, hasPeriod)) : Promise.resolve(null);
    Promise.all([main, second])
      .then(([a, b]) => {
        if (!live) return;
        setResult(a);
        setSplit(b);
      })
      .catch((e) => live && setFailure(failureOf(e)))
      .finally(() => live && setRunning(false));
    return () => {
      live = false;
    };
  }, [detail, view, attempt]);

  const go = useCallback(
    (next: ReportView) => {
      const q = writeView(new URLSearchParams(query), next).toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [query, pathname, router],
  );

  const back = (
    <Link href={`${base}/analytics`} className="btn-ghost -ml-3 mb-2">
      <ChevronLeft size={18} />
      All reports
    </Link>
  );

  if (failure === "forbidden" || failure === "missing") {
    return (
      <>
        {back}
        <EmptyState icon={<AnalyticsIcon size={22} />} title={failure === "forbidden" ? "You don't have access to this report" : "We couldn't find that report"}>
          {failure === "forbidden" ? "Ask an administrator to give your user type access." : "It may have been renamed or turned off. Pick one from the list."}
        </EmptyState>
      </>
    );
  }
  if (!detail) {
    return (
      <>
        {back}
        {failure === "load" ? <ErrorBanner text="We couldn't load this report. Check your connection." onRetry={() => setAttempt((n) => n + 1)} /> : <RowsSkeleton rows={3} />}
      </>
    );
  }

  const metricByCode = (c: string | null): ReportMetric | undefined => (c ? result?.metrics.find((m) => m.code === c) : undefined);
  const breakdown = detail.breakdowns.find((b) => b.code === view.breakdown);
  const tableDims = [detail.rowDimension, ...(breakdown && split ? [breakdown] : [])];
  const empty = result ? isEmptyResult(result) : false;

  return (
    <>
      {back}
      <PageHeader title={detail.label} description={detail.question} />

      <div className="mt-6 space-y-4">
        <ReportFilterBar detail={detail} applied={view} options={options} today={todayIst()} onApply={go} onReset={() => go(EMPTY_VIEW)} />

        {failure === "load" ? (
          <ErrorBanner text="We couldn't run this report. Check your connection." onRetry={() => setAttempt((n) => n + 1)} />
        ) : !result ? (
          <RowsSkeleton rows={4} />
        ) : (
          <div aria-busy={running} className={`space-y-4 transition-opacity ${running ? "opacity-60" : ""}`}>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted" role="status">
              <span>{result.dataAsOf ? `Data as of ${formatDay(result.dataAsOf)}` : "No bills imported yet"}</span>
              {result.refreshedAt && <span>Refreshed {formatDateTime(result.refreshedAt)}</span>}
              {periodText(result.period) && <span>{periodText(result.period)}</span>}
              <span>Basis: {result.basisLabel}</span>
            </p>

            {result.attributedShare !== null && (
              <p className="flex items-start gap-2 rounded-[var(--radius-control)] bg-brand-soft px-4 py-3 text-sm" role="note">
                <InfoIcon size={18} className="mt-0.5 shrink-0 text-brand" />
                <span>
                  <strong>{formatPercent(result.attributedShare)}</strong> of revenue has a known lead source. The rest is shown as Unknown or Not matched, so the total is still every bill in the period.
                </span>
              </p>
            )}
            {result.smallGroupsMerged > 0 && (
              <p className="flex items-start gap-2 rounded-[var(--radius-control)] bg-subtle px-4 py-3 text-sm" role="note">
                <InfoIcon size={18} className="mt-0.5 shrink-0 text-muted" />
                <span>
                  {result.smallGroupsMerged} small {result.smallGroupsMerged === 1 ? "group is" : "groups are"} combined as Other, because very small counts could point to one person.
                </span>
              </p>
            )}

            {empty ? (
              <EmptyState icon={<AnalyticsIcon size={22} />} title="Nothing to show for these filters">
                Try a wider period or fewer filters. If you expected data, check that the bills have been imported under{" "}
                <Link href={`${base}/actions/imports`} className="font-semibold text-brand underline underline-offset-2">
                  Imports
                </Link>
                .
              </EmptyState>
            ) : (
              detail.visuals.map((v, i) => {
                const y = metricByCode(v.y);
                switch (v.type) {
                  case "KPI":
                    return <KpiCards key={i} metrics={result.metrics} totals={result.totals} />;
                  case "BAR":
                    return y ? <BarChart key={i} title={v.title} rows={result.rows} dimension={v.x ?? detail.rowDimension.code} metric={y} /> : null;
                  case "COLUMN":
                    return y ? <ColumnChart key={i} title={v.title} rows={result.rows} dimension={v.x ?? detail.rowDimension.code} metric={y} /> : null;
                  case "STACKED":
                    if (!y) return null;
                    return split && breakdown ? (
                      <StackedChart key={i} title={v.title} rows={split.rows} seriesDim={detail.rowDimension.code} xDim={breakdown.code} metric={y} />
                    ) : (
                      <p key={i} className="card p-4 text-sm text-muted sm:p-5">
                        <strong className="text-ink">{v.title}.</strong> Choose a breakdown above and Apply to see this chart.
                      </p>
                    );
                  case "TABLE":
                    return <ReportTable key={i} title={v.title} result={split && breakdown ? split : result} dimensions={tableDims} />;
                  default:
                    // LINE, PARETO, FUNNEL and HEATMAP have no drawing yet; the table still carries the numbers.
                    return null;
                }
              })
            )}

            <details className="card group p-4 sm:p-5">
              <summary className="cursor-pointer font-bold">How this is calculated</summary>
              <dl className="mt-3 space-y-3 text-sm">
                {result.metrics.map((m) => (
                  <div key={m.code}>
                    <dt className="font-semibold">{m.label}</dt>
                    <dd className="text-ink-soft">{m.definition}</dd>
                    {m.caveat && <dd className="text-muted">{m.caveat}</dd>}
                  </div>
                ))}
                <div>
                  <dt className="font-semibold">Basis</dt>
                  <dd className="text-ink-soft">{result.basisLabel}</dd>
                </div>
              </dl>
            </details>
          </div>
        )}
      </div>
    </>
  );
}
