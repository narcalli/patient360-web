"use client";

import { StaffArea } from "@/components/portal-shell";

/** Lab partner area. Who may open it, and which pages it has, come from GET /api/session. */
export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  return <StaffArea>{children}</StaffArea>;
}
