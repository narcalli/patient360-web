"use client";

import Link from "next/link";
import { ActionsIcon, ChevronRight, ClipboardIcon, ReplaceIcon, UploadIcon } from "@/components/icons";
import { EmptyState, PageHeader } from "@/components/staff-ui";
import { useSessionContext } from "@/lib/use-session";
import { can } from "@/lib/session";

type Action = { href: string; label: string; description: string; icon: React.ReactNode; needs: string };

// One card per tool. A new admin tool is one more entry here (its pages live under /admin/actions/<name>).
const ACTIONS: Action[] = [
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
];

/** Admin Actions: the hospital admin's own tools. Only the admin type has the admin.actions permission, so only it gets this page. */
export default function AdminActionsPage() {
  const session = useSessionContext();
  const actions = ACTIONS.filter((a) => can(session, a.needs));

  return (
    <>
      <PageHeader title="Admin Actions" description="Tools only hospital admins can use." />
      <div className="mt-6 max-w-3xl">
        {actions.length === 0 ? (
          <EmptyState icon={<ActionsIcon size={22} />} title="No actions yet">
            Admin actions will appear here.
          </EmptyState>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {actions.map((a) => (
              <li key={a.href}>
                <Link href={a.href} className="card flex h-full items-start gap-4 p-5 transition-colors hover:bg-subtle">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand" aria-hidden="true">
                    {a.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{a.label}</span>
                    <span className="mt-0.5 block text-sm text-ink-soft">{a.description}</span>
                  </span>
                  <ChevronRight size={18} className="mt-1 shrink-0 text-muted" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
