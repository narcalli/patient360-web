"use client";

import { AnalyticsIcon, SettingsIcon, FlaskIcon, IdCardIcon, ShieldIcon } from "@/components/icons";
import { EmptyState, PageHeader } from "@/components/staff-ui";
import { ToolGrid, type Tool } from "@/components/tool-grid";
import { useSessionContext } from "@/lib/use-session";
import { can } from "@/lib/session";

type Action = Tool & { needs: string };

// One card per tool. A new admin tool is one more entry here (its pages live under /admin/actions/<name>). Import,
// Import rules, Connectors and Patient fields are on the Data page (/admin/data).
const ACTIONS: Action[] = [
  {
    href: "/admin/actions/users",
    label: "Users",
    description: "Everyone who signs in for the hospital and its lab partners. Add people, change their type, reset access.",
    icon: <IdCardIcon size={22} />,
    needs: "users.manage",
  },
  {
    href: "/admin/actions/lab-partners",
    label: "Lab partners",
    description: "Labs that upload results, and the people who sign in for them.",
    icon: <FlaskIcon size={22} />,
    needs: "labs.manage",
  },
  {
    href: "/admin/actions/audit",
    label: "Audit log",
    description: "Every sign-in, view, download and change, newest first.",
    icon: <ShieldIcon size={22} />,
    needs: "audit.view",
  },
  {
    href: "/admin/actions/reports",
    label: "Reports",
    description: "Choose which reports people see, rename them, set the spend bands and the financial year.",
    icon: <AnalyticsIcon size={22} />,
    needs: "reports.manage",
  },
];

/** Admin: the hospital admin's own tools. Only the admin type has the admin.actions permission, so only it gets this page. */
export default function AdminActionsPage() {
  const session = useSessionContext();
  const actions = ACTIONS.filter((a) => can(session, a.needs));

  return (
    <>
      <PageHeader title="Admin" description="Tools only hospital admins can use." />
      <div className="mt-6">
        {actions.length === 0 ? (
          <EmptyState icon={<SettingsIcon size={22} />} title="Nothing here yet">
            Admin tools will appear here.
          </EmptyState>
        ) : (
          <ToolGrid tools={actions} />
        )}
      </div>
    </>
  );
}
