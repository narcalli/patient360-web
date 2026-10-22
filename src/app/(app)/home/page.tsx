"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DocumentRow, useDocumentActions } from "@/components/documents";
import { ChevronRight, FileIcon } from "@/components/icons";
import { useShell } from "@/components/shell-context";
import { useHospital } from "@/components/brand";
import { api, type PatientDocument, type Profile } from "@/lib/api";
import { ageLabel, firstName, formatDate, formatMobile, greeting, initials, relationLabel } from "@/lib/format";

/** Phase 1 Home: who is open, the latest documents, and the key profile details. */
export default function HomePage() {
  const { me, patient } = useShell();
  const hospital = useHospital();
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

  return (
    <>
      <div className="flex items-center gap-4">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-lg font-bold text-white">{initials(patient.fullName)}</span>
        <div>
          <p className="text-sm text-muted">{greeting()}, {firstName(self.fullName)}</p>
          <h1 className="text-[28px] leading-tight font-extrabold text-ink-strong">{patient.fullName}</h1>
          <p className="text-sm text-muted">{relationLabel(patient.relation)} · {ageLabel(patient.birthYear)} · ID {patient.patientCode}</p>
        </div>
      </div>

      {error && <p className="card mt-8 p-5 text-bad">We couldn&apos;t load this page. Please refresh to try again.</p>}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Recent documents</h2>
            <Link href="/records" className="inline-flex items-center gap-1 text-sm font-semibold text-brand">See all <ChevronRight size={16} /></Link>
          </div>
          {docs === null ? (
            <p className="mt-6 text-muted">Loading…</p>
          ) : docs.length === 0 ? (
            <div className="mt-6 flex flex-col items-center rounded-2xl bg-canvas px-6 py-10 text-center">
              <FileIcon size={28} className="text-muted" />
              <p className="mt-3 font-semibold">No documents yet</p>
              <p className="mt-1 text-sm text-muted">Reports and prescriptions appear here as soon as the hospital or its lab adds them.</p>
            </div>
          ) : (
            <div className="mt-2 divide-y divide-line">
              {docs.slice(0, 4).map((d) => <DocumentRow key={d.id} doc={d} actions={actions} />)}
            </div>
          )}
          {docs && docs.length > 0 && <p className="mt-4 text-sm text-muted">{docs.length} document{docs.length === 1 ? "" : "s"} in total</p>}
        </section>

        <section className="card h-fit p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Details on record</h2>
            <Link href="/profile" className="inline-flex items-center gap-1 text-sm font-semibold text-brand">Profile <ChevronRight size={16} /></Link>
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            <Row label="Patient ID" value={profile?.patientCode} />
            <Row label="Date of birth" value={profile ? formatDate(profile.dob) : undefined} />
            <Row label="Mobile" value={profile ? formatMobile(profile.mobile) : undefined} />
          </dl>
          {hospital?.supportPhone && (
            <p className="mt-6 rounded-xl bg-canvas p-3 text-xs text-muted">
              Something wrong or missing? Call {hospital.shortName} on <b className="text-ink">{hospital.supportPhone}</b>.
            </p>
          )}
        </section>
      </div>
      {actions.ui}
    </>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-semibold">{value ?? "…"}</dd>
    </div>
  );
}
