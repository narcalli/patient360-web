"use client";

import Link from "next/link";
import { AnalyticsIcon, SettingsIcon, ChevronRight, ClipboardIcon, FlaskIcon, IdCardIcon, ReplaceIcon, ShieldIcon, UploadIcon } from "@/components/icons";
import { EmptyState, PageHeader } from "@/components/staff-ui";
import { useSessionContext } from "@/lib/use-session";
import { can } from "@/lib/session";

type Action = { href: string; label: string; description: string; icon: React.ReactNode; needs: string };

// One card per tool. A new admin tool is one more entry here (its pages live under /admin/actions/<name>).
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
    href: "/admin/actions/imports",
    label: "Import",
    description: "Bring people in from an Excel sheet. Check every row first, replace or delete the sheet, then run it.",
    icon: <UploadIcon size={22} />,
    needs: "imports.manage",
  },
  {
    href: "/admin/actions/import-rules",
    label: "Import rules",
    description: "Tell the portal what each column in your Excel sheet means, and which columns a sheet must have.",
    icon: <ReplaceIcon size={22} />,
    needs: "imports.manage",
  },
  {
    href: "/admin/actions/patient-fields",
    label: "Patient fields",
    description: "Choose what information the hospital keeps about each patient, and who can see it.",
    icon: <ClipboardIcon size={22} />,
    needs: "catalog.manage",
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
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))] gap-3">
            {actions.map((a, i) => (
              <li key={a.href} className="relative">
                <Link
                  href={a.href}
                  aria-describedby={`action-hint-${i}`}
                  className="card group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-subtle"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand" aria-hidden="true">
                    {a.icon}
                  </span>
                  <span className="min-w-0 flex-1 font-bold">{a.label}</span>
                  <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden="true" />
                  {/* What the tool is for: shown on hover and keyboard focus, so the tiles stay small. */}
                  <span
                    id={`action-hint-${i}`}
                    role="tooltip"
                    className="pointer-events-none absolute top-full left-3 z-20 mt-1.5 w-64 max-w-[calc(100%-1.5rem)] rounded-md bg-ink px-3 py-2 text-xs font-medium text-canvas opacity-0 shadow-[var(--shadow-pop)] transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
                  >
                    {a.description}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
