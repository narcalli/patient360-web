"use client";

import { StaffArea } from "@/components/portal-shell";

/** Hospital admin area. Who may open it, and which pages it has, come from GET /api/session. */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <StaffArea>{children}</StaffArea>;
}
