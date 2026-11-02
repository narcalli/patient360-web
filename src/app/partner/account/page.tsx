"use client";

import { SignInSettings } from "@/components/sign-in-settings";
import { PageHeader } from "@/components/staff-ui";
import { AppearanceCard } from "@/components/theme";

/** The lab partner's own sign-in: mobile and WhatsApp code, plus an email and password once they add one. */
export default function PartnerAccountPage() {
  return (
    <>
      <PageHeader title="Account" description="Your appearance and sign-in details for this portal." />
      <AppearanceCard className="mt-6 max-w-3xl" />
      <SignInSettings className="mt-6 max-w-3xl" />
    </>
  );
}
