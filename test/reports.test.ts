// How reports are written and kept in the page address, and the chart colours. node --test (no extra framework).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { contrast, parseHex } from "../src/lib/color.ts";
import {
  barRows,
  columnRows,
  customRangeProblem,
  EMPTY_VIEW,
  formatDay,
  formatDimension,
  formatMonth,
  formatNumber,
  formatPercent,
  formatRupees,
  formatRupeesCompact,
  formatValue,
  indianGrouping,
  isEmptyResult,
  isMutedLabel,
  parseView,
  pivotStacked,
  runBody,
  sortRows,
  writeView,
  type ReportRow,
} from "../src/lib/reports.ts";

const row = (dims: Record<string, string>, values: Record<string, number | null>): ReportRow => ({ dims, values });

describe("rupees", () => {
  it("groups the Indian way", () => {
    assert.equal(indianGrouping("1234567"), "12,34,567");
    assert.equal(indianGrouping("123"), "123");
    assert.equal(indianGrouping("1234"), "1,234");
    assert.equal(indianGrouping("100000"), "1,00,000");
    assert.equal(indianGrouping("123456789"), "12,34,56,789");
  });
  it("writes whole rupees", () => {
    assert.equal(formatRupees(1234567), "₹12,34,567");
    assert.equal(formatRupees(0), "₹0");
    assert.equal(formatRupees(999.6), "₹1,000");
    assert.equal(formatRupees(-45000), "-₹45,000");
    assert.equal(formatRupees(-0.2), "₹0");
  });
  it("shortens to lakh and crore on tiles", () => {
    assert.equal(formatRupeesCompact(1234567), "₹12.3 L");
    assert.equal(formatRupeesCompact(12345678), "₹1.2 Cr");
    assert.equal(formatRupeesCompact(100000), "₹1 L");
    assert.equal(formatRupeesCompact(99999), "₹99,999");
    assert.equal(formatRupeesCompact(2500000000), "₹250 Cr");
    assert.equal(formatRupeesCompact(-250000), "-₹2.5 L");
  });
});

describe("numbers and percentages", () => {
  it("groups counts", () => assert.equal(formatNumber(1234567), "12,34,567"));
  it("shows at most one decimal and no trailing zero", () => {
    assert.equal(formatPercent(0.1234), "12.3%");
    assert.equal(formatPercent(1), "100%");
    assert.equal(formatPercent(0.5), "50%");
    assert.equal(formatPercent(0), "0%");
  });
  it("writes a missing value as a dash, never a zero", () => {
    assert.equal(formatValue("rupees", null), "—");
    assert.equal(formatValue("number", undefined), "—");
    assert.equal(formatValue("number", 0), "0");
  });
  it("follows the format", () => {
    assert.equal(formatValue("rupees", 123456, true), "₹1.2 L");
    assert.equal(formatValue("rupees", 123456), "₹1,23,456");
    assert.equal(formatValue("percent", 0.25), "25%");
    assert.equal(formatValue("month", "2026-04-01"), "Apr 2026");
    assert.equal(formatValue("text", "Meta ads"), "Meta ads");
  });
});

describe("dates", () => {
  it("writes days as dd-MMM-yyyy", () => {
    assert.equal(formatDay("2026-09-05"), "05-Sep-2026");
    assert.equal(formatDay("2026-12-31"), "31-Dec-2026");
  });
  it("writes months as MMM yyyy", () => assert.equal(formatMonth("2026-04-01"), "Apr 2026"));
  it("leaves anything else alone", () => {
    assert.equal(formatDay("soon"), "soon");
    assert.equal(formatDimension("Meta ads"), "Meta ads");
  });
  it("shows a month start as a month and another day as a date", () => {
    assert.equal(formatDimension("2026-04-01"), "Apr 2026");
    assert.equal(formatDimension("2026-04-15"), "15-Apr-2026");
  });
  it("checks a custom range", () => {
    assert.equal(customRangeProblem("2026-04-01", "2026-04-30"), null);
    assert.equal(customRangeProblem("2026-04-01", "2026-04-01"), null);
    assert.match(customRangeProblem("", "2026-04-30")!, /both/);
    assert.match(customRangeProblem("2026-05-01", "2026-04-30")!, /before/);
  });
});

