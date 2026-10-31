// How imports are worded and measured on screen. node --test (no extra framework).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ImportStatus } from "../src/lib/api.ts";
import { hasRun, importError, IMPORT_STATUS, plural, runProgress, sheetFileProblem, summaryLine, timeLeft } from "../src/lib/imports.ts";

const counts = (over: Partial<Record<"total" | "ready" | "errors" | "existing" | "created" | "skipped" | "failed", number>> = {}) => ({
  total: 0, ready: 0, errors: 0, existing: 0, created: 0, skipped: 0, failed: 0, ...over,
});

describe("status", () => {
  it("has words for every status the API can send", () => {
    const all: ImportStatus[] = ["UPLOADING", "NEEDS_FIX", "READY", "IMPORTING", "COMPLETED", "COMPLETED_WITH_ISSUES", "FAILED"];
    for (const s of all) assert.ok(IMPORT_STATUS[s].label.length > 3, s);
    assert.deepEqual(Object.keys(IMPORT_STATUS).sort(), [...all].sort());
  });

  it("never leaves a problem looking like a success", () => {
    assert.equal(IMPORT_STATUS.COMPLETED.tone, "ok");
    assert.notEqual(IMPORT_STATUS.COMPLETED_WITH_ISSUES.tone, "ok");
    assert.equal(IMPORT_STATUS.FAILED.tone, "bad");
  });
});

describe("plural", () => {
  it("counts in the Indian style and agrees the noun", () => {
    assert.equal(plural(1, "row"), "1 row");
    assert.equal(plural(0, "patient"), "0 patients");
    assert.equal(plural(1200, "row"), "1,200 rows");
    assert.equal(plural(2, "match", "matches"), "2 matches");
  });
});

describe("runProgress", () => {
  it("is the share of the rows set out for that have been dealt with", () => {
    assert.equal(runProgress(counts({ ready: 10 })), 0);
    assert.equal(runProgress(counts({ ready: 10, created: 3, skipped: 1, failed: 1 })), 0.5);
    assert.equal(runProgress(counts({ ready: 10, created: 10 })), 1);
  });

  it("never passes 1 or divides by nothing", () => {
    assert.equal(runProgress(counts()), 0);
    assert.equal(runProgress(counts({ ready: 2, created: 5 })), 1);
  });
});

describe("summaryLine", () => {
  const line = (status: ImportStatus, c: ReturnType<typeof counts>, sheet = true) => summaryLine({ status, counts: c, sheet: sheet ? { name: "a.xlsx", sizeBytes: 1, uploadedAt: null, revision: 1 } : null, sheetDeleted: false });

  it("says what is waiting", () => {
    assert.equal(line("READY", counts({ total: 5, ready: 4, errors: 1 })), "4 patients ready to import, 1 row to fix.");
    assert.equal(line("READY", counts({ total: 1, ready: 1 })), "1 patient ready to import.");
    assert.equal(line("NEEDS_FIX", counts({ total: 3, errors: 3 })), "3 rows to fix in 3 rows.");
    assert.equal(line("NEEDS_FIX", counts(), false), "No sheet yet.");
  });

  it("says what was done", () => {
    assert.equal(line("COMPLETED", counts({ total: 5, created: 4, skipped: 1 })), "4 patients added, 1 left out.");
    assert.equal(line("COMPLETED_WITH_ISSUES", counts({ total: 6, created: 3, skipped: 1, failed: 1, errors: 1 })), "3 patients added, 1 left out, 2 to fix.");
    assert.equal(line("COMPLETED", counts({ total: 1, created: 1 })), "1 patient added.");
  });
});

describe("importError", () => {
  it("prefers the API's own explanation", () => {
    assert.equal(importError("SHEET_REJECTED", "The sheet is missing the column: Mobile."), "The sheet is missing the column: Mobile.");
  });

  it("falls back to a plain sentence for a known code, and a safe one for an unknown code", () => {
    assert.match(importError("NETWORK"), /offline/);
    assert.match(importError("ANOTHER_RUNNING"), /Another import/);
    assert.equal(importError("WHO_KNOWS"), "Something went wrong. Please try again.");
  });
});

describe("sheetFileProblem", () => {
  const MB = 1024 * 1024;
  it("lets a normal sheet through, however the extension is cased", () => {
    assert.equal(sheetFileProblem({ name: "patients.xlsx", size: 2 * MB }), null);
    assert.equal(sheetFileProblem({ name: "PATIENTS.XLSX", size: 10 }), null);
  });

  it("explains what is wrong with anything else", () => {
    assert.match(sheetFileProblem({ name: "patients.csv", size: 10 })!, /Only Excel/);
    assert.match(sheetFileProblem({ name: "old.xls", size: 10 })!, /Save As/);
    assert.match(sheetFileProblem({ name: "a.xlsx", size: 0 })!, /empty/);
    assert.equal(sheetFileProblem({ name: "big.xlsx", size: 600 * MB }), null); // no size limit
  });
});

describe("timeLeft", () => {
  const now = Date.parse("2026-10-26T10:00:00Z");
  const at = (ms: number) => new Date(now + ms).toISOString();
  it("says how long a rollback window has left", () => {
    assert.equal(timeLeft(at(23 * 3600e3 + 12 * 60e3), now), "23 h 12 min");
    assert.equal(timeLeft(at(45 * 60e3), now), "45 min");
    assert.equal(timeLeft(at(20e3), now), "less than a minute");
  });
  it("says none once it is over", () => {
    assert.equal(timeLeft(at(0), now), "none");
    assert.equal(timeLeft(at(-5 * 60e3), now), "none");
  });
});

describe("an import whose run was rolled back", () => {
  it("shows its check again, not the result of the run that was undone", () => {
    assert.equal(hasRun({ status: "READY", startedAt: "2026-10-26T08:00:00Z" }), false);
    assert.equal(hasRun({ status: "NEEDS_FIX", startedAt: "2026-10-26T08:00:00Z" }), false);
    assert.equal(hasRun({ status: "COMPLETED", startedAt: "2026-10-26T08:00:00Z" }), true);
    assert.equal(hasRun({ status: "IMPORTING", startedAt: "2026-10-26T08:00:00Z" }), true);
    assert.equal(hasRun({ status: "READY", startedAt: null }), false);
  });
});

describe("while the worker is busy", () => {
  it("says what it is doing, not the status underneath", () => {
    const sheet = { status: "UPLOADING" as ImportStatus, counts: counts(), sheet: null, sheetDeleted: false };
    assert.equal(summaryLine({ ...sheet, working: "CHECK" }), "Checking every row of the sheet…");
    assert.equal(summaryLine({ ...sheet, working: "ROLLBACK" }), "Rolling a run back…");
    assert.equal(summaryLine({ ...sheet, working: null }), "Waiting for the sheet to finish uploading.");
  });
});
