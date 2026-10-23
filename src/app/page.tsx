"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type Me } from "@/lib/api";
import type { Session } from "@/lib/session";
import { nextStep } from "@/lib/use-me";

/** Entry point: each person to their own home (patients via the picker when no one is open), or to sign in. */
export default function Index() {
  const router = useRouter();
  useEffect(() => {
    api
      .get<Session>("/session")
      .then(async (s) => {
        if (s.role !== "patient") return router.replace(s.home);
        router.replace(nextStep(await api.get<Me>("/me")) ?? s.home);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) router.replace("/login");
      });
  }, [router]);
  return null;
}
