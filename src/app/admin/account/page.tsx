"use client";

import { AuthenticatorApps } from "@/components/authenticator-apps";
import { SignInSettings } from "@/components/sign-in-settings";
import { PageHeader } from "@/components/staff-ui";
import { AppearanceCard } from "@/components/theme";

/** The admin's own sign-in: email (fixed), password, and the authenticator apps that go with them. */
export default function AdminAccountPage() {
  return (
    <>
      <PageHeader title="Account" description="Your appearance and sign-in details for this portal." />
      <AppearanceCard className="mt-6 max-w-3xl" />
      <SignInSettings className="mt-6 max-w-3xl" />
      <AuthenticatorApps className="mt-6 max-w-3xl" />
    </>
  );
}
