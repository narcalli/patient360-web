"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/brand";
import { FileIcon, HomeIcon, LogoutIcon, UserIcon } from "@/components/icons";
import { ShellContext } from "@/components/shell-context";
import { api } from "@/lib/api";
import { ageLabel, formatMobile, initials, relationLabel } from "@/lib/format";
import { useMe } from "@/lib/use-me";

// Phase 1 navigation only. Care plan, inbox, booking and payments come in later phases.
const NAV = [
  { href: "/home", label: "Home", Icon: HomeIcon },
  { href: "/records", label: "My records", Icon: FileIcon },
  { href: "/profile", label: "Profile", Icon: UserIcon },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { me, reload } = useMe("app");
  const [switching, setSwitching] = useState(false);

  const patient = me?.patients.find((p) => p.id === me.activePatientId);
  if (!me || !patient) return <div className="min-h-dvh bg-canvas" />;

  async function switchTo(patientId: number) {
    if (patientId === me!.activePatientId) return;
    setSwitching(true);
    try {
      await api.put("/me/active-patient", { patientId });
      // Reloading /me sends a family member who hasn't consented yet through consent first (US-17).
      await reload();
    } finally {
      setSwitching(false);
    }
  }

  async function signOut() {
    await api.post("/auth/logout").catch(() => undefined);
    router.replace("/login");
  }

  const isOn = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-dvh w-[264px] shrink-0 flex-col border-r border-line bg-white px-4 py-6 lg:flex">
        <div className="px-2">
          <Logo className="h-12 w-auto" />
          <p className="mt-1 text-[11px] font-bold tracking-[0.08em] text-ink-strong uppercase">Patient portal</p>
        </div>
        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex min-h-[46px] items-center gap-3 rounded-[var(--radius-control)] px-3.5 text-[15px] ${
                isOn(href) ? "bg-brand-soft font-semibold text-brand" : "font-medium text-[#37474f] hover:bg-canvas"
              }`}
            >
              <Icon /> {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl bg-canvas p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{initials(patient.fullName)}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{formatMobile(me.mobile)}</p>
              <p className="text-xs text-muted">
                {me.patients.length} {me.patients.length === 1 ? "patient" : "patients"} on this number
              </p>
            </div>
          </div>
          <button className="btn-secondary mt-3 min-h-[40px] w-full text-sm" onClick={() => void signOut()}>
            <LogoutIcon size={16} /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar: patient switcher (US-06) */}
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-white/95 px-4 py-3 backdrop-blur lg:px-10">
          <Logo className="h-8 w-auto lg:hidden" />
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
            {me.patients.length > 1 && <span className="label mr-1 hidden shrink-0 sm:block">Patients</span>}
            {me.patients.map((p) => {
              const on = p.id === me.activePatientId;
              return (
                <button
                  key={p.id}
                  disabled={switching}
                  onClick={() => void switchTo(p.id)}
                  className={`flex shrink-0 items-center gap-2.5 rounded-full border py-1.5 pr-4 pl-1.5 text-left ${
                    on ? "border-brand bg-brand-soft" : "border-line bg-white hover:border-line-strong"
                  }`}
                  aria-pressed={on}
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${on ? "bg-brand text-white" : "bg-brand-soft text-brand"}`}>
                    {initials(p.fullName)}
                  </span>
                  <span>
                    <span className="block text-sm leading-tight font-bold">{p.fullName}</span>
                    <span className="block text-xs leading-tight text-muted">
                      {relationLabel(p.relation)} · {ageLabel(p.birthYear)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <button className="icon-btn lg:hidden" aria-label="Sign out" onClick={() => void signOut()}>
            <LogoutIcon size={18} />
          </button>
        </header>

        <main className="flex-1 px-4 pt-6 pb-28 lg:px-10 lg:pt-8 lg:pb-12">
          <ShellContext.Provider value={{ me, patient }}>
            {/* Keyed by patient so every page reloads its data on a switch. */}
            <div key={patient.id} className="mx-auto max-w-[1040px]">{children}</div>
          </ShellContext.Provider>
        </main>

        {/* Bottom bar (mobile) */}
        <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-line bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
          {NAV.map(({ href, label, Icon }) => (
            <Link key={href} href={href} className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-semibold ${isOn(href) ? "text-brand" : "text-muted"}`}>
              <Icon size={22} /> {label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
