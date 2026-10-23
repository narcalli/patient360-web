"use client";

import { useEffect, useState } from "react";
import { useHospital } from "@/components/brand";
import { ConsentSection } from "@/components/consent-section";
import { HelpCard, telHref } from "@/components/help";
import { InfoIcon } from "@/components/icons";
import { useShell } from "@/components/shell-context";
import { SignInSettings } from "@/components/sign-in-settings";
import { api, type Profile } from "@/lib/api";
import { ageFromDob, bloodGroupLabel, formatDate, formatMobile, genderLabel, initials, relationLabel } from "@/lib/format";

type Field = { label: string; value: string | null; href?: string | null };

/**
 * US-02: what the hospital has on record, read-only (staff make changes), grouped the way a registration form is.
 * US-17: consent for everyone on this login, which can be given or withdrawn here.
 * Sign-in: add or change an email and password for this login.
 */
export default function ProfilePage() {
  const hospital = useHospital();
  const { patient } = useShell();
  const [p, setP] = useState<Profile | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get<Profile>("/patient/profile").then(setP).catch(() => setError(true));
  }, []);

  const personal: Field[] = p
    ? [
        { label: "Full name", value: p.fullName },
        { label: "Patient ID", value: p.patientCode },
        { label: "Date of birth", value: `${formatDate(p.dob)} (${ageFromDob(p.dob)})` },
        { label: "Gender", value: genderLabel(p.gender) },
        { label: "Blood group", value: bloodGroupLabel(p.bloodGroup) },
        { label: "ABHA number", value: p.abhaNumber },
      ]
    : [];
  const contact: Field[] = p
    ? [
        { label: "Mobile number", value: formatMobile(p.mobile), href: telHref(p.mobile) },
        { label: "Email", value: p.email },
        { label: "Address", value: p.address },
      ]
    : [];
  const emergency: Field[] = p
    ? [
        { label: "Name", value: p.emergencyContact?.name ?? null },
        {
          label: "Phone",
          value: p.emergencyContact?.phone ? formatMobile(p.emergencyContact.phone) : null,
          href: p.emergencyContact?.phone ? telHref(p.emergencyContact.phone) : null,
        },
      ]
    : [];

  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <span className="avatar h-14 w-14 text-lg" aria-hidden="true">{initials(patient.fullName)}</span>
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] leading-tight font-extrabold sm:text-[30px]">Profile</h1>
          <p className="text-muted">
            {patient.fullName} · {relationLabel(patient.relation)} · ID <span className="tabular">{patient.patientCode}</span>
          </p>
        </div>
      </div>

      {error ? (
        <p role="alert" className="card mt-6 p-5 text-bad">We couldn&apos;t load the profile. Please refresh to try again.</p>
      ) : (
        <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2" aria-busy={!p}>
          <FieldCard heading="Personal details" fields={personal} loading={!p} className="lg:col-span-2" columns="sm:grid-cols-2 xl:grid-cols-3" />
          <FieldCard heading="Contact" fields={contact} loading={!p} />
          <FieldCard heading="Emergency contact" fields={emergency} loading={!p} />
          <ConsentSection className="lg:col-span-2" />
          <SignInSettings className="lg:col-span-2" />
        </div>
      )}

      <p className="mt-5 flex items-start gap-2 text-sm text-muted">
        <InfoIcon size={18} className="mt-px shrink-0" />
        These details are kept by {hospital?.shortName ?? "the hospital"}. To correct anything, contact the hospital; staff make the change.
      </p>
      <HelpCard className="mt-5 lg:hidden" />
    </>
  );
}

function FieldCard({ heading, fields, loading, className = "", columns = "" }: { heading: string; fields: Field[]; loading: boolean; className?: string; columns?: string }) {
  return (
    <section aria-label={heading} className={`card p-5 sm:p-6 ${className}`}>
      <h2 className="text-base font-bold">{heading}</h2>
      {loading ? (
        <div className="mt-4 space-y-4" aria-hidden="true">
          {[0, 1].map((i) => (
            <span key={i} className="block space-y-2">
              <span className="skeleton block h-3 w-24" />
              <span className="skeleton block h-4 w-48" />
            </span>
          ))}
        </div>
      ) : (
        <dl className={`mt-4 grid gap-x-8 gap-y-4 ${columns}`}>
          {fields.map((f) => (
            <div key={f.label}>
              <dt className="text-sm text-muted">{f.label}</dt>
              <dd className="mt-0.5 font-semibold [overflow-wrap:anywhere]">
                {f.value === null ? (
                  <span className="font-normal text-muted italic">Not recorded</span>
                ) : f.href ? (
                  <a href={f.href} className="text-brand underline-offset-2 hover:underline">{f.value}</a>
                ) : (
                  f.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
