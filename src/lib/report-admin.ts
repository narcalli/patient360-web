// Admin screens for reports: what the API sends, and the small pure rules the screens use. node --test (no extra framework).
export type Active = "ACTIVE" | "DEACTIVATED";

export interface AdminReport {
  code: string;
  label: string;
  question: string;
  domain: { code: string; label: string };
  dataset: { code: string; label: string };
  defaultPeriod: { code: string; label: string } | null;
  /** False for a report with no date to filter by: it follows the spend window setting instead. */
  canHavePeriod: boolean;
  permissionCode: string | null;
  status: Active;
  sortOrder: number;
  isSystem: boolean;
  clonedFrom: string | null;
  metricCount: number;
}

export interface AdminDomain {
  code: string;
  label: string;
  description: string | null;
  sortOrder: number;
  status: Active;
  reportCount: number;
}

export type SpendBasis = "NET" | "PATIENT_PAYABLE";

export interface ReportSettings {
  fiscalYearStartMonth: number;
  spendBasis: SpendBasis;
  spendScope: "PATIENT";
  spendWindowMonths: number | null;
  minCountThreshold: number;
}

export interface SpendBand {
  id: number;
  code: string;
  label: string;
  minAmount: number;
  maxAmount: number | null;
  sortOrder: number;
  status: Active;
}

export interface ReportAdminOverview {
  reports: AdminReport[];
  domains: AdminDomain[];
  periods: { code: string; label: string }[];
  permissions: { code: string; label: string }[];
  settings: ReportSettings;
  spendBands: SpendBand[];
}

export interface SetupMetric {
  code: string;
  label: string;
  format: string;
  definition: string;
  shown: boolean;
  isKpi: boolean;
  labelOverride: string | null;
}

export interface SetupFilter {
  column: string;
  label: string;
  isUserEditable: boolean;
  defaultValue: string | null;
}

export interface ReportSetup {
  code: string;
  label: string;
  isSystem: boolean;
  metrics: SetupMetric[];
  filters: SetupFilter[];
}

export interface SetupBody {
  metrics: { code: string; isKpi: boolean; labelOverride: string | null }[];
  filters: { column: string; isUserEditable: boolean; defaultValue: string | null }[];
}

export const BASIS_TEXT: Record<SpendBasis, string> = {
  NET: "Net billed minus refunds",
  PATIENT_PAYABLE: "Patient payable minus refunds",
};

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthName = (n: number) => MONTH_NAMES[n - 1] ?? String(n);

/** What a refused change says to the person who tried it. */
export function reportAdminError(code: string): string {
  const known: Record<string, string> = {
    NETWORK: "You seem to be offline. Check your connection and try again.",
    FORBIDDEN: "You don't have permission to change reports.",
    NOT_FOUND: "That no longer exists. Reload the page and try again.",
    VALIDATION: "Something you entered isn't allowed. Check the fields and try again.",
    NO_PERIOD_COLUMN: "This report has no date to filter by, so it can't have a period.",
    SYSTEM_REPORT: "Built-in reports are locked. Make a copy to change it.",
    NEEDS_A_METRIC: "Show at least one number in the report.",
    OVERLAP: "Two spend bands can't cover the same amounts. Change one of the ranges.",
    BAD_RANGE: "The upper amount must be higher than the lower amount.",
  };
  return known[code] ?? "That didn't work. Try again in a moment.";
}

// ─── Reorder ─────────────────────────────────────────────────────────────────

/** The list with the item at `index` moved by `delta` places (-1 up, 1 down). The same list when it can't move. */
export function moveItem<T>(list: readonly T[], index: number, delta: -1 | 1): T[] {
  const to = index + delta;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(to, 0, item as T);
  return next;
}

// ─── Report setup ────────────────────────────────────────────────────────────

