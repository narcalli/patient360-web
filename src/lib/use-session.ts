"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "@/components/theme";
import { api, ApiError } from "./api";
import { mayOpen, SIGN_IN_PATH, type Session } from "./session";

/**
 * Loads /api/session and keeps the person inside their own part of the portal: signed out → the right sign-in page,
 * a page outside their nav → their home. Returns null until the page is allowed, so nothing of it renders first.
 */
export function useSession(): Session | null {
  const router = useRouter();
  const pathname = usePathname();
  const { syncFromAccount } = useTheme();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let live = true;
    api
      .get<Session>("/session")
      .then((s) => {
        if (!live) return;
        syncFromAccount(s.theme);
        if (mayOpen(s, pathname)) setSession(s);
        else router.replace(s.home);
      })
      .catch((e) => {
        if (live && e instanceof ApiError && e.status === 401) router.replace(SIGN_IN_PATH);
      });
    return () => {
      live = false;
    };
    // The session is loaded once per area; moving between pages re-checks the path below without a request.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Client-side navigation to a page outside the nav (a typed link, an old bookmark) goes home too.
  useEffect(() => {
    if (session && !mayOpen(session, pathname)) router.replace(session.home);
  }, [session, pathname, router]);

  return session && mayOpen(session, pathname) ? session : null;
}

export const SessionContext = createContext<Session | null>(null);

/** The signed-in person and their nav. Only usable inside a portal area (patient, admin or partner). */
export function useSessionContext(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error("useSessionContext outside a portal area");
  return s;
}