describe("rows that say what could not be placed", () => {
  it("knows them", () => {
    for (const l of ["Unknown source", "Not matched to a patient", "Other and unknown", "No band set", "Unknown branch"]) assert.ok(isMutedLabel(l), l);
    for (const l of ["Meta ads", "Google Ads calls", "Otherwise", "Unknownville Clinic"]) assert.equal(isMutedLabel(l), false, l);
  });
  it("keeps the top ten named rows and every muted row", () => {
    const names = Array.from({ length: 14 }, (_, i) => row({ s: `Source ${i}` }, { revenue: (i + 1) * 100 }));
    const rows = [...names, row({ s: "Unknown source" }, { revenue: 5 }), row({ s: "Not matched to a patient" }, { revenue: 1 })];
    const bars = barRows(rows, "s", "revenue");
    assert.equal(bars.length, 12);
    assert.equal(bars[0]!.label, "Source 13");
    assert.equal(bars[9]!.label, "Source 4");
    assert.deepEqual(bars.slice(10).map((b) => [b.label, b.muted]), [["Unknown source", true], ["Not matched to a patient", true]]);
    assert.ok(bars.slice(0, 10).every((b) => !b.muted));
  });
  it("leaves a row with no value out of a chart", () => {
    assert.deepEqual(barRows([row({ s: "A" }, { m: null }), row({ s: "B" }, { m: 2 })], "s", "m").map((b) => b.label), ["B"]);
  });
  it("keeps the order the report gave for columns", () => {
    const rows = [row({ b: "Up to 10k" }, { p: 1 }), row({ b: "10k to 50k" }, { p: 9 }), row({ b: "No band set" }, { p: 3 })];
    assert.deepEqual(columnRows(rows, "b", "p").map((b) => b.label), ["Up to 10k", "10k to 50k", "No band set"]);
  });
});

describe("stacked columns", () => {
  const rows = [
    row({ s: "A", m: "2026-04-01" }, { r: 10 }),
    row({ s: "A", m: "2026-05-01" }, { r: 20 }),
    row({ s: "B", m: "2026-05-01" }, { r: 5 }),
    row({ s: "Unknown source", m: "2026-04-01" }, { r: 2 }),
  ];
  it("pivots to months and series, with unknown folded into a muted series", () => {
    const p = pivotStacked(rows, "s", "m", "r");
    assert.deepEqual(p.xs, ["2026-04-01", "2026-05-01"]);
    assert.deepEqual(p.series.map((s) => [s.label, s.values, s.muted]), [
      ["A", [10, 20], false],
      ["B", [0, 5], false],
      ["Other and unknown", [2, 0], true],
    ]);
  });
  it("folds series beyond the limit and the columns still add up", () => {
    const many = Array.from({ length: 9 }, (_, i) => row({ s: `S${i}`, m: "2026-04-01" }, { r: i + 1 }));
    const p = pivotStacked(many, "s", "m", "r", 3);
    assert.equal(p.series.length, 4);
    assert.equal(p.series.at(-1)!.muted, true);
    assert.equal(p.series.reduce((sum, s) => sum + s.values[0]!, 0), 45);
  });
});

