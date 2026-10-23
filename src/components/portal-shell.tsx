"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { SIGN_IN_PATH, type Session } from "@/lib/session";
import { SessionContext, useSession } from "@/lib/use-session";
import { Logo } from "./brand";
import { MenuIcon } from "./icons";
import { DesktopSidebar, MobileDrawer, useSidebarCollapsed } from "./sidebar";

/** Blank page in the canvas colour while the session loads, so nothing of a page shows before it is allowed. */
export const ShellPlaceholder = () => <div className="min-h-dvh bg-canvas" aria-busy="true" />;

/**
 * The frame every signed-in page shares: sidebar (drawer on phones) drawn from the session's nav, a header with an
 * optional slot, and the main area. Patients, admins and lab partners all get the same frame and only their own pages.
 */
export function PortalShell({ session, header, children }: { session: Session; header?: React.ReactNode; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { collapsed, toggle } = useSidebarCollapsed();
  const mainRef = useRef<HTMLElement>(null);
  const firstRoute = useRef(true);

  // After moving to another page, screen-reader and keyboard users start at the new content, not the old link.
  useEffect(() => {
    if (firstRoute.current) firstRoute.current = false;
    else mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  async function signOut() {
    await api.post("/auth/logout").catch(() => undefined);
    router.replace(SIGN_IN_PATH);
  }

  const sidebar = { session, pathname, onSignOut: () => void signOut() };

  return (
    <SessionContext.Provider value={session}>
      <div className="flex min-h-dvh">
        <a href="#main" className="btn sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50">Skip to main content</a>

        <DesktopSidebar {...sidebar} collapsed={collapsed} onToggle={toggle} />
        <MobileDrawer {...sidebar} open={drawerOpen} onClose={() => setDrawerOpen(false)} />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-line bg-surface/90 backdrop-blur dark:bg-canvas/90">
            <div className="mx-auto flex h-16 max-w-[1180px] items-center gap-2 px-3 sm:px-4 lg:px-8">
              <button
                type="button"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-ink-soft hover:bg-subtle lg:hidden"
                aria-label="Open menu"
                aria-expanded={drawerOpen}
                onClick={() => setDrawerOpen(true)}
              >
                <MenuIcon size={22} />
              </button>
              <Logo className="h-7 w-auto max-w-[88px] shrink-0 object-contain object-left max-sm:hidden lg:hidden" />
              <div className="flex min-w-0 flex-1 justify-end lg:justify-start">{header}</div>
            </div>
          </header>

          <main id="main" ref={mainRef} tabIndex={-1} className="flex-1 px-4 pt-6 pb-12 outline-none lg:px-8 lg:pt-8">
            {children}
          </main>
        </div>
      </div>
    </SessionContext.Provider>
  );
}

/** A staff area (admin or lab partner): the frame with the person's role and organisation in the header. */
export function StaffArea({ children }: { children: React.ReactNode }) {
  const session = useSession();
  if (!session) return <ShellPlaceholder />;
  return (
    <PortalShell
      session={session}
      header={
        <p className="flex min-w-0 items-center gap-2 text-sm">
          <span className="badge bg-subtle text-ink-soft ring-1 ring-line ring-inset">{session.roleLabel}</span>
          {session.user.detail && session.user.detail !== session.roleLabel && <span className="truncate font-semibold">{session.user.detail}</span>}
        </p>
      }
    >
      <div className="mx-auto max-w-[1180px]">{children}</div>
    </PortalShell>
  );
}
