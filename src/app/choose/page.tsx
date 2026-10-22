"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth-layout";
import { ChevronLeft, ChevronRight } from "@/components/icons";
import { api } from "@/lib/api";
import { ageLabel, formatMobile, initials, relationLabel } from "@/lib/format";
import { useMe } from "@/lib/use-me";

/** US-06: one mobile, several patients. Shown after login when more than one is linked. */
export default function ChoosePatientPage() {
  const router = useRouter();
  const { me } = useMe("/choose");
  const [busy, setBusy] = useState<number | null>(null);

  async function choose(patientId: number) {
    setBusy(patientId);
    try {
      await api.put("/me/active-patient", { patientId });
      router.replace("/consent");
    } finally {
      setBusy(null);
    }
  }

  async function switchNumber() {
    await api.post("/auth/logout").catch(() => undefined);
    router.replace("/login");
  }

  return (
    <AuthLayout>
      <button type="button" className="mb-6 inline-flex min-h-[40px] items-center gap-1 text-sm font-semibold text-brand" onClick={() => void switchNumber()}>
        <ChevronLeft size={16} /> Use a different number
      </button>
      <h2 className="text-[30px] leading-tight font-extrabold text-ink-strong">Whose records?</h2>
      <p className="mt-2 text-[15px] text-muted">
        {me ? <>{me.patients.length} people are linked to {formatMobile(me.mobile)}. You can switch any time.</> : "Loading…"}
      </p>
      <ul className="mt-8 space-y-3">
        {me?.patients.map((p) => (
          <li key={p.id}>
            <button
              className="card flex w-full items-center gap-4 p-4 text-left hover:border-brand disabled:opacity-60"
              disabled={busy !== null}
              onClick={() => void choose(p.id)}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft font-bold text-brand">{initials(p.fullName)}</span>
              <span className="flex-1">
                <span className="block font-bold">{p.fullName}</span>
                <span className="block text-sm text-muted">
                  {relationLabel(p.relation)} · {ageLabel(p.birthYear)} · ID {p.patientCode}
                </span>
              </span>
              <ChevronRight className="text-muted" />
            </button>
          </li>
        ))}
      </ul>
    </AuthLayout>
  );
}
