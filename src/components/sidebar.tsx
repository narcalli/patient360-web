"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatMobile } from "@/lib/format";
import { activeHref, type Session } from "@/lib/session";
import { Logo } from "./brand";
import { useDisclosure } from "./disclosure";
import { HelpCard } from "./help";
import { ChevronUpDown, CloseIcon, LogoutIcon, NavIcon, SidebarIcon, UserCircleIcon } from "./icons";
import { ThemeSwitch } from "./theme";

const COLLAPSED_KEY = "p360.sidebar";

/** The desktop sidebar's collapsed state, kept on this device. */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === "collapsed";
    } catch {
      return false;
    }
  });
  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, c ? "open" : "collapsed");
      } catch {
        // Storage blocked: the choice lasts for this visit.
      }
      return !c;
    });
  return { collapsed, toggle };
}

/** Mobile numbers are shown grouped; emails as they are. */
const showLogin = (v: string) => (v.startsWith("+") ? formatMobile(v) : v);

interface SidebarBodyProps {
  session: Session;
  pathname: string;
  collapsed: boolean;
  onSignOut: () => void;
  /** Desktop: collapse or expand. Drawer: close. */
  onToggle: () => void;
  variant: "rail" | "drawer";
}

/** What both the desktop sidebar and the phone drawer show: logo and toggle, the role's pages, help, account. */
function SidebarBody({ session, pathname, collapsed, onSignOut, onToggle, variant }: SidebarBodyProps) {
  const current = activeHref(session.nav, pathname);
  const home = session.nav.find((n) => n.href === session.home);
  return (
    <div className="flex h-full flex-col">
      <div className={`flex h-16 shrink-0 items-center gap-2 ${collapsed ? "justify-center px-2" : "justify-between px-3"}`}>
        {!collapsed && (
          <Link href={session.home} className="min-w-0 rounded-md px-1" aria-label={home?.label ?? session.roleLabel}>
            <Logo className="h-9 w-auto max-w-[150px] object-contain object-left" />
          </Link>
        )}
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-muted transition-colors duration-150 hover:bg-subtle hover:text-ink"
          aria-label={variant === "drawer" ? "Close menu" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={variant === "rail" ? !collapsed : undefined}
          title={variant === "drawer" ? "Close menu" : collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {variant === "drawer" ? <CloseIcon size={20} /> : <SidebarIcon size={20} />}
        </button>
      </div>

      {/* Staff see which part of the portal they are in; patients only ever have their own. */}
      {session.role !== "patient" && !collapsed && <p className="eyebrow mt-1 px-5">{session.roleLabel}</p>}

      <nav aria-label="Main" className="mt-2 flex flex-col gap-0.5 px-2">
        {session.nav.map(({ key, href, label, icon }) => {
          const on = href === current;
          return (
            <Link
              key={key}
              href={href}
              aria-current={on ? "page" : undefined}
              aria-label={collapsed ? label : undefined}
              title={collapsed ? label : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-[var(--radius-control)] text-[15px] transition-colors duration-150 ${
                collapsed ? "justify-center" : "px-3"
              } ${on ? "bg-subtle font-semibold text-ink" : "font-medium text-ink-soft hover:bg-subtle hover:text-ink"}`}
            >
              <NavIcon name={icon} className={on ? "text-brand" : ""} />
              {!collapsed && label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-3 p-2">
        {/* The hospital's help line is for patients; staff have their own channels. */}
        {session.role === "patient" && !collapsed && <HelpCard className="mx-1" />}
        <AccountButton session={session} collapsed={collapsed} onSignOut={onSignOut} />
      </div>
    </div>
  );
}

/** Bottom of the sidebar, like a chat app's account row: who is signed in, appearance and sign out in a menu above it. */
function AccountButton({ session, collapsed, onSignOut }: { session: Session; collapsed: boolean; onSignOut: () => void }) {
  const d = useDisclosure();
  const { name, detail, signedInWith } = session.user;
  return (
    <div className="relative">
      <button
        {...d.buttonProps}
        aria-label={collapsed ? "Account and settings" : undefined}
        title={collapsed ? "Account and settings" : undefined}
        className={`flex min-h-12 w-full items-center gap-3 rounded-[var(--radius-control)] text-left transition-colors duration-150 hover:bg-subtle ${
          collapsed ? "justify-center" : "px-2.5"
        } ${d.open ? "bg-subtle" : ""}`}
      >
        <UserCircleIcon size={24} className="shrink-0 text-ink-soft" />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold tabular">{name ?? showLogin(signedInWith)}</span>
              <span className="block truncate text-xs text-muted">{detail ?? "Account and settings"}</span>
            </span>
            <ChevronUpDown size={16} className="shrink-0 text-muted" />
          </>
        )}
      </button>
      <div
        {...d.panelProps}
        className="absolute bottom-full left-0 z-30 mb-2 w-72 max-w-[calc(100vw-1rem)] rounded-[var(--radius-card)] border border-line bg-surface p-2 shadow-[var(--shadow-pop)] motion-safe:animate-fade-in"
      >
        <div className="px-3 pt-2 pb-3">
          <p className="eyebrow">Signed in with</p>
          <p className="mt-0.5 font-bold tabular [overflow-wrap:anywhere]">{showLogin(signedInWith)}</p>
          {name && detail && <p className="mt-0.5 text-sm text-muted">{name} · {detail}</p>}
        </div>
        <div className="border-t border-line px-3 pt-3 pb-3">
          <p className="mb-2 text-sm font-semibold">Appearance</p>
          <ThemeSwitch className="w-full" />
        </div>
        <div className="border-t border-line pt-2">
          <button
            type="button"
            onClick={onSignOut}
            className="flex min-h-11 w-full items-center gap-2.5 rounded-[var(--radius-control)] px-3 text-sm font-semibold text-bad transition-colors duration-150 hover:bg-bad-soft"
          >
            <LogoutIcon size={18} /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

/** Desktop (≥1024px): a sidebar that collapses to an icon rail; the choice is remembered on this device. */
export function DesktopSidebar(props: Omit<SidebarBodyProps, "variant">) {
  return (
    <aside
      className={`sticky top-0 hidden h-dvh shrink-0 border-r border-line bg-sidebar transition-[width] duration-200 ease-out motion-reduce:transition-none lg:block ${
        props.collapsed ? "w-[68px]" : "w-[260px]"
      }`}
    >
      <SidebarBody {...props} variant="rail" />
    </aside>
  );
}

/**
 * Phones and tablets: the same sidebar as a drawer from the left, opened by the menu button. A native modal dialog,
 * so focus is trapped, Escape and the backdrop close it, and the page behind is inert. Closes on navigation.
 */
export function MobileDrawer({ open, onClose, ...props }: Omit<SidebarBodyProps, "variant" | "collapsed" | "onToggle"> & { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => onClose(), [props.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <dialog
      ref={ref}
      aria-label="Menu"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="m-0 h-dvh max-h-none w-[min(300px,85vw)] max-w-none border-r border-line bg-sidebar p-0 text-ink backdrop:bg-overlay/50 open:motion-safe:animate-[drawer-in_200ms_ease-out] lg:hidden"
    >
      <SidebarBody {...props} collapsed={false} onToggle={onClose} variant="drawer" />
    </dialog>
  );
}
