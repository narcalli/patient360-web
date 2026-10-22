"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type Me } from "@/lib/api";
import { nextStep } from "@/lib/use-me";

/** Entry point: send the visitor to login, the picker, consent or Home. */
export default function Index() {
  const router = useRouter();
  useEffect(() => {
    api
      .get<Me>("/me")
      .then((me) => router.replace(nextStep(me) ?? "/home"))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) router.replace("/login");
      });
  }, [router]);
  return null;
}
