// Report admin rules: reordering, what a setup saves, spend band gaps and overlaps, and the settings form. node --test (no extra framework).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  accessText,
  bandIssues,
  bandOverlaps,
  bandProblem,
  bandRange,
  changesOf,
  draftOf,
  monthName,
  moveItem,
  parseAmount,
  reportAdminError,
  reportTextProblem,
  settingsChanges,
  settingsDraftOf,
  settingsProblem,
  setupBody,
  setupChanged,
  sortedBands,
  toggleShown,
  wholeNumber,
  type AdminReport,
  type ReportSettings,
  type SetupFilter,
  type SetupMetric,
  type SpendBand,
} from "../src/lib/report-admin.ts";
import { formatRupees } from "../src/lib/reports.ts";

const band = (id: number, min: number, max: number | null, status: "ACTIVE" | "DEACTIVATED" = "ACTIVE"): SpendBand => ({
  id,
  code: `b${id}`,
  label: `Band ${id}`,
  minAmount: min,
  maxAmount: max,
  sortOrder: id,
  status,
});

describe("moveItem", () => {
  it("moves an item up or down by one place", () => {
    assert.deepEqual(moveItem(["a", "b", "c"], 1, -1), ["b", "a", "c"]);
    assert.deepEqual(moveItem(["a", "b", "c"], 1, 1), ["a", "c", "b"]);
  });
  it("leaves the list as it is at either end, and never changes the original", () => {
    const list = ["a", "b", "c"];
    assert.deepEqual(moveItem(list, 0, -1), ["a", "b", "c"]);
    assert.deepEqual(moveItem(list, 2, 1), ["a", "b", "c"]);
    assert.deepEqual(moveItem(list, 9, 1), ["a", "b", "c"]);
    assert.notEqual(moveItem(list, 0, -1), list);
    assert.deepEqual(list, ["a", "b", "c"]);
  });
});

describe("report setup", () => {
  const metric = (code: string, shown: boolean, isKpi = false, labelOverride: string | null = null): SetupMetric => ({ code, label: code, format: "number", definition: "", shown, isKpi, labelOverride });
  const filter = (column: string, editable = true, def: string | null = null): SetupFilter => ({ column, label: column, isUserEditable: editable, defaultValue: def });

  it("saves only the shown metrics, in list order", () => {
    const body = setupBody([metric("a", true, true), metric("b", false), metric("c", true)], []);
    assert.deepEqual(body.metrics, [
      { code: "a", isKpi: true, labelOverride: null },
      { code: "c", isKpi: false, labelOverride: null },
    ]);
  });
  it("turns a blank label or default into none, and trims the rest", () => {
    const body = setupBody([metric("a", true, false, "   ")], [filter("x", false, " "), filter("y", true, " A, B ")]);
    assert.equal(body.metrics[0]!.labelOverride, null);
    assert.deepEqual(body.filters, [
      { column: "x", isUserEditable: false, defaultValue: null },
      { column: "y", isUserEditable: true, defaultValue: "A, B" },
    ]);
  });
  it("tells whether anything changed", () => {
    const a = setupBody([metric("a", true), metric("b", true)], [filter("x")]);
    assert.equal(setupChanged(a, setupBody([metric("a", true), metric("b", true)], [filter("x")])), false);
    assert.equal(setupChanged(a, setupBody([metric("b", true), metric("a", true)], [filter("x")])), true);
    assert.equal(setupChanged(a, setupBody([metric("a", true), metric("b", true)], [filter("x", false)])), true);
  });
  it("takes a number out of the headline row when it is turned off", () => {
    assert.deepEqual(toggleShown(metric("a", true, true), false), { ...metric("a", false, false) });
    assert.equal(toggleShown(metric("a", false, false), true).isKpi, false);
  });
});

