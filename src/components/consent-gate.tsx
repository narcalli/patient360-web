"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError, type ConsentNotice, type LinkedPatient } from "@/lib/api";
import { initials, relationLabel } from "@/lib/format";
import { AlertIcon, ShieldIcon } from "./icons";

/**
 * US-17 inside the app: the open patient has no consent from this login yet (just switched to, or withdrawn), so
 * their records stay closed and the notice is shown in place of the page. "Not now" goes back to someone who has
 * consent; nothing else in the portal changes.
 */
export function ConsentGate({
  patient,
  fallback,
  onAccepted,
  onNotNow,
  onSignOut,
}: {
  patient: LinkedPatient;
  /** A patient on this login who already has consent, to go back to; none: "Not now" signs out. */
  fallback: LinkedPatient | null;
  onAccepted: () => Promise<unknown>;
  onNotNow: (patientId: number) => Promise<unknown>;
  onSignOut: () => void;
}) {
  const [consent, setConsent] = useState<ConsentNotice | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
    api.get<ConsentNotice>("/consent").then(setConsent).catch(() => setError("We couldn't load the consent notice. Please try again."));
  }, []);

  async function accept() {
    if (!consent) return;
    setBusy(true);
    setError(null);
    try {
      await api.post("/consent", { version: consent.notice.version, decision: "ACCEPTED" });
      await onAccepted();
    } catch (e) {
      // A newer notice was published while this one was open: show the new one.
      if (e instanceof ApiError && e.code === "NOTICE_CHANGED") setConsent(await api.get<ConsentNotice>("/consent"));
      else setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function notNow() {
    if (!fallback) return onSignOut();
    setBusy(true);
    try {
      await onNotNow(fallback.id);
    } finally {
      setBusy(false);
    }
  }

  const self = patient.relation === "SELF";
  return (
    <section aria-labelledby="consent-title" className="card mx-auto max-w-2xl overflow-hidden">
      <div className="border-b border-line bg-subtle px-5 py-5 sm:px-7">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand"><ShieldIcon size={22} /></span>
          <div className="min-w-0">
            <h1 id="consent-title" ref={headingRef} tabIndex={-1} className="text-xl font-extrabold outline-none sm:text-2xl">
              Your consent is needed
            </h1>
            <p className="text-sm text-muted">Before {self ? "your" : `${patient.fullName}'s`} records can be shown</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2.5">
          <span className="avatar h-9 w-9 text-xs" aria-hidden="true">{initials(patient.fullName)}</span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold">{patient.fullName}</span>
            <span className="block text-xs text-muted">{relationLabel(patient.relation)} · ID {patient.patientCode}</span>
          </span>
        </div>
      </div>

      <div className="px-5 py-5 sm:px-7">
        <p className="text-sm text-ink-soft">Please read how the hospital uses this data. You can withdraw your consent at any time from Profile.</p>
        <div className="mt-3 max-h-[40dvh] overflow-y-auto rounded-[var(--radius-control)] border border-line bg-subtle p-4 text-[15px] leading-relaxed whitespace-pre-line" tabIndex={0} aria-label="Consent notice">
          {consent ? consent.notice.body : error ? "" : "Loading…"}
        </div>
        {consent && <p className="mt-2 text-xs text-muted">Notice version {consent.notice.version}</p>}
        {error && (
          <p role="alert" className="mt-3 flex items-start gap-2 rounded-[var(--radius-control)] bg-bad-soft px-3 py-2.5 text-sm text-bad">
            <AlertIcon size={18} className="mt-px shrink-0" /> {error}
          </p>
        )}

        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button className="btn-secondary" disabled={busy} onClick={() => void notNow()}>
            {fallback ? `Not now, back to ${fallback.fullName}` : "Not now, sign out"}
          </button>
          <button className="btn" disabled={!consent || busy} onClick={() => void accept()}>
            {busy ? "Saving…" : "I agree"}
          </button>
        </div>
      </div>
    </section>
  );
}