describe("sorting", () => {
  const rows = [row({ s: "b" }, { m: 2 }), row({ s: "a" }, { m: null }), row({ s: "c" }, { m: 9 })];
  it("sorts a measure and puts missing values last either way", () => {
    assert.deepEqual(sortRows(rows, "m", "metric", "desc").map((r) => r.dims.s), ["c", "b", "a"]);
    assert.deepEqual(sortRows(rows, "m", "metric", "asc").map((r) => r.dims.s), ["b", "c", "a"]);
  });
  it("sorts a dimension as text, numbers in order", () => {
    assert.deepEqual(sortRows(rows, "s", "dim", "asc").map((r) => r.dims.s), ["a", "b", "c"]);
    assert.deepEqual(sortRows([row({ s: "10" }, {}), row({ s: "9" }, {})], "s", "dim", "asc").map((r) => r.dims.s), ["9", "10"]);
  });
  it("does not change the rows it was given", () => {
    const copy = [...rows];
    sortRows(rows, "m", "metric", "desc");
    assert.deepEqual(rows, copy);
  });
});

describe("empty results", () => {
  it("is empty with no rows, or with nothing in the totals", () => {
    assert.ok(isEmptyResult({ rows: [], totals: { r: 5 } }));
    assert.ok(isEmptyResult({ rows: [row({}, {})], totals: { r: 0, p: null } }));
    assert.equal(isEmptyResult({ rows: [row({}, {})], totals: { r: 5 } }), false);
  });
});

describe("the view in the page address", () => {
  const view = { period: "last_month", from: "", to: "", breakdown: "month", filters: { lead_source: ["Meta ads", "Practo, Inc"], department: ["OPD"] } };
  it("round-trips, commas and all", () => {
    const written = writeView(new URLSearchParams("code=source_wise_revenue"), view);
    assert.equal(written.get("code"), "source_wise_revenue");
    assert.deepEqual(parseView(new URLSearchParams(written.toString())), view);
  });
  it("keeps a custom range only for custom", () => {
    assert.equal(writeView(new URLSearchParams(), { ...view, period: "custom", from: "2026-04-01", to: "2026-04-30" }).get("from"), "2026-04-01");
    assert.equal(writeView(new URLSearchParams(), { ...view, period: "last_month", from: "2026-04-01", to: "2026-04-30" }).has("from"), false);
  });
  it("drops what an older address had", () => {
    const next = writeView(new URLSearchParams("code=x&breakdown=month&f.department=OPD&period=custom"), EMPTY_VIEW);
    assert.equal(next.toString(), "code=x");
  });
  it("reads an empty address as the default view", () => assert.deepEqual(parseView(new URLSearchParams("code=x")), EMPTY_VIEW));
  it("builds the request", () => {
    assert.deepEqual(runBody(view, true), {
      period: "last_month",
      filters: [{ column: "lead_source", values: ["Meta ads", "Practo, Inc"] }, { column: "department", values: ["OPD"] }],
      breakdown: "month",
    });
    assert.deepEqual(runBody({ ...EMPTY_VIEW, period: "custom", from: "2026-04-01", to: "2026-04-30" }, true), { period: { from: "2026-04-01", to: "2026-04-30" } });
    assert.deepEqual(runBody({ ...EMPTY_VIEW, period: "custom", from: "2026-04-01" }, true), {});
    assert.deepEqual(runBody(view, false).period, undefined);
  });
});

describe("chart colours", () => {
  const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
  const dark = css.indexOf('[data-theme="dark"] {');
  const light = css.slice(0, dark);
  const night = css.slice(dark);
  const tokens = (block: string, name: string) => block.match(new RegExp(`--color-${name}:\\s*(#[0-9A-Fa-f]{6})`))![1]!;
  const names = ["chart-blue", "chart-orange", "chart-green", "chart-pink", "chart-brown", "chart-grey", "chart-violet", "chart-muted"];

  it("reads at 3:1 or better on the surface in both themes", () => {
    for (const [block, name] of [[light, "light"], [night, "dark"]] as const) {
      const surface = parseHex(tokens(block, "surface"))!;
      for (const n of names) assert.ok(contrast(parseHex(tokens(block, n))!, surface) >= 3, `${n} on ${name}`);
    }
  });
  it("has no two series the same colour", () => {
    for (const block of [light, night]) assert.equal(new Set(names.map((n) => tokens(block, n).toLowerCase())).size, names.length);
  });
});