/** The body to save: the shown metrics in list order, a blank label override as none, a blank default as none. */
export function setupBody(metrics: readonly SetupMetric[], filters: readonly SetupFilter[]): SetupBody {
  const blank = (s: string | null) => (s && s.trim() ? s.trim() : null);
  return {
    metrics: metrics.filter((m) => m.shown).map((m) => ({ code: m.code, isKpi: m.isKpi, labelOverride: blank(m.labelOverride) })),
    filters: filters.map((f) => ({ column: f.column, isUserEditable: f.isUserEditable, defaultValue: blank(f.defaultValue) })),
  };
}

export const setupChanged = (a: SetupBody, b: SetupBody) => JSON.stringify(a) !== JSON.stringify(b);

/** Turning a number off also takes it out of the headline row. */
export function toggleShown(m: SetupMetric, shown: boolean): SetupMetric {
  return { ...m, shown, isKpi: shown ? m.isKpi : false };
}

// ─── Editing a report ────────────────────────────────────────────────────────

export interface ReportDraft {
  label: string;
  question: string;
  domain: string;
  defaultPeriod: string | null;
  permissionCode: string | null;
  status: Active;
  sortOrder: number;
}

export const draftOf = (r: AdminReport): ReportDraft => ({
  label: r.label,
  question: r.question,
  domain: r.domain.code,
  defaultPeriod: r.defaultPeriod?.code ?? null,
  permissionCode: r.permissionCode,
  status: r.status,
  sortOrder: r.sortOrder,
});

/** Only the fields that differ from the saved report, so a save never overwrites what it didn't touch. */
export function changesOf(before: ReportDraft, after: ReportDraft): Partial<ReportDraft> {
  const out: Partial<ReportDraft> = {};
  for (const key of Object.keys(after) as (keyof ReportDraft)[]) {
    if (before[key] !== after[key]) (out as Record<string, unknown>)[key] = after[key];
  }
  return out;
}

/** Why a report's name or question can't be saved, or null. */
export function reportTextProblem(label: string, question: string): string | null {
  const l = label.trim().length;
  const q = question.trim().length;
  if (l < 2 || l > 100) return "The name needs 2 to 100 characters.";
  if (q < 2 || q > 300) return "The question needs 2 to 300 characters.";
  return null;
}

/** A whole number from what was typed, or null. */
export function wholeNumber(text: string): number | null {
  const t = text.trim();
  return /^-?\d{1,9}$/.test(t) ? Number(t) : null;
}

// ─── Spend bands ─────────────────────────────────────────────────────────────

/** How an amount is written (formatRupees from reports.ts); passed in so this file stands alone under node --test. */
export type Rupees = (n: number) => string;

export const sortedBands = (bands: readonly SpendBand[]): SpendBand[] => [...bands].sort((a, b) => a.minAmount - b.minAmount || a.id - b.id);
const activeSorted = (bands: readonly SpendBand[]) => sortedBands(bands.filter((b) => b.status === "ACTIVE"));

/** "₹0 to ₹10,000" (the upper amount itself is in the next band), or "₹50,000 and above". */
export const bandRange = (b: Pick<SpendBand, "minAmount" | "maxAmount">, rupees: Rupees): string =>
  b.maxAmount == null ? `${rupees(b.minAmount)} and above` : `${rupees(b.minAmount)} to ${rupees(b.maxAmount)}`;

/** An amount typed by a person ("10,000", "₹ 2500.50") as a number, or null when it isn't one. */
export function parseAmount(text: string): number | null {
  const t = text.replace(/[₹,\s]/g, "");
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(t)) return null;
  return Number(t);
}

