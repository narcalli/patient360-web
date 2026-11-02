"use client";

import { SignInSettings } from "@/components/sign-in-settings";
import { PageHeader } from "@/components/staff-ui";
import { AppearanceCard } from "@/components/theme";

/** Hospital staff's own sign-in: mobile and WhatsApp code, and an email and password. */
export default function StaffAccountPage() {
  return (
    <>
      <PageHeader title="Account" description="Your appearance and sign-in details for this portal." />
      <AppearanceCard className="mt-6 max-w-3xl" />
      <SignInSettings className="mt-6 max-w-3xl" />
    </>
  );
}
