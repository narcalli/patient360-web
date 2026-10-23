"use client";

import type { LinkedPatient, Me } from "@/lib/api";
import { ageLabel, formatMobile, initials, relationLabel } from "@/lib/format";
import { useDisclosure } from "./disclosure";
import { CheckIcon, ChevronDown, ShieldIcon } from "./icons";

const panel = "absolute top-full z-30 mt-2 rounded-[var(--radius-card)] border border-line bg-surface p-2 shadow-[var(--shadow-pop)] motion-safe:animate-fade-in";

function PatientLine({ p, size = "md" }: { p: LinkedPatient; size?: "sm" | "md" }) {
  return (
    <>
      <span className={`avatar ${size === "sm" ? "h-9 w-9 text-xs" : "h-10 w-10 text-sm"}`} aria-hidden="true">{initials(p.fullName)}</span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm leading-tight font-bold">{p.fullName}</span>
        <span className="block truncate text-xs leading-tight text-muted">
          {relationLabel(p.relation)} · {ageLabel(p.birthYear)}
        </span>
      </span>
    </>
  );
}

/**
 * Whose records are open (US-06). One patient: a plain label. Several: a button that lists everyone on this
 * number, with the open one marked.
 */
export function PatientSwitcher({ me, patient, switching, onSwitch }: { me: Me; patient: LinkedPatient; switching: boolean; onSwitch: (id: number) => void }) {
  const d = useDisclosure();
  if (me.patients.length < 2) {
    return (
      <div className="flex min-w-0 items-center gap-2.5">
        <PatientLine p={patient} />
      </div>
    );
  }
  return (
    <div className="relative min-w-0">
      <button
        {...d.buttonProps}
        aria-label={`Viewing ${patient.fullName}. Switch patient`}
        disabled={switching}
        className="flex max-w-full min-w-0 items-center gap-2.5 rounded-full border border-line bg-surface py-1 pr-3 pl-1 transition-colors duration-150 hover:border-line-strong hover:bg-subtle"
      >
        <PatientLine p={patient} />
        <ChevronDown size={18} className={`shrink-0 text-muted transition-transform duration-150 ${d.open ? "rotate-180" : ""}`} />
      </button>
      <div {...d.panelProps} className={`${panel} left-0 w-[min(22rem,calc(100vw-2rem))] max-lg:right-0 max-lg:left-auto`}>
        <p className="eyebrow px-3 pt-2 pb-1.5">Patients on {formatMobile(me.mobile)}</p>
        <ul>
          {me.patients.map((p) => {
            const on = p.id === patient.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  aria-current={on ? "true" : undefined}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 transition-colors duration-150 ${on ? "bg-subtle" : "hover:bg-subtle"}`}
                  onClick={() => {
                    d.close();
                    if (!on) onSwitch(p.id);
                  }}
                >
                  <PatientLine p={p} size="sm" />
                  {on ? (
                    <span className="flex items-center gap-1 text-xs font-semibold text-brand"><CheckIcon size={16} /> Viewing</span>
                  ) : p.hasConsent ? (
                    <span className="text-xs font-semibold text-muted">Switch</span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-semibold text-warn"><ShieldIcon size={14} /> Consent needed</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
        <p className="px-3 pt-2 pb-2 text-xs text-muted">Each person&apos;s records are kept separate. Someone without consent from you is asked for it first, right here.</p>
      </div>
    </div>
  );
}