/** What is wrong with the active bands as a set, in words. Empty when they cover every amount from zero upward. */
export function bandIssues(bands: readonly SpendBand[], rupees: Rupees): string[] {
  const active = activeSorted(bands);
  if (active.length === 0) return ["There are no spend bands yet. Until bands exist the spend report puts everyone in “No band set”."];
  const issues: string[] = [];
  const first = active[0]!;
  if (first.minAmount > 0) issues.push(`Spend under ${rupees(first.minAmount)} is in no band, so those patients show as “No band set”.`);
  for (let i = 0; i < active.length - 1; i++) {
    const a = active[i]!;
    const b = active[i + 1]!;
    if (a.maxAmount == null) issues.push(`“${a.label}” has no upper limit but “${b.label}” starts above it. Give “${a.label}” an upper amount.`);
    else if (a.maxAmount < b.minAmount) issues.push(`Spend from ${rupees(a.maxAmount)} up to ${rupees(b.minAmount)} is in no band, so those patients show as “No band set”.`);
    else if (a.maxAmount > b.minAmount) issues.push(`“${a.label}” and “${b.label}” overlap.`);
  }
  const last = active[active.length - 1]!;
  if (last.maxAmount != null) issues.push(`Spend of ${rupees(last.maxAmount)} and above is in no band, so those patients show as “No band set”.`);
  return issues;
}

/** True when a range (min inclusive, max exclusive) shares any amount with another active band. `skipId` is the band being edited. */
export function bandOverlaps(bands: readonly SpendBand[], min: number, max: number | null, skipId?: number): boolean {
  return bands
    .filter((b) => b.status === "ACTIVE" && b.id !== skipId)
    .some((b) => min < (b.maxAmount ?? Infinity) && b.minAmount < (max ?? Infinity));
}

/** Why a band's amounts can't be saved, or null. */
export function bandProblem(minText: string, maxText: string, bands: readonly SpendBand[], skipId?: number, active = true): string | null {
  const min = parseAmount(minText);
  if (min == null) return "Enter the lowest amount in this band as a number, like 10,000.";
  let max: number | null = null;
  if (maxText.trim()) {
    max = parseAmount(maxText);
    if (max == null) return "Enter the upper amount as a number, or leave it empty for no upper limit.";
    if (max <= min) return "The upper amount must be higher than the lowest amount.";
  }
  if (active && bandOverlaps(bands, min, max, skipId)) return "This range overlaps another active band.";
  return null;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface SettingsDraft {
  fiscalYearStartMonth: string;
  spendBasis: SpendBasis;
  spendWindowMonths: string;
  minCountThreshold: string;
}

export const settingsDraftOf = (s: ReportSettings): SettingsDraft => ({
  fiscalYearStartMonth: String(s.fiscalYearStartMonth),
  spendBasis: s.spendBasis,
  spendWindowMonths: s.spendWindowMonths == null ? "" : String(s.spendWindowMonths),
  minCountThreshold: String(s.minCountThreshold),
});

/** Why the settings can't be saved, or null. */
export function settingsProblem(d: SettingsDraft): string | null {
  if (d.spendWindowMonths.trim()) {
    const w = wholeNumber(d.spendWindowMonths);
    if (w == null || w < 1 || w > 120) return "The spend window is a number of months from 1 to 120, or empty for all time.";
  }
  const t = wholeNumber(d.minCountThreshold);
  if (t == null || t < 1 || t > 50) return "The smallest group shown is a number from 1 to 50.";
  return null;
}

/** Only the settings that changed, in the shape the API takes. */
export function settingsChanges(before: ReportSettings, d: SettingsDraft): Partial<{ fiscalYearStartMonth: number; spendBasis: SpendBasis; spendWindowMonths: number | null; minCountThreshold: number }> {
  const out: ReturnType<typeof settingsChanges> = {};
  const fy = Number(d.fiscalYearStartMonth);
  if (fy !== before.fiscalYearStartMonth) out.fiscalYearStartMonth = fy;
  if (d.spendBasis !== before.spendBasis) out.spendBasis = d.spendBasis;
  const w = d.spendWindowMonths.trim() ? Number(d.spendWindowMonths) : null;
  if (w !== before.spendWindowMonths) out.spendWindowMonths = w;
  const t = Number(d.minCountThreshold);
  if (t !== before.minCountThreshold) out.minCountThreshold = t;
  return out;
}

/** Who may open a report: its own permission, or everyone who can open Analytics. */
export function accessText(permissionCode: string | null, permissions: readonly { code: string; label: string }[]): string {
  if (!permissionCode) return "Everyone with Analytics";
  return permissions.find((p) => p.code === permissionCode)?.label ?? permissionCode;
}
