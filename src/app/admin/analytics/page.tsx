"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnalyticsIcon, ChevronRight, DomainIcon } from "@/components/icons";
import { EmptyState, ErrorBanner, RowsSkeleton, useAreaBase } from "@/components/staff-ui";
import { api, ApiError } from "@/lib/api";
import type { ReportCatalogue } from "@/lib/reports";

/** Every report this person may open, one tab per group (icon only; the name shows on hover and focus). */
export default function AnalyticsPage() {
  const base = useAreaBase();
  const [catalogue, setCatalogue] = useState<ReportCatalogue | null>(null);
  const [error, setError] = useState<"load" | "forbidden" | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setError(null);
    api
      .get<ReportCatalogue>("/reports")
      .then((c) => live && setCatalogue(c))
      .catch((e) => live && setError(e instanceof ApiError && e.status === 403 ? "forbidden" : "load"));
    return () => {
      live = false;
    };
  }, [attempt]);

  const domains = catalogue?.domains.filter((d) => d.reports.length > 0) ?? [];
  const [picked, setPicked] = useState<string | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const current = domains.find((d) => d.code === picked) ?? domains[0];
  const move = (to: number) => {
    const d = domains[(to + domains.length) % domains.length]!;
    setPicked(d.code);
    tabRefs.current[d.code]?.focus();
  };

  return (
    <>
      <div>
        {error === "forbidden" ? (
          <EmptyState icon={<AnalyticsIcon size={22} />} title="You don't have access to reports">
            Ask an administrator to give your user type access to dashboards.
          </EmptyState>
        ) : error ? (
          <ErrorBanner text="We couldn't load the reports. Check your connection." onRetry={() => setAttempt((n) => n + 1)} />
        ) : !catalogue ? (
          <RowsSkeleton rows={3} />
        ) : domains.length === 0 ? (
          <EmptyState icon={<AnalyticsIcon size={22} />} title="No reports yet">
            Reports appear here when they are set up for your hospital.
          </EmptyState>
        ) : (
          <>
            <div role="tablist" aria-label="Report groups" className="flex flex-wrap gap-1 border-b border-line">
              {domains.map((d, i) => {
                const on = d.code === current?.code;
                return (
                  <button
                    key={d.code}
                    ref={(el) => {
                      tabRefs.current[d.code] = el;
                    }}
                    id={`domain-tab-${d.code}`}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    aria-controls="domain-panel"
                    aria-label={d.label}
                    tabIndex={on ? 0 : -1}
                    onClick={() => setPicked(d.code)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowRight") (e.preventDefault(), move(i + 1));
                      else if (e.key === "ArrowLeft") (e.preventDefault(), move(i - 1));
                      else if (e.key === "Home") (e.preventDefault(), move(0));
                      else if (e.key === "End") (e.preventDefault(), move(domains.length - 1));
                    }}
                    className={`group relative -mb-px inline-flex h-12 w-14 items-center justify-center border-b-2 transition-colors duration-150 ${
                      on ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
                    }`}
                  >
                    <DomainIcon code={d.code} size={22} />
                    <span
                      role="presentation"
                      className="pointer-events-none absolute top-full left-1/2 z-20 mt-1.5 -translate-x-1/2 rounded-md bg-ink px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-canvas opacity-0 shadow-[var(--shadow-pop)] transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                    >
                      {d.label}
                    </span>
                  </button>
                );
              })}
            </div>
            {current && (
              <div id="domain-panel" role="tabpanel" aria-labelledby={`domain-tab-${current.code}`} className="mt-5">
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {current.reports.map((r) => (
                    <li key={r.code}>
                      <Link
                        href={`${base}/analytics/report?code=${encodeURIComponent(r.code)}`}
                        className="card group flex h-full items-start gap-3 p-4 transition-colors duration-150 hover:border-brand-line hover:bg-brand-soft sm:p-5"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block font-bold">{r.label}</span>
                          <span className="mt-1 block text-sm text-muted">{r.question}</span>
                        </span>
                        <ChevronRight size={20} className="mt-0.5 shrink-0 text-muted group-hover:text-brand" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
