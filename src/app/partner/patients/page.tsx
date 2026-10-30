"use client";

import { Suspense, useEffect, useState } from "react";
import { UploadIcon, UsersIcon } from "@/components/icons";
import { ReportUploadDialog } from "@/components/report-upload";
import { EmptyState, ErrorBanner, PageHeader, RowsSkeleton, SearchBox, useUrlState } from "@/components/staff-ui";
import { api, type PartnerSearchRow, type SearchResult } from "@/lib/api";
import { formatDate, initials } from "@/lib/format";

/**
 * US-08: a lab partner finds the patient a result belongs to. Only what is needed to be sure it's the right person
 * is shown (name, patient ID, date of birth, masked mobile), and only for a precise search. US-10: each match has
 * Upload result, which opens the upload for that patient.
 */
export default function PartnerPatientsPage() {
  return (
    <Suspense>
      <Search />
    </Suspense>
  );
}

function Search() {
  const { params, set } = useUrlState();
  const q = params.get("q") ?? "";
  const [result, setResult] = useState<SearchResult<PartnerSearchRow> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [uploadFor, setUploadFor] = useState<PartnerSearchRow | null>(null);

  useEffect(() => {
    if (!q) return setResult(null);
    let live = true;
    setLoading(true);
    setError(false);
    api
      .get<SearchResult<PartnerSearchRow>>(`/partner/patients?q=${encodeURIComponent(q)}`)
      .then((r) => live && setResult(r))
      .catch(() => live && setError(true))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [q, attempt]);

  return (
    <>
      <PageHeader title="Find a patient" description="Find the patient, check it's the right person, then upload their result." />
      <div className="mt-6">
        <SearchBox
          label="Patient"
          hint="The patient ID, the full 10-digit mobile number, or at least 3 letters of the name."
          placeholder="Patient ID, mobile number or name"
          initial={q}
          busy={loading}
          onSearch={(v) => set({ q: v || null })}
        />
      </div>

      <section aria-label="Results" aria-busy={loading} className="mt-6">
        {error ? (
          <ErrorBanner text="We couldn't search just now. Check your connection." onRetry={() => setAttempt((n) => n + 1)} />
        ) : loading && !result ? (
          <RowsSkeleton rows={2} />
        ) : !q ? (
          <EmptyState icon={<UsersIcon size={22} />} title="Search for the patient on the sample or request form">
            Use the patient ID if you have it: it is the surest match.
          </EmptyState>
        ) : result?.tooShort ? (
          <EmptyState icon={<UsersIcon size={22} />} title="Type a little more">
            Use the whole patient ID, all 10 digits of the mobile number, or at least 3 letters of the name.
          </EmptyState>
        ) : result?.mistypedCode ? (
          <EmptyState icon={<UsersIcon size={22} />} title="This ID looks mistyped">
            One of its characters is wrong. Check “{q}” against the form.
          </EmptyState>
        ) : result && result.results.length === 0 ? (
          <EmptyState icon={<UsersIcon size={22} />} title={`No patient matches “${q}”`}>
            Check the patient ID or mobile number on the form. If the patient is new to the hospital, ask the hospital to register them.
          </EmptyState>
        ) : result ? (
          <>
            <p className="mb-3 text-sm text-muted" role="status">
              {result.results.length} {result.results.length === 1 ? "match" : "matches"}. Check the date of birth and the last digits of the mobile number.
            </p>
            <ul className="card divide-y divide-line">
              {result.results.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3.5 sm:px-5">
                  <span className="flex min-w-0 flex-1 basis-60 items-center gap-3">
                    <span className="avatar h-10 w-10 text-sm" aria-hidden="true">{initials(p.fullName)}</span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{p.fullName}</span>
                      <span className="block text-sm text-muted tabular">ID {p.patientCode}</span>
                    </span>
                  </span>
                  <dl className="flex gap-6 text-sm">
                    <div>
                      <dt className="text-muted">Date of birth</dt>
                      <dd className="font-semibold tabular">{formatDate(p.dob)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Mobile</dt>
                      <dd className="font-semibold tabular">{p.mobile}</dd>
                    </div>
                  </dl>
                  <button type="button" className="btn w-full sm:w-auto" aria-label={`Upload result for ${p.fullName}`} onClick={() => setUploadFor(p)}>
                    <UploadIcon size={18} aria-hidden="true" /> Upload result
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      {uploadFor && <ReportUploadDialog patient={uploadFor} onClose={() => setUploadFor(null)} />}
    </>
  );
}
