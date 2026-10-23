"use client";

import { SignInSettings } from "@/components/sign-in-settings";
import { PageHeader } from "@/components/staff-ui";

/** Hospital staff's own sign-in: mobile and WhatsApp code, and an email and password. */
export default function StaffAccountPage() {
  return (
    <>
      <PageHeader title="Account" description="Your sign-in details for this portal." />
      <SignInSettings className="mt-6 max-w-3xl" />
    </>
  );
}