describe("editing a report", () => {
  const report: AdminReport = {
    code: "r",
    label: "Source-wise revenue",
    question: "Which sources?",
    domain: { code: "acquisition", label: "Acquisition" },
    dataset: { code: "bill_lines", label: "Bill lines" },
    defaultPeriod: { code: "fy_to_date", label: "Financial year to date" },
    canHavePeriod: true,
    permissionCode: null,
    status: "ACTIVE",
    sortOrder: 10,
    isSystem: true,
    clonedFrom: null,
    metricCount: 6,
  };
  it("sends only what changed", () => {
    const before = draftOf(report);
    assert.deepEqual(changesOf(before, before), {});
    assert.deepEqual(changesOf(before, { ...before, label: "New name", defaultPeriod: null }), { label: "New name", defaultPeriod: null });
  });
  it("checks the name and question lengths", () => {
    assert.equal(reportTextProblem("Ok", "Why?"), null);
    assert.match(reportTextProblem("A", "Why?")!, /name/);
    assert.match(reportTextProblem("Ok", " ")!, /question/);
    assert.match(reportTextProblem("x".repeat(101), "Why?")!, /name/);
    assert.match(reportTextProblem("Ok", "q".repeat(301))!, /question/);
  });
  it("reads whole numbers", () => {
    assert.equal(wholeNumber(" 20 "), 20);
    assert.equal(wholeNumber("2.5"), null);
    assert.equal(wholeNumber(""), null);
    assert.equal(wholeNumber("1e3"), null);
  });
  it("says who can open a report", () => {
    const perms = [{ code: "reports.manage", label: "Change reports" }];
    assert.equal(accessText(null, perms), "Everyone with Analytics");
    assert.equal(accessText("reports.manage", perms), "Change reports");
    assert.equal(accessText("other.thing", perms), "other.thing");
  });
});

describe("spend bands", () => {
  it("reads amounts the way people write them", () => {
    assert.equal(parseAmount("10,000"), 10000);
    assert.equal(parseAmount("₹ 2500.50"), 2500.5);
    assert.equal(parseAmount("0"), 0);
    assert.equal(parseAmount(""), null);
    assert.equal(parseAmount("-5"), null);
    assert.equal(parseAmount("12.345"), null);
    assert.equal(parseAmount("ten"), null);
  });
  it("sorts bands by their lowest amount", () => {
    assert.deepEqual(sortedBands([band(1, 5000, null), band(2, 0, 5000)]).map((b) => b.id), [2, 1]);
  });
  it("describes a range, the top one having no limit", () => {
    assert.equal(bandRange(band(1, 0, 10000), formatRupees), "₹0 to ₹10,000");
    assert.equal(bandRange(band(2, 5000000, null), formatRupees), "₹50,00,000 and above");
  });

  describe("gaps", () => {
    it("warns when there are no bands, or only deactivated ones", () => {
      assert.match(bandIssues([], formatRupees)[0]!, /Until bands exist.*No band set/);
      assert.equal(bandIssues([band(1, 0, null, "DEACTIVATED")], formatRupees).length, 1);
    });
    it("has no warning when bands run from zero to no upper limit with no gap", () => {
      assert.deepEqual(bandIssues([band(1, 0, 10000), band(2, 10000, 50000), band(3, 50000, null)], formatRupees), []);
    });
    it("finds a gap at the bottom, in the middle and at the top", () => {
      assert.match(bandIssues([band(1, 1000, null)], formatRupees)[0]!, /under ₹1,000/);
      const mid = bandIssues([band(1, 0, 10000), band(2, 20000, null)], formatRupees);
      assert.equal(mid.length, 1);
      assert.match(mid[0]!, /₹10,000 up to ₹20,000/);
      assert.match(bandIssues([band(1, 0, 10000)], formatRupees)[0]!, /₹10,000 and above/);
    });
    it("ignores deactivated bands when looking for gaps", () => {
      assert.deepEqual(bandIssues([band(1, 0, 10000), band(2, 10000, 50000, "DEACTIVATED"), band(3, 10000, null)], formatRupees), []);
    });
    it("finds an overlap and a band with no upper limit below another", () => {
      assert.match(bandIssues([band(1, 0, 20000), band(2, 10000, null)], formatRupees).join(" "), /overlap/);
      assert.match(bandIssues([band(1, 0, null), band(2, 10000, null)], formatRupees).join(" "), /no upper limit/);
    });
  });

  describe("overlaps", () => {
    const bands = [band(1, 0, 10000), band(2, 10000, 50000)];
    it("treats the lower amount as inside and the upper as outside", () => {
      assert.equal(bandOverlaps(bands, 50000, null), false);
      assert.equal(bandOverlaps(bands, 49999, null), true);
      assert.equal(bandOverlaps(bands, 0, 10000), true);
    });
    it("lets a band keep its own range, and ignores deactivated bands", () => {
      assert.equal(bandOverlaps(bands, 0, 10000, 1), false);
      assert.equal(bandOverlaps([band(1, 0, 10000, "DEACTIVATED")], 0, 10000), false);
    });
  });

  describe("the add and edit form", () => {
    const bands = [band(1, 0, 10000)];
    it("accepts a clear range", () => assert.equal(bandProblem("10,000", "50,000", bands), null));
    it("accepts no upper limit", () => assert.equal(bandProblem("10000", "", bands), null));
    it("rejects what is not a number, or a range backwards", () => {
      assert.match(bandProblem("abc", "", bands)!, /lowest amount/);
      assert.match(bandProblem("10000", "abc", bands)!, /upper amount/);
      assert.match(bandProblem("10000", "10000", bands)!, /higher/);
      assert.match(bandProblem("10000", "5000", bands)!, /higher/);
    });
    it("rejects an overlap with another active band only", () => {
      assert.match(bandProblem("5000", "20000", bands)!, /overlaps/);
      assert.equal(bandProblem("5000", "20000", bands, 1), null);
      assert.equal(bandProblem("5000", "20000", bands, undefined, false), null);
    });
  });
});

