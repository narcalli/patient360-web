"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ConsentGate } from "@/components/consent-gate";
import { ConsentSection } from "@/components/consent-section";
import { PortalShell, ShellPlaceholder } from "@/components/portal-shell";
import { ShellContext } from "@/components/shell-context";
import { PatientSwitcher } from "@/components/shell-menus";
import { api } from "@/lib/api";
import type { Session } from "@/lib/session";
import { useMe } from "@/lib/use-me";
import { useSession } from "@/lib/use-session";

/** The patient area. The session decides that this person may be here; /me then says whose records are open. */
export default function PatientLayout({ children }: { children: React.ReactNode }) {
  const session = useSession();
  if (!session) return <ShellPlaceholder />;
  return <PatientArea session={session}>{children}</PatientArea>;
}

function PatientArea({ session, children }: { session: Session; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { me, reload } = useMe("app");
  const [switching, setSwitching] = useState(false);
  // The patient open before the last switch, for "Not now" on the consent notice.
  const previousId = useRef<string | null>(null);

  const patient = me?.patients.find((p) => p.id === me.activePatientId);
  if (!me || !patient) return <ShellPlaceholder />;

  async function switchTo(patientId: string) {
    if (patientId === me!.activePatientId) return;
    previousId.current = me!.activePatientId;
    setSwitching(true);
    try {
      await api.put("/me/active-patient", { patientId });
      // A family member without consent from this login gets the notice in place of the page (US-17).
      await reload();
    } finally {
      setSwitching(false);
    }
  }

  async function signOut() {
    await api.post("/auth/logout").catch(() => undefined);
    router.replace("/login");
  }

  const consented = me.patients.filter((p) => p.hasConsent && p.id !== patient.id);
  const fallback = consented.find((p) => p.id === previousId.current) ?? consented[0] ?? null;
  const profileHref = session.nav.find((n) => n.key === "profile")?.href;

  return (
    <PortalShell session={session} header={<PatientSwitcher me={me} patient={patient} switching={switching} onSwitch={(id) => void switchTo(id)} />}>
      <ShellContext.Provider value={{ me, patient, switchTo, switching, reload }}>
        {/* Keyed by patient so every page reloads its data on a switch. */}
        <div key={patient.id} className="mx-auto max-w-[1180px]">
          {me.consentRequired ? (
            <>
              <ConsentGate patient={patient} fallback={fallback} onAccepted={reload} onNotNow={switchTo} onSignOut={() => void signOut()} />
              {/* On Profile, everyone's consent stays manageable while this patient's records are closed. */}
              {profileHref && pathname.startsWith(profileHref) && <ConsentSection className="mx-auto mt-6 max-w-2xl" />}
            </>
          ) : (
            children
          )}
        </div>
      </ShellContext.Provider>
    </PortalShell>
  );
}
