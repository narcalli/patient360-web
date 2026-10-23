"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/components/theme";
import { api, ApiError, type Me } from "./api";

/**
 * Where a login should be right now (US-01 → US-06 picker → Home). Consent (US-17) is asked inside the app shell,
 * for whichever patient is open, so switching to a family member never leaves the portal.
 */
export function nextStep(me: Me): "/choose" | null {
  return me.activePatientId === null ? "/choose" : null;
}

/**
 * Loads /me and sends the user where they belong: no session → /login, no patient → /choose,
 * and /consent (still reachable directly) on to Home once consent is in. Pages pass the step they are.
 */
export function useMe(page: "/choose" | "/consent" | "app") {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const { syncFromAccount } = useTheme();

  const load = useCallback(async () => {
    try {
      const m = await api.get<Me>("/me");
      // The account's saved appearance follows the login to this device.
      syncFromAccount(m.theme);
      const step = nextStep(m);
      if (page === "app" && step) return router.replace(step);
      if (page === "/consent" && m.activePatientId === null) return router.replace("/choose");
      if (page === "/consent" && !m.consentRequired) return router.replace("/patient");
      // The shell shows the consent notice itself when the open patient needs it.
      setMe(m);
      return m;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) router.replace("/login");
      else throw e;
    }
  }, [page, router, syncFromAccount]);

  useEffect(() => {
    void load();
  }, [load]);

  return { me, reload: load };
}
