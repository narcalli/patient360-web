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

/** The calendar day (YYYY-MM-DD, IST) a document belongs to: its report date, else the day it was added. */
export function documentDay(doc: { documentDate: string | null; uploadedAt: string }): string {
  return doc.documentDate ?? new Date(doc.uploadedAt).toLocaleDateString("en-CA", { timeZone: IST });
}

const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Today's calendar day in IST (YYYY-MM-DD), e.g. the default and latest report date. */
export const todayIst = (now = new Date()) => now.toLocaleDateString("en-CA", { timeZone: IST });

/** "September 2026" for a YYYY-MM-DD day. */
export function monthLabel(day: string): string {
  const [y, m] = day.split("-");
  return `${MONTHS_LONG[Number(m) - 1]} ${y}`;
}

/** Parts for a date block: "12", "Sep", "Sat". */
export function dayParts(day: string) {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return { day: String(d), month: MONTHS[m - 1]!, weekday: WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]! };
}

/** "Today", "Yesterday", "3 days ago" for the last week, otherwise the date. */
export function relativeDay(day: string, now = new Date()): string {
  const today = now.toLocaleDateString("en-CA", { timeZone: IST });
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 864e5);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days > 1 && days < 7) return `${days} days ago`;
  return formatDate(day);
}

/** A date of birth, which isn't always known. */
export const formatDob = (dob: string | null) => (dob ? formatDate(dob) : "Not recorded");

/** Date of birth with the age beside it. */
export const dobWithAge = (dob: string | null) => (dob ? `${formatDate(dob)} (${ageFromDob(dob)})` : "Not recorded");

/** Age in whole years on an IST calendar day, from a YYYY-MM-DD date of birth. */
export function ageFromDob(dob: string | null, now = new Date()): string {
  if (!dob) return "Age not recorded";
  const [ty, tm, td] = now.toLocaleDateString("en-CA", { timeZone: IST }).split("-").map(Number) as [number, number, number];
  const [y, m, d] = dob.split("-").map(Number) as [number, number, number];
  const years = ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
  if (years >= 1) return `${years} yrs`;
  const months = (ty - y) * 12 + (tm - m) - (td < d ? 1 : 0);
  return months <= 0 ? "Under 1 month" : `${months} month${months === 1 ? "" : "s"}`;
}

const GENDER_LABEL: Record<string, string> = { MALE: "Male", FEMALE: "Female", OTHER: "Other" };
export const genderLabel = (g: string | null) => (g ? (GENDER_LABEL[g] ?? null) : null);
/** For pickers: [value, label], in the order shown. */
export const GENDER_OPTIONS = Object.entries(GENDER_LABEL);

const BLOOD_LABEL: Record<string, string> = {
  A_POS: "A+", A_NEG: "A−", B_POS: "B+", B_NEG: "B−", AB_POS: "AB+", AB_NEG: "AB−", O_POS: "O+", O_NEG: "O−",
};
export const bloodGroupLabel = (g: string | null) => (g ? (BLOOD_LABEL[g] ?? null) : null);
export const BLOOD_GROUP_OPTIONS = Object.entries(BLOOD_LABEL);

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

export function ageLabel(birthYear: number | null): string {
  if (birthYear === null) return "Age not recorded";
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
export const RELATION_OPTIONS = Object.entries(RELATION_LABEL);

export function greeting(now = new Date()): string {
  const h = Number(now.toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: IST }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export const firstName = (fullName: string) => fullName.split(/\s+/)[0] ?? fullName;

/** DOCUMENT_VIEWED → "Document viewed". Labels for codes come from the codes themselves, never from a list here. */
// Abbreviations that are written in capitals inside an otherwise sentence-case label.
const ABBREVIATIONS = new Set(["otp", "totp", "ip", "id"]);

export const humanize = (code: string) => {
  const s = code
    .toLowerCase()
    .split("_")
    .map((w) => (ABBREVIATIONS.has(w) ? w.toUpperCase() : w))
    .join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** Date and time as staff read them, in IST: "23 Oct 2026, 3:04 pm". */
export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(iso));
}
