// How patient fields are worded on screen, for someone who has never seen a database. node --test (no extra framework).
import type { CatalogDataType, CatalogField } from "./api";

/** What kind of answer each data type is, as a person would say it. */
export const ANSWER_KIND: Record<string, { label: string; help: string }> = {
  TEXT: { label: "Short text", help: "A few words, like a city or an ID." },
  LONG_TEXT: { label: "Long text", help: "A few sentences, like a note." },
  INTEGER: { label: "Whole number", help: "A number with no decimals, like 3." },
  DECIMAL: { label: "Number with decimals", help: "Like an amount: 1250.50." },
  DATE: { label: "Date", help: "A day on the calendar." },
  BOOLEAN: { label: "Yes or no", help: "Only two possible answers." },
  CHOICE: { label: "Pick from a list", help: "You decide the list of answers." },
  PHONE: { label: "Phone number", help: "Checked to look like a real number." },
  EMAIL: { label: "Email address", help: "Checked to look like a real email." },
};

export const answerKind = (t: Pick<CatalogDataType, "code" | "label">) => ANSWER_KIND[t.code]?.label ?? t.label;

/** Text, choice, and phone and email answers can hold more than one value. */
export const canHoldSeveral = (typeCode: string) => ["TEXT", "LONG_TEXT", "CHOICE", "PHONE", "EMAIL"].includes(typeCode);
export const hasLengthLimit = (typeCode: string) => ["TEXT", "LONG_TEXT", "PHONE", "EMAIL"].includes(typeCode);
export const isNumeric = (typeCode: string) => typeCode === "INTEGER" || typeCode === "DECIMAL";

/** Why a field can't be changed here, or null when it can. */
export function fieldLockNote(f: Pick<CatalogField, "isCore" | "isComputed">): string | null {
  if (f.isCore) return "Part of the patient's main record, so it can't be changed here.";
  if (f.isComputed) return "Worked out automatically by the portal. Nobody types this in.";
  return null;
}

/** One line under a field's name: what kind of answer it takes, and where it comes from. */
export function fieldSummary(f: Pick<CatalogField, "dataType" | "isCore" | "isComputed" | "isMultiValued" | "importColumn" | "helpText">): string {
  const parts = [answerKind(f.dataType) + (f.isMultiValued ? ", more than one allowed" : "")];
  if (f.importColumn) parts.push(`filled from the Excel column "${f.importColumn}"`);
  return parts.join(" · ");
}

/** Matches a field by what people see, ignoring case. */
export function fieldMatches(f: Pick<CatalogField, "label" | "helpText" | "group">, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [f.label, f.helpText ?? "", f.group.label].some((t) => t.toLowerCase().includes(q));
}

/** What a refused change says to the person who tried it. */
export function catalogError(code: string, body: Record<string, unknown> = {}): string {
  const known: Record<string, string> = {
    NETWORK: "You seem to be offline. Check your connection and try again.",
    FIELD_CODE_TAKEN: "Someone just added a field with that name. Try again.",
    GROUP_CODE_TAKEN: "Someone just added a section with that name. Try again.",
    OPTION_TAKEN: "That answer is already on the list.",
    GROUP_HAS_FIELDS: "This section still has fields in it. Move them or stop using them first.",
    GROUP_RETIRED: "That section is no longer in use. Choose another one.",
    GROUP_NOT_FOUND: "That section no longer exists. Choose another one.",
    FIELD_NOT_FOUND: "This field no longer exists.",
    CORE_FIELD_LOCKED: "This is part of the patient's main record, so it can't be changed here.",
    COMPUTED_FIELD_LOCKED: "The portal works this out by itself, so that can't be changed.",
    TYPE_LOCKED: "Some patients already have an answer here, so the kind of answer can't be changed.",
    BAD_LIMITS: "One of the limits doesn't suit this kind of answer. Check \"More settings\".",
  };
  if (code === "FIELD_IN_IMPORT_RULE") return `The Excel column "${String(body.sheetColumn ?? "")}" fills this field, so imports need it. Remove that column in Import rules first.`;
  return known[code] ?? "Something went wrong. Please try again.";
}
