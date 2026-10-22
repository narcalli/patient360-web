"use client";

import { useEffect, useState } from "react";
import { useHospital } from "@/components/brand";
import { api, type Profile } from "@/lib/api";
import { formatDate, formatMobile } from "@/lib/format";

const GENDER: Record<string, string> = { MALE: "Male", FEMALE: "Female", OTHER: "Other", UNKNOWN: "" };

/** US-02: what the hospital has on record. Empty fields are blank, not errors. */
export default function ProfilePage() {
  const hospital = useHospital();
  const [p, setP] = useState<Profile | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.get<Profile>("/patient/profile").then(setP).catch(() => setError(true));
  }, []);

  const fields: [string, string | null | undefined][] = p
    ? [
        ["Full name", p.fullName],
        ["Patient ID", p.patientCode],
        ["Date of birth", formatDate(p.dob)],
        ["Gender", p.gender ? GENDER[p.gender] : null],
        ["Mobile number", formatMobile(p.mobile)],
        ["Email", p.email],
        ["Address", p.address],
      ]
    : [];

  return (
    <>
      <h1 className="text-[30px] leading-tight font-extrabold text-ink-strong">Profile</h1>
      <p className="mt-1 text-muted">The details {hospital?.shortName ?? "the hospital"} has on record.</p>

      <section className="card mt-6 max-w-2xl p-2">
        {error ? (
          <p className="p-4 text-bad">We couldn&apos;t load the profile. Please refresh to try again.</p>
        ) : !p ? (
          <p className="p-4 text-muted">Loading…</p>
        ) : (
          <dl className="divide-y divide-line">
            {fields.map(([label, value]) => (
              <div key={label} className="flex flex-col gap-1 px-4 py-4 sm:flex-row sm:gap-6">
                <dt className="w-40 shrink-0 text-sm text-muted">{label}</dt>
                <dd className="min-h-5 font-semibold">{value ?? ""}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
      <p className="mt-4 max-w-2xl text-sm text-muted">
        To correct any of these, contact the hospital{hospital?.supportPhone ? ` on ${hospital.supportPhone}` : ""}. Changes are made by hospital staff.
      </p>
    </>
  );
}
