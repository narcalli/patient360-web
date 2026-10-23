import type { Hospital } from "./api";

// The portal checks branding again, whatever the API or the browser cache hands it: a colour only ever reaches a
// CSS variable, a logo only ever loads from the API's own logo route, and a link only ever opens an https page.

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const LOGO_PATH = /^\/api\/hospital\/logo\/(default|light)\?v=[0-9a-f]{12}$/;

const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() && v.length <= max ? v.trim() : null);
const color = (v: unknown) => (typeof v === "string" && HEX_COLOR.test(v) ? v : null);
const logo = (v: unknown) => (typeof v === "string" && LOGO_PATH.test(v) ? v : null);

/** Absolute https links only, so a javascript: or data: value can never become an href. */
export function safeHttpsUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && !u.username && !u.password ? u.toString() : null;
  } catch {
    return null;
  }
}

/** A Hospital built only from values that pass the checks above, or null when the basics are missing. */
export function parseHospital(raw: unknown): Hospital | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const name = text(r.name, 150);
  const shortName = text(r.shortName, 50);
  if (!name || !shortName) return null;
  return {
    name,
    shortName,
    portalTitle: text(r.portalTitle, 80),
    logoUrl: logo(r.logoUrl),
    logoLightUrl: logo(r.logoLightUrl),
    primaryColor: color(r.primaryColor),
    primaryColorDark: color(r.primaryColorDark),
    secondaryColor: color(r.secondaryColor),
    accentColor: color(r.accentColor),
    loginHeadline: text(r.loginHeadline, 120),
    loginTagline: text(r.loginTagline, 255),
    loginPoints: Array.isArray(r.loginPoints) ? r.loginPoints.map((p) => text(p, 120)).filter((p): p is string => !!p).slice(0, 5) : [],
    termsUrl: safeHttpsUrl(r.termsUrl),
    privacyUrl: safeHttpsUrl(r.privacyUrl),
    supportPhone: text(r.supportPhone, 20),
    supportEmail: text(r.supportEmail, 255),
  };
}
