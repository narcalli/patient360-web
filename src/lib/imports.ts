// How imports are described on screen: a status says itself in words (the colour and icon only support it), and the
// counts are worded for the person looking at them. Pure, so it is tested without a browser.
import type { ImportStatus, ImportView } from "./api";

export type Tone = "ok" | "warn" | "bad" | "info" | "neutral";

export const IMPORT_STATUS: Record<ImportStatus, { label: string; tone: Tone }> = {
  UPLOADING: { label: "Uploading", tone: "warn" },
  NEEDS_FIX: { label: "Needs fixing", tone: "warn" },
  READY: { label: "Ready to import", tone: "info" },
  IMPORTING: { label: "Importing", tone: "warn" },
  COMPLETED: { label: "Completed", tone: "ok" },
  COMPLETED_WITH_ISSUES: { label: "Completed with issues", tone: "warn" },
  FAILED: { label: "Failed", tone: "bad" },
};

export const ISSUE_KIND = {
  ERROR: { label: "Fix needed", help: "This row can't be imported until the sheet is fixed." },
  SKIPPED: { label: "Left out", help: "This row was left out on purpose, so nobody is added twice." },
} as const;

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;

/** How long a rollback window has left, in words: "23 h 12 min", "45 min". "none" once it is over. */
export function timeLeft(untilIso: string, now = Date.now()): string {
  const mins = Math.floor((Date.parse(untilIso) - now) / 60_000);
  if (Number.isNaN(mins) || Date.parse(untilIso) <= now) return "none";
  if (mins < 1) return "less than a minute";
  return mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`;
}

/**
 * The import has run (or is running) and its result stands, so its numbers are what was done rather than what the check
 * expects. An import whose run was rolled back is ready (or needs a sheet) again, so it shows the check again.
 */
export const hasRun = (i: Pick<ImportView, "startedAt" | "status">) => i.startedAt !== null && !["UPLOADING", "NEEDS_FIX", "READY"].includes(i.status);

/** How far a running import is, 0 to 1: the rows it has dealt with out of those it set out to. */
export function runProgress(c: ImportView["counts"]): number {
  const todo = c.created + c.skipped + c.failed;
  const all = Math.max(c.ready, todo);
  return all === 0 ? 0 : Math.min(1, todo / all);
}

/** One line for the list: what this import holds or did. */
export function summaryLine(i: Pick<ImportView, "status" | "counts" | "sheet" | "sheetDeleted">): string {
  const c = i.counts;
  switch (i.status) {
    case "UPLOADING":
      return "Waiting for the sheet to finish uploading.";
    case "NEEDS_FIX":
      return i.sheet ? `${plural(c.errors, "row")} to fix in ${plural(c.total, "row")}.` : "No sheet yet.";
    case "READY":
      return `${plural(c.ready, "patient")} ready to import${c.errors ? `, ${plural(c.errors, "row")} to fix` : ""}.`;
    case "IMPORTING":
      return `Importing ${plural(c.ready, "patient")}…`;
    case "COMPLETED":
    case "COMPLETED_WITH_ISSUES":
    case "FAILED":
      return `${plural(c.created, "patient")} added${c.skipped ? `, ${c.skipped.toLocaleString("en-IN")} left out` : ""}${c.failed + c.errors ? `, ${(c.failed + c.errors).toLocaleString("en-IN")} to fix` : ""}.`;
  }
}

/** What the API says went wrong, in the words a person needs to act on. */
export function importError(code: string, message?: unknown): string {
  if (typeof message === "string" && message) return message;
  const known: Record<string, string> = {
    NETWORK: "You seem to be offline. Check your connection and try again.",
    NOT_XLSX: "Only Excel (.xlsx) sheets can be imported.",
    NOT_RECEIVED: "The file didn't arrive. Try uploading it again.",
    NOT_RUNNABLE: "This import can't be run right now.",
    ANOTHER_RUNNING: "Another import of this kind is running. Wait for it to finish.",
    CANNOT_REPLACE: "This import's sheet can't be replaced right now.",
    CANNOT_DELETE: "This import can't be deleted.",
    NOT_FOUND: "This import no longer exists.",
    STORAGE_ERROR: "The sheet couldn't be deleted just now. Try again.",
  };
  return known[code] ?? "Something went wrong. Please try again.";
}

/** Checks a chosen file before it is sent, so an obvious mistake doesn't cost an upload. */
export function sheetFileProblem(file: { name: string; size: number }): string | null {
  if (!/\.xlsx$/i.test(file.name)) return "Only Excel (.xlsx) sheets can be imported. In Excel: File, Save As, Excel Workbook.";
  if (file.size === 0) return "That file is empty.";
  return null;
}
