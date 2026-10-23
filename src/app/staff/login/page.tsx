"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Old address: staff now sign in on the same page as everyone else (/login), so bookmarks still work. */
export default function StaffLoginRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/login");
  }, [router]);
  return null;
}