describe("settings", () => {
  const settings: ReportSettings = { fiscalYearStartMonth: 4, spendBasis: "NET", spendScope: "PATIENT", spendWindowMonths: null, minCountThreshold: 5 };
  it("starts the form from what is saved", () => {
    assert.deepEqual(settingsDraftOf(settings), { fiscalYearStartMonth: "4", spendBasis: "NET", spendWindowMonths: "", minCountThreshold: "5" });
  });
  it("sends only what changed", () => {
    const d = settingsDraftOf(settings);
    assert.deepEqual(settingsChanges(settings, d), {});
    assert.deepEqual(settingsChanges(settings, { ...d, fiscalYearStartMonth: "1", spendWindowMonths: "12" }), { fiscalYearStartMonth: 1, spendWindowMonths: 12 });
    assert.deepEqual(settingsChanges({ ...settings, spendWindowMonths: 6 }, { ...d, spendWindowMonths: "" }), { spendWindowMonths: null });
    assert.deepEqual(settingsChanges(settings, { ...d, spendBasis: "PATIENT_PAYABLE" }), { spendBasis: "PATIENT_PAYABLE" });
  });
  it("checks the window and the smallest group", () => {
    const d = settingsDraftOf(settings);
    assert.equal(settingsProblem(d), null);
    assert.equal(settingsProblem({ ...d, spendWindowMonths: "12" }), null);
    assert.match(settingsProblem({ ...d, spendWindowMonths: "0" })!, /window/);
    assert.match(settingsProblem({ ...d, spendWindowMonths: "x" })!, /window/);
    assert.match(settingsProblem({ ...d, minCountThreshold: "0" })!, /smallest group/);
    assert.match(settingsProblem({ ...d, minCountThreshold: "51" })!, /smallest group/);
    assert.equal(settingsProblem({ ...d, minCountThreshold: "1" }), null);
  });
  it("names the months", () => {
    assert.equal(monthName(4), "April");
    assert.equal(monthName(1), "January");
  });
});

describe("error wording", () => {
  it("has a plain sentence for each known code and a fallback for the rest", () => {
    for (const code of ["NETWORK", "FORBIDDEN", "NOT_FOUND", "VALIDATION", "NO_PERIOD_COLUMN", "SYSTEM_REPORT", "NEEDS_A_METRIC", "OVERLAP", "BAD_RANGE"]) {
      assert.ok(reportAdminError(code).length > 10, code);
    }
    assert.match(reportAdminError("SOMETHING_NEW"), /Try again/);
  });
});
