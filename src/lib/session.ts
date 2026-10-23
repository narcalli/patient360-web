// Who is signed in and which part of the portal is theirs, as GET /api/session says. The portal holds no list of
// roles or pages: it draws the sidebar from `nav` and opens only pages under one of its paths.

export type Role = "patient" | "admin" | "staff" | "lab_partner";

export interface NavItem {
  key: string;
  label: string;
  /** One of NAV_ICONS in components/icons.tsx; anything else draws a plain dot. */
  icon: string;
  href: string;
}

export interface Session {
  role: Role;
  roleLabel: string;
  home: string;
  nav: NavItem[];
  /** What this person may do (role_permission), e.g. "patients.create". The API checks again on every request. */
  permissions: string[];
  user: { name: string | null; detail: string | null; signedInWith: string };
  theme: "system" | "light" | "dark";
}

/** True when this person's type has the permission: shows a button only when the action will work. */
export const can = (session: Pick<Session, "permissions">, permission: string) => session.permissions.includes(permission);

const under = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

/** Static export pages may end in a slash (/admin/audit/); compare without it. */
export const cleanPath = (path: string) => (path.length > 1 ? path.replace(/\/+$/, "") : path);

/** True when the page is under one of the session's nav items: the same rule the API's map uses. */
export function mayOpen(session: Pick<Session, "nav">, path: string): boolean {
  const p = cleanPath(path);
  return session.nav.some((n) => under(p, n.href));
}

/** The nav item a page belongs to: the longest matching path, so /patient/records doesn't also light up /patient. */
export function activeHref(nav: NavItem[], path: string): string | null {
  const p = cleanPath(path);
  return nav.filter((n) => under(p, n.href)).sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
}

/** Where to sign in when there is no session: one page for every role; the API works out who it is. */
export const SIGN_IN_PATH = "/login";
