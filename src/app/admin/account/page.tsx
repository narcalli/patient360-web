"use client";

import { SignInSettings } from "@/components/sign-in-settings";
import { PageHeader } from "@/components/staff-ui";

/** The admin's own sign-in: email (fixed), password, and the authenticator app that goes with them. */
export default function AdminAccountPage() {
  return (
    <>
      <PageHeader title="Account" description="Your sign-in details for this portal." />
      <SignInSettings className="mt-6 max-w-3xl" />
    </>
  );
}
