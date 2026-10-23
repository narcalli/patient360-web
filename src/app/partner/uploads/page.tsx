"use client";

import { Suspense, useEffect, useState } from "react";
import { DocTypeIcon, UploadIcon } from "@/components/icons";
import { EmptyState, ErrorBanner, PageHeader, RowsSkeleton, StatusBadge, useUrlState } from "@/components/staff-ui";
import { api, type DocumentStatus, type PartnerUploads } from "@/lib/api";
import { formatDateTime, formatSize } from "@/lib/format";

const STATUSES: { value: DocumentStatus | null; label: string }[] = [
  { value: null, label: "All" },
  { value: "AVAILABLE", label: "Available" },
  { value: "UPLOADING", label: "Uploading" },
  { value: "FAILED", label: "Failed" },
];

/** US-11: everything this lab has uploaded, newest first, with whether it reached the patient. */
export default function PartnerUploadsPage() {
  return (
    <Suspense>
      <Uploads />
    </Suspense>
  );
}

function Uploads() {
  const { params, set } = useUrlState();
  const raw = params.get("status");
  const status = STATUSES.some((s) => s.value === raw) ? (raw as DocumentStatus) : null;
  const [data, setData] = useState<PartnerUploads | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    setError(false);
    api
      .get<PartnerUploads>(`/partner/uploads${status ? `?status=${status}` : ""}`)
      .then((d) => live && setData(d))
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [status, attempt]);

  const total = data ? data.counts.AVAILABLE + data.counts.UPLOADING + data.counts.FAILED : 0;

  return (
    <>
      <PageHeader title="My uploads" description="Results your lab has sent, and whether each one reached the patient's record." />

      <div role="group" aria-label="Filter by status" className="mt-6 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button key={s.label} type="button" className="chip" aria-pressed={status === s.value} onClick={() => set({ status: s.value })}>
            {s.label}
            {data && <span className="tabular opacity-80">{s.value ? data.counts[s.value] : total}</span>}
          </button>
        ))}
      </div>

      <section aria-label="Uploads" aria-busy={!data && !error} className="mt-5">
        {error ? (
          <ErrorBanner text="We couldn't load your uploads. Check your connection." onRetry={() => setAttempt((n) => n + 1)} />
        ) : !data ? (
          <RowsSkeleton />
        ) : data.items.length === 0 ? (
          <EmptyState icon={<UploadIcon size={22} />} title={status ? "Nothing with this status" : "No uploads yet"}>
            {status ? "Choose All to see every upload." : "Results your lab uploads appear here."}
          </EmptyState>
        ) : (
          <>
            <ul className="card divide-y divide-line">
              {data.items.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 sm:flex-nowrap sm:px-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-brand-soft text-brand">
                    <DocTypeIcon name={d.type.icon} size={18} />
                  </span>
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="font-semibold [overflow-wrap:anywhere]">{d.title}</p>
                    <p className="text-sm text-muted [overflow-wrap:anywhere]">
                      {d.type.label} · {d.patient.fullName} (<span className="tabular">{d.patient.patientCode}</span>)
                    </p>
                  </div>
                  <p className="text-sm text-muted sm:w-56 sm:text-right">
                    <time dateTime={d.uploadedAt} className="tabular">{formatDateTime(d.uploadedAt)}</time>
                    <span className="block">by {d.uploadedBy} · <span className="tabular">{formatSize(d.sizeBytes)}</span></span>
                  </p>
                  <span className="sm:w-28 sm:text-right"><StatusBadge status={d.status} /></span>
                </li>
              ))}
            </ul>
            {data.items.length === 200 && <p className="mt-3 text-sm text-muted">Showing the 200 most recent.</p>}
          </>
        )}
      </section>
    </>
  );
}
