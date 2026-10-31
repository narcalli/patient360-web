"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DocumentRow, DocumentRowsSkeleton, useDocumentActions } from "@/components/documents";
import { HelpCard } from "@/components/help";
import { ChevronRight, DocTypeIcon, DropIcon, FileIcon, IdCardIcon } from "@/components/icons";
import { useShell } from "@/components/shell-context";
import { api, type PatientDocument, type Profile } from "@/lib/api";
import { ageFromDob, ageLabel, bloodGroupLabel, documentDay, firstName, formatDate, genderLabel, greeting, initials, relationLabel } from "@/lib/format";

/**
 * Overview: the patient summary (who is open and the key facts on record), what is new, the latest records, records
 * by type, and family members on this number.
 */
export default function OverviewPage() {
  const { me, patient, switchTo, switching } = useShell();
  const [docs, setDocs] = useState<PatientDocument[] | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState(false);
  const actions = useDocumentActions();

  useEffect(() => {
    Promise.all([api.get<PatientDocument[]>("/patient/documents"), api.get<Profile>("/patient/profile")])
      .then(([d, p]) => {
        setDocs(d);
        setProfile(p);
      })
      .catch(() => setError(true));
  }, []);

  const self = me.patients.find((p) => p.relation === "SELF") ?? patient;
  const newCount = docs?.filter(actions.isNew).length ?? 0;
  const latest = docs?.[0];

  // Counts per type, most first.
  const byType = useMemo(() => {
    const m = new Map<number, { id: number; label: string; icon: string; count: number }>();
    for (const d of docs ?? []) {
      const t = m.get(d.type.id) ?? { id: d.type.id, label: d.type.label, icon: d.type.icon, count: 0 };
      t.count++;
      m.set(d.type.id, t);
    }
    return [...m.values()].sort((a, b) => b.count - a.count);
  }, [docs]);

  return (
    <>
      <PatientBanner
        greeting={`${greeting()}, ${firstName(self.fullName)}`}
        name={patient.fullName}
        relation={patient.relation}
        profile={profile}
        fallbackAge={ageLabel(patient.birthYear)}
        patientCode={patient.patientCode}
      />

      {error && (
        <p role="alert" className="card mt-6 p-5 text-bad">We couldn&apos;t load this page. Please refresh to try again.</p>
      )}

      {/* Summary tiles */}
      <section aria-label="Summary" className="mt-4 grid grid-cols-3 gap-2 sm:mt-6 sm:gap-3">
        <StatTile href="/patient/records" label="Records" value={docs ? String(docs.length) : null} hint={docs?.length === 1 ? "document on file" : "documents on file"} />
        <StatTile
          href="/patient/records?new=1"
          label="New for you"
          value={docs ? String(newCount) : null}
          hint={newCount === 0 ? "You're all caught up" : "not opened yet"}
          highlight={newCount > 0}
        />
        <StatTile
          href="/patient/records"
          label="Latest record"
          value={docs ? (latest ? formatDate(documentDay(latest)) : "None yet") : null}
          hint={latest ? latest.type.label : "Records appear here when added"}
          small
        />
      </section>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="recent-title" className="card h-fit p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 id="recent-title" className="text-lg font-bold">Recent records</h2>
            {docs && docs.length > 0 && (
              <Link href="/patient/records" className="btn-ghost -mr-2">View all <ChevronRight size={16} /></Link>
            )}
          </div>
          <div className="mt-2" aria-busy={docs === null}>
            {docs === null && !error ? (
              <DocumentRowsSkeleton rows={4} />
            ) : docs && docs.length === 0 ? (
              <EmptyRecords />
            ) : (
              <ul className="divide-y divide-line">
                {docs?.slice(0, 5).map((d) => <DocumentRow key={d.id} doc={d} actions={actions} />)}
              </ul>
            )}
          </div>
        </section>

        <div className="flex flex-col gap-6">
          {byType.length > 0 && (
            <section aria-labelledby="types-title" className="card p-5">
              <h2 id="types-title" className="text-base font-bold">By type</h2>
              <ul className="mt-2">
                {byType.map((t) => (
                  <li key={t.id}>
                    <Link href={`/patient/records?type=${t.id}`} className="-mx-2 flex min-h-11 items-center gap-3 rounded-[var(--radius-control)] px-2 transition-colors duration-150 hover:bg-subtle">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-brand"><DocTypeIcon name={t.icon} size={16} /></span>
                      <span className="flex-1 text-sm font-medium">{t.label}</span>
                      <span className="tabular text-sm font-semibold text-muted">{t.count}</span>
                      <ChevronRight size={16} className="text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {me.patients.length > 1 && (
            <section aria-labelledby="family-title" className="card p-5">
              <h2 id="family-title" className="text-base font-bold">Family on this number</h2>
              <ul className="mt-2">
                {me.patients.map((p) => {
                  const on = p.id === patient.id;
                  return (
                    <li key={p.id} className="flex min-h-14 items-center gap-3">
                      <span className="avatar h-9 w-9 text-xs" aria-hidden="true">{initials(p.fullName)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{p.fullName}</span>
                        <span className="block text-xs text-muted">{relationLabel(p.relation)} · {ageLabel(p.birthYear)}</span>
                      </span>
                      {on ? (
                        <span className="badge bg-subtle text-muted">Viewing</span>
                      ) : (
                        <button className="btn-ghost" disabled={switching} onClick={() => void switchTo(p.id)} aria-label={`Switch to ${p.fullName}`}>
                          Switch
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <HelpCard className="lg:hidden" />
        </div>
      </div>
      {actions.ui}
    </>
  );
}

/** The patient summary banner: identity first, then the facts a clinician or front desk asks for. */
function PatientBanner({
  greeting,
  name,
  relation,
  profile,
  fallbackAge,
  patientCode,
}: {
  greeting: string;
  name: string;
  relation: string;
  profile: Profile | null;
  fallbackAge: string;
  patientCode: string;
}) {
  const gender = genderLabel(profile?.gender ?? null);
  const blood = bloodGroupLabel(profile?.bloodGroup ?? null);
  const facts: { label: string; value: string }[] = [
    { label: "Age", value: profile ? ageFromDob(profile.dob) : fallbackAge },
    ...(gender ? [{ label: "Gender", value: gender }] : []),
    ...(profile?.dob ? [{ label: "Date of birth", value: formatDate(profile.dob) }] : []),
    { label: "Patient ID", value: patientCode },
  ];

  return (
    <section aria-labelledby="patient-name" className="card overflow-hidden">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-5 sm:p-6">
        <span className="avatar hidden h-16 w-16 text-xl sm:inline-flex" aria-hidden="true">{initials(name)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <span className="avatar h-12 w-12 text-base sm:hidden" aria-hidden="true">{initials(name)}</span>
            <div className="min-w-0">
              <p className="text-sm text-muted">{greeting}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 id="patient-name" className="text-2xl leading-tight font-extrabold sm:text-[30px]">{name}</h1>
                {relation !== "SELF" && <span className="badge bg-subtle text-ink-soft ring-1 ring-line ring-inset">Your {relationLabel(relation).toLowerCase()}</span>}
              </div>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:mt-3 sm:flex sm:flex-wrap">
            {facts.map((f) => (
              <div key={f.label}>
                <dt className="text-xs text-muted">{f.label}</dt>
                <dd className="font-semibold tabular">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        {(blood || profile?.abhaNumber) && (
          <dl className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-end sm:gap-3">
            {blood && (
              <div className="flex items-center gap-2 rounded-[var(--radius-control)] border border-line bg-subtle px-3 py-2">
                <DropIcon size={18} className="text-bad" />
                <dt className="text-xs text-muted">Blood group</dt>
                <dd className="font-display text-base font-bold">{blood}</dd>
              </div>
            )}
            {profile?.abhaNumber && (
              <div className="flex items-center gap-2 rounded-[var(--radius-control)] border border-line bg-subtle px-3 py-2">
                <IdCardIcon size={18} className="text-brand" />
                <dt className="text-xs text-muted">ABHA</dt>
                <dd className="text-sm font-semibold tabular">{profile.abhaNumber}</dd>
              </div>
            )}
          </dl>
        )}
      </div>
    </section>
  );
}

function StatTile({ href, label, value, hint, highlight = false, small = false }: { href: string; label: string; value: string | null; hint: string; highlight?: boolean; small?: boolean }) {
  return (
    <Link
      href={href}
      className={`card group flex min-h-[88px] items-center gap-4 p-3 transition-colors duration-150 hover:border-line-strong sm:p-4 ${highlight ? "border-brand-line bg-brand-soft" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <p className="eyebrow text-[11px] sm:text-xs">{label}</p>
        {value === null ? (
          <span className="skeleton mt-2 block h-7 w-16" />
        ) : (
          <p className={`mt-1 font-display font-bold tabular ${small ? "text-sm sm:text-lg" : "text-2xl leading-none sm:text-[28px]"}`}>{value}</p>
        )}
        <p className="mt-1 hidden truncate text-sm text-muted sm:block">{hint}</p>
      </div>
      <ChevronRight size={18} className="hidden shrink-0 text-muted transition-transform duration-150 group-hover:translate-x-0.5 sm:block" />
    </Link>
  );
}

function EmptyRecords() {
  return (
    <div className="mt-4 flex flex-col items-center rounded-[var(--radius-card)] bg-subtle px-6 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-muted ring-1 ring-line"><FileIcon size={24} /></span>
      <p className="mt-3 font-semibold">No records yet</p>
      <p className="mt-1 max-w-sm text-sm text-muted">Lab reports, scans and prescriptions appear here as soon as the hospital or its lab adds them.</p>
    </div>
  );
}
