"use client";

import { useCallback, useEffect, useState } from "react";
import { api, type Consents, type LinkedPatient } from "@/lib/api";
import { ageLabel, formatDate, formatMobile, initials, relationLabel } from "@/lib/format";
import { ConfirmDialog } from "./confirm-dialog";
import { CheckIcon, ShieldIcon } from "./icons";
import { useShell } from "./shell-context";

/** Consent for each person on this mobile number: status, when, and Give or Withdraw (DPDP: withdrawing is as easy). */
export function ConsentSection({ className = "" }: { className?: string }) {
  const { me, patient, switchTo, switching, reload } = useShell();
  const [consents, setConsents] = useState<Consents | null>(null);
  const [error, setError] = useState(false);
  const [confirming, setConfirming] = useState<LinkedPatient | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => api.get<Consents>("/consents").then(setConsents).catch(() => setError(true)), []);
  useEffect(() => {
    void load();
  }, [load]);

  async function withdraw(target: LinkedPatient) {
    setBusy(true);
    try {
      await api.post("/consent/withdraw", { patientId: target.id });
      setConfirming(null);
      setNotice(`Consent withdrawn for ${target.fullName}.`);
      await load();
      // Withdrawing for the open patient closes their records at once: the shell shows the notice instead.
      await reload();
    } catch {
      setNotice("Couldn't withdraw consent. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="consent-section-title" className={`card p-5 sm:p-6 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="consent-section-title" className="flex items-center gap-2 text-base font-bold">
            <ShieldIcon size={18} className="text-brand" /> Consent and privacy
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Records are shown only for people you have given consent for. Withdrawing closes that person&apos;s records in this portal until
            you give consent again; it doesn&apos;t delete anything the hospital holds.
          </p>
        </div>
        {consents?.noticeVersion && <span className="badge bg-subtle text-muted">Notice v{consents.noticeVersion}</span>}
      </div>

      <p role="status" aria-live="polite" className={notice ? "mt-3 rounded-[var(--radius-control)] bg-subtle px-3 py-2 text-sm" : "sr-only"}>
        {notice}
      </p>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-bad">We couldn&apos;t load consent details. Please refresh to try again.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line" aria-busy={!consents}>
          {me.patients.map((p) => {
            const c = consents?.patients.find((x) => x.patientId === p.id);
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                <span className="avatar h-10 w-10 text-sm" aria-hidden="true">{initials(p.fullName)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {p.fullName}
                    {p.id === patient.id && <span className="ml-2 text-xs font-medium text-muted">(open now)</span>}
                  </span>
                  <span className="block text-sm text-muted">{relationLabel(p.relation)} · {ageLabel(p.birthYear)}</span>
                </span>
                <ConsentBadge status={c?.status} decidedAt={c?.decidedAt ?? null} />
                <span className="flex w-full justify-end sm:w-auto">
                  {!c ? (
                    <span className="skeleton h-10 w-28" />
                  ) : c.status === "GIVEN" ? (
                    <button className="btn-ghost text-bad hover:bg-bad-soft" onClick={() => setConfirming(p)} aria-label={`Withdraw consent for ${p.fullName}`}>
                      Withdraw
                    </button>
                  ) : (
                    <button
                      className="btn-secondary min-h-10 text-sm"
                      disabled={switching}
                      onClick={() => {
                        // The open patient's notice is already on screen above: take the user to it.
                        if (p.id !== patient.id) return void switchTo(p.id);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                        document.getElementById("consent-title")?.focus({ preventScroll: true });
                      }}
                      aria-label={`Give consent for ${p.fullName}`}
                    >
                      Give consent
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {confirming && (
        <ConfirmDialog
          title={`Withdraw consent for ${confirming.fullName}?`}
          confirmLabel="Withdraw consent"
          busy={busy}
          onCancel={() => setConfirming(null)}
          onConfirm={() => void withdraw(confirming)}
        >
          {confirming.fullName}&apos;s reports, scans and prescriptions will no longer be shown on {formatMobile(me.mobile)}. You can give
          consent again at any time. The hospital keeps its records; this only affects the portal.
        </ConfirmDialog>
      )}
    </section>
  );
}

function ConsentBadge({ status, decidedAt }: { status?: Consents["patients"][number]["status"]; decidedAt: string | null }) {
  if (!status) return <span className="skeleton h-6 w-28 rounded-full" />;
  const when = decidedAt ? ` · ${formatDate(decidedAt)}` : "";
  if (status === "GIVEN") {
    return (
      <span className="badge bg-ok-soft text-ok">
        <CheckIcon size={14} /> Given{when}
      </span>
    );
  }
  if (status === "WITHDRAWN") return <span className="badge bg-subtle text-muted">Withdrawn{when}</span>;
  return <span className="badge bg-warn-soft text-warn">Not given</span>;
}
