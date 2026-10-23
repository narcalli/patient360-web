"use client";

import { Logo, PortalTitle, TermsNote, useHospital } from "./brand";
import { CheckIcon } from "./icons";
import { ThemeSwitch } from "./theme";

/**
 * Two-panel frame for sign-in, picker and consent: brand panel on the left (desktop), form on the right.
 * Every word on the panel comes from the hospital's config; anything it leaves empty is simply not shown. The form
 * side holds the page's one h1, so the heading order is the same on phone and desktop.
 */
export function AuthLayout({ children, terms = false }: { children: React.ReactNode; terms?: boolean }) {
  const h = useHospital();
  return (
    <div className="flex min-h-dvh">
      <aside className="relative hidden w-[46%] max-w-[640px] flex-col justify-between overflow-hidden bg-panel p-10 break-words text-on-panel lg:flex xl:p-14 dark:border-r dark:border-line dark:[background-image:radial-gradient(120%_70%_at_0%_100%,color-mix(in_oklab,var(--color-brand)_18%,transparent),transparent_65%)]">
        <div>
          <Logo light className="h-16 w-auto max-w-[280px] object-contain object-left" />
          <PortalTitle className="mt-3 opacity-90" />
        </div>
        <div>
          {h?.loginHeadline && (
            <p className="font-display text-[44px] leading-[1.08] font-extrabold tracking-tight whitespace-pre-line xl:text-[52px]">{h.loginHeadline}</p>
          )}
          {h?.loginTagline && <p className="mt-5 max-w-md text-lg opacity-90">{h.loginTagline}</p>}
        </div>
        <ul className="space-y-3 text-[15px]">
          {h?.loginPoints.map((point) => (
            <li key={point} className="flex items-center gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-on-panel/15 dark:bg-brand-soft dark:text-brand"><CheckIcon size={15} /></span>
              {point}
            </li>
          ))}
        </ul>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col bg-canvas">
        <header className="flex items-center justify-between gap-4 px-5 pt-5 sm:px-8">
          <Logo className="h-10 w-auto max-w-[160px] object-contain object-left lg:invisible" />
          <ThemeSwitch compact />
        </header>
        <main className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[420px] sm:rounded-[var(--radius-card)] sm:border sm:border-line sm:bg-surface sm:p-8 sm:shadow-[var(--shadow-card)]">{children}</div>
        </main>
        {terms && (
          <p className="px-6 pb-6 text-center text-xs text-muted">
            <TermsNote />
          </p>
        )}
      </div>
    </div>
  );
}
