"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth-layout";
import { ChevronLeft, ShieldIcon } from "@/components/icons";
import { api, ApiError } from "@/lib/api";
import { useMe } from "@/lib/use-me";

type Consent = { notice: { version: string; body: string }; accepted: boolean };

/** US-17: consent before Home. Declining signs the patient out. */
export default function ConsentPage() {
  const router = useRouter();
  const { me } = useMe("/consent");
  const [consent, setConsent] = useState<Consent | null>(null);
  const [busy, setBusy] = useState(false);
  const [declined, setDeclined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    api.get<Consent>("/consent").then(setConsent).catch(() => setError("We couldn't load the consent notice. Please try again later."));
  }, [me]);

  const patient = me?.patients.find((p) => p.id === me.activePatientId);

  async function decide(decision: "ACCEPTED" | "DECLINED") {
    if (!consent) return;
    setBusy(true);
    setError(null);
    try {
      await api.post("/consent", { version: consent.notice.version, decision });
      if (decision === "ACCEPTED") router.replace("/home");
      else setDeclined(true);
    } catch (e) {
      // A newer notice was published while this one was open: show the new one.
      if (e instanceof ApiError && e.code === "NOTICE_CHANGED") setConsent(await api.get<Consent>("/consent"));
      else setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (declined) {
    return (
      <AuthLayout>
        <h2 className="text-[30px] leading-tight font-extrabold text-ink-strong">You&apos;re signed out</h2>
        <p className="mt-3 text-[15px] text-muted">
          You need to agree to how we use your data to use the patient portal. You can sign in again whenever you&apos;re ready.
        </p>
        <button className="btn mt-8 w-full" onClick={() => router.replace("/login")}>Back to sign in</button>
      </AuthLayout>
    );
  }

  // Back goes to the picker when there is a choice to make; otherwise it means "not my number".
  const canPick = (me?.patients.length ?? 0) > 1;
  async function goBack() {
    if (canPick) return router.replace("/choose");
    await api.post("/auth/logout").catch(() => undefined);
    router.replace("/login");
  }

  return (
    <AuthLayout>
      <button type="button" className="mb-6 inline-flex min-h-[40px] items-center gap-1 text-sm font-semibold text-brand" disabled={!me} onClick={() => void goBack()}>
        <ChevronLeft size={16} /> {canPick ? "Back to patients" : "Use a different number"}
      </button>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft text-brand"><ShieldIcon size={24} /></span>
      <h2 className="mt-5 text-[30px] leading-tight font-extrabold text-ink-strong">Your data, your consent</h2>
      <p className="mt-2 text-[15px] text-muted">
        {patient ? <>Before you see <b className="text-ink">{patient.fullName}</b>&apos;s records, please read how we use this data.</> : "Loading…"}
      </p>

      <div className="card mt-6 max-h-[42dvh] overflow-y-auto p-5 text-[15px] leading-relaxed whitespace-pre-line">
        {consent ? consent.notice.body : error ?? "Loading…"}
      </div>
      {consent && <p className="mt-2 text-xs text-muted">Notice version {consent.notice.version}</p>}
      {error && consent && <p role="alert" className="mt-3 text-sm text-bad">{error}</p>}

      <button className="btn mt-6 w-full" disabled={!consent || busy} onClick={() => void decide("ACCEPTED")}>I agree</button>
      <button className="btn-secondary mt-3 w-full" disabled={!consent || busy} onClick={() => void decide("DECLINED")}>I don&apos;t agree</button>
    </AuthLayout>
  );
}
