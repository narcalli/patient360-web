// Dates are shown in IST, the way the hospital talks about them ("12 Sep 2026").
const IST = "Asia/Kolkata";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(iso: string): string {
  // Plain dates (YYYY-MM-DD) are calendar days: no time-zone shift. Timestamps are shown on IST days.
  const day = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : new Date(iso).toLocaleDateString("en-CA", { timeZone: IST });
  const [y, m, d] = day.split("-");
  // Built by hand: browsers disagree on "Sep" vs "Sept" for en-IN.
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
}

export function formatMobile(e164: string): string {
  const m = e164.match(/^\+91(\d{5})(\d{5})$/);
  return m ? `+91 ${m[1]} ${m[2]}` : e164;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function ageLabel(birthYear: number): string {
  const age = new Date().getFullYear() - birthYear;
  return age <= 0 ? "Under 1 yr" : `${age} yrs`;
}

const RELATION_LABEL: Record<string, string> = {
  SELF: "Self",
  SPOUSE: "Spouse",
  CHILD: "Child",
  PARENT: "Parent",
  SIBLING: "Sibling",
  OTHER: "Family",
};
export const relationLabel = (r: string) => RELATION_LABEL[r] ?? r;

export function greeting(now = new Date()): string {
  const h = Number(now.toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: IST }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export const firstName = (fullName: string) => fullName.split(/\s+/)[0] ?? fullName;
