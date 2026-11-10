"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnalyticsIcon, ChevronRight, DomainIcon } from "@/components/icons";
import { IconTabs } from "@/components/icon-tabs";
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
  const current = domains.find((d) => d.code === picked) ?? domains[0];
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
            <IconTabs
              tabs={domains.map((d) => ({ key: d.code, label: d.label, icon: <DomainIcon code={d.code} size={22} /> }))}
              value={current?.code ?? ""}
              onChange={setPicked}
              idPrefix="domain"
              label="Report groups"
            />
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
