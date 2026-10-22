"use client";

import { Logo } from "./brand";
import { FileIcon, ShieldIcon, UsersIcon } from "./icons";

/** Two-panel frame for sign-in, picker and consent: brand panel on the left (desktop), form on the right. */
export function AuthLayout({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <aside className="relative hidden w-1/2 flex-col justify-between bg-brand-panel p-10 text-white lg:flex">
        <div>
          <Logo light className="h-[64px] w-auto" />
          <p className="mt-2 text-xs font-bold tracking-[0.08em] uppercase opacity-90">Patient portal</p>
        </div>
        <div>
          <h1 className="text-[44px] leading-[1.1] font-extrabold tracking-tight text-ink-strong">
            Your care,
            <br />
            in one place.
          </h1>
          <p className="mt-4 max-w-md text-base text-ink-strong/80">
            See your lab reports, scans and prescriptions from one secure portal.
          </p>
        </div>
        <ul className="space-y-3 text-sm text-ink-strong/85">
          <li className="flex items-center gap-3"><FileIcon size={18} /> Lab reports, scans and prescriptions</li>
          <li className="flex items-center gap-3"><UsersIcon size={18} /> Your whole family on one mobile number</li>
          <li className="flex items-center gap-3"><ShieldIcon size={18} /> Your records are private and only visible to you</li>
        </ul>
      </aside>

      <main className="flex flex-1 flex-col bg-canvas">
        <div className="px-6 pt-6 lg:hidden">
          <Logo className="h-10 w-auto" />
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-[400px]">{children}</div>
        </div>
        {footer && <div className="px-6 pb-6 text-center text-xs text-muted">{footer}</div>}
      </main>
    </div>
  );
}
