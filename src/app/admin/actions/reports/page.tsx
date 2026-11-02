"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BandsTab, GroupsTab, SettingsTab } from "@/components/report-admin-other";
import { ReportsTab, SetupPanel } from "@/components/report-admin-reports";
import { TabPanel, Tabs } from "@/components/report-admin-ui";
import { AnalyticsIcon, ChevronLeft } from "@/components/icons";
import { EmptyState, ErrorBanner, PageHeader, RowsSkeleton, useToast, useUrlState } from "@/components/staff-ui";
import { api, ApiError } from "@/lib/api";
import { reportAdminError, type ReportAdminOverview } from "@/lib/report-admin";
import { can } from "@/lib/session";
import { useSessionContext } from "@/lib/use-session";

const TABS = [
  { key: "reports", label: "Reports" },
  { key: "groups", label: "Groups" },
  { key: "settings", label: "Settings" },
  { key: "bands", label: "Spend bands" },
] as const;
type TabKey = (typeof TABS)[number]["key"];
const isTab = (v: string | null): v is TabKey => TABS.some((t) => t.key === v);
const ID = "report-admin";

/**
 * Reports, for hospital admins: which reports people see, their names and order, which numbers and filters each one
 * has, the spend bands and the financial year. Everything here is saved in the portal's own tables.
 */
export default function ReportAdminPage() {
  return (
    <Suspense>
      <ReportAdmin />
    </Suspense>
  );
}

function ReportAdmin() {
  const session = useSessionContext();
  const allowed = can(session, "reports.manage");
  const { params, set } = useUrlState();
  const toast = useToast();
  const [overview, setOverview] = useState<ReportAdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const asked = params.get("tab");
  const tab: TabKey = isTab(asked) ? asked : "reports";
  const setup = tab === "reports" ? params.get("setup") : null;

  const load = useCallback(async () => {
    try {
      setOverview(await api.get<ReportAdminOverview>("/report-admin/overview"));
      setError(null);
    } catch (err) {
      setError(reportAdminError(err instanceof ApiError ? err.code : ""));
    }
  }, []);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load, attempt]);

  const show = toast.show;
  const props = overview && { overview, reload: load, toast: show };

  return (
    <>
      <Link href="/admin/actions" className="btn-ghost -ml-3 mb-2">
        <ChevronLeft size={16} /> Admin
      </Link>
      <PageHeader title="Reports" description="Choose which reports people see, rename them, set the spend bands and the financial year." />

      <div className="mt-6 max-w-5xl">
        {!allowed ? (
          <EmptyState icon={<AnalyticsIcon size={22} />} title="You can't change reports">
            Ask a hospital admin who can.
          </EmptyState>
        ) : (
          <>
            <Tabs idPrefix={ID} label="Report settings" tabs={[...TABS]} current={tab} onChange={(k) => set({ tab: k === "reports" ? null : k, setup: null })} />
            <TabPanel idPrefix={ID} current={tab}>
              {error && <ErrorBanner text={error} onRetry={() => setAttempt((n) => n + 1)} />}
              {!error && !props && <RowsSkeleton rows={4} />}
              {props && tab === "reports" && !setup && <ReportsTab {...props} onSetup={(code) => set({ setup: code })} />}
              {props && tab === "reports" && setup && <SetupPanel {...props} code={setup} onBack={() => set({ setup: null })} onOpen={(code) => set({ setup: code })} />}
              {props && tab === "groups" && <GroupsTab {...props} />}
              {props && tab === "settings" && <SettingsTab {...props} />}
              {props && tab === "bands" && <BandsTab {...props} />}
            </TabPanel>
          </>
        )}
      </div>
      {toast.ui}
    </>
  );
}
