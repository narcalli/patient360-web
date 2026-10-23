"use client";

import { StaffArea } from "@/components/portal-shell";

/** Hospital staff area. Who may open it, and which pages it has, come from GET /api/session. */
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <StaffArea>{children}</StaffArea>;
}
