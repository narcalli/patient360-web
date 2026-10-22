"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type Me } from "./api";

/** Where a login should be right now, given its state (US-01 → US-06 picker → US-17 consent → Home). */
export function nextStep(me: Me): "/choose" | "/consent" | null {
  if (me.activePatientId === null) return "/choose";
  if (me.consentRequired) return "/consent";
  return null;
}

/**
 * Loads /me and sends the user where they belong: no session → /login, no patient → /choose,
 * no consent → /consent. Pages pass the step they are, so they don't redirect to themselves.
 */
export function useMe(page: "/choose" | "/consent" | "app") {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);

  const load = useCallback(async () => {
    try {
      const m = await api.get<Me>("/me");
      const step = nextStep(m);
      if (page === "app" && step) return router.replace(step);
      if (page === "/consent" && m.activePatientId === null) return router.replace("/choose");
      if (page === "/consent" && !m.consentRequired) return router.replace("/home");
      setMe(m);
      return m;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) router.replace("/login");
      else throw e;
    }
  }, [page, router]);

  useEffect(() => {
    void load();
  }, [load]);

  return { me, reload: load };
}
