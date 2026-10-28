// Date-picker logic: typing, parsing, ranges, month moves and the calendar grid. node --test (no extra framework).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addDays, addMonths, clampDay, formatDmy, inRange, maskDmy, monthGrid, parseDmy, parseIso, todayLocal, weekdayOf, yearSpan } from "../src/lib/date-picker.ts";

describe("typing", () => {
  it("lays digits out as dd/mm/yyyy while typing, with no trailing slash", () => {
    assert.equal(maskDmy("1"), "1");
    assert.equal(maskDmy("15"), "15");
    assert.equal(maskDmy("150"), "15/0");
    assert.equal(maskDmy("1508"), "15/08");
    assert.equal(maskDmy("15081"), "15/08/1");
    assert.equal(maskDmy("15081990"), "15/08/1990");
  });

  it("ignores letters, extra digits and slashes the person typed themselves", () => {
    assert.equal(maskDmy("15/08/1990123"), "15/08/1990");
    assert.equal(maskDmy("1a5-0.8"), "15/08");
    assert.equal(maskDmy("15/"), "15");
  });

  it("pasting a plain number works", () => {
    assert.equal(maskDmy("15081990"), "15/08/1990");
  });
});

describe("parseDmy", () => {
  it("gives the ISO day for a complete real date", () => {
    assert.equal(parseDmy("15/08/1990"), "1990-08-15");
    assert.equal(parseDmy("01/01/2000"), "2000-01-01");
  });

  it("is null while incomplete", () => {
    for (const t of ["", "1", "15/08", "15/08/19", "15/08/199"]) assert.equal(parseDmy(t), null, t);
  });

  it("is null for days that do not exist", () => {
    for (const t of ["31/02/2026", "00/01/2026", "32/01/2026", "15/13/2026", "15/00/2026", "29/02/2025"]) assert.equal(parseDmy(t), null, t);
  });

  it("knows leap days", () => {
    assert.equal(parseDmy("29/02/2024"), "2024-02-29");
    assert.equal(parseDmy("29/02/1900"), null);
    assert.equal(parseDmy("29/02/2000"), "2000-02-29");
  });

  it("rejects a year typed with leading zeros", () => {
    assert.equal(parseDmy("15/08/0020"), null);
  });
});

describe("parseIso / formatDmy", () => {
  it("round-trips", () => {
    assert.equal(formatDmy("1990-08-15"), "15/08/1990");
    assert.equal(parseDmy(formatDmy("2026-10-26")), "2026-10-26");
  });

  it("rejects other shapes and impossible days", () => {
    for (const s of ["", "2026-1-5", "26/10/2026", "2026-02-30", "2026-13-01", "not a date"]) assert.equal(parseIso(s), null, s);
    assert.equal(formatDmy("nope"), "");
  });
});

describe("ranges", () => {
  it("includes both ends and treats a missing end as open", () => {
    assert.ok(inRange("2026-10-26", "2026-10-26", "2026-10-26"));
    assert.ok(!inRange("2026-10-27", undefined, "2026-10-26"));
    assert.ok(!inRange("2026-10-25", "2026-10-26"));
    assert.ok(inRange("1850-01-01"));
  });

  it("clamps to the nearest allowed day", () => {
    assert.equal(clampDay("2030-01-01", "2000-01-01", "2026-10-26"), "2026-10-26");
    assert.equal(clampDay("1990-01-01", "2000-01-01", "2026-10-26"), "2000-01-01");
    assert.equal(clampDay("2010-05-05", "2000-01-01", "2026-10-26"), "2010-05-05");
  });
});

describe("moving", () => {
  it("adds days across months and years", () => {
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(addDays("2026-03-01", -1), "2026-02-28");
    assert.equal(addDays("2024-03-01", -1), "2024-02-29");
    assert.equal(addDays("2026-10-26", 7), "2026-11-02");
  });

  it("adds months and keeps the day where the month has it", () => {
    assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
    assert.equal(addMonths("2024-01-31", 1), "2024-02-29");
    assert.equal(addMonths("2026-10-26", 3), "2027-01-26");
    assert.equal(addMonths("2026-01-15", -1), "2025-12-15");
    assert.equal(addMonths("2026-10-26", 12), "2027-10-26");
    assert.equal(addMonths("2026-10-26", -120), "2016-10-26");
  });
});

describe("monthGrid", () => {
  it("is always six rows of seven, Sunday first", () => {
    for (const [y, m] of [[2026, 2], [2026, 10], [2024, 2], [2021, 2], [2026, 11]] as const) {
      const g = monthGrid(y, m);
      assert.equal(g.length, 6);
      for (const row of g) assert.equal(row.length, 7);
    }
  });

  it("October 2026 starts on a Thursday, as in the screenshot (27 28 29 30 1 …)", () => {
    const g = monthGrid(2026, 10);
    assert.deepEqual(g[0]!.map((c) => c.iso.slice(8)), ["27", "28", "29", "30", "01", "02", "03"]);
    assert.deepEqual(g[0]!.map((c) => c.inMonth), [false, false, false, false, true, true, true]);
    assert.equal(g[5]![6]!.iso, "2026-11-07");
  });

  it("contains every day of the month exactly once", () => {
    const days = monthGrid(2024, 2).flat().filter((c) => c.inMonth).map((c) => c.iso);
    assert.equal(days.length, 29);
    assert.equal(new Set(days).size, 29);
  });
});

describe("yearSpan", () => {
  it("uses the range when there is one", () => {
    assert.deepEqual(yearSpan(2026, "2000-01-01", "2026-10-26"), { from: 2000, to: 2026 });
  });

  it("looks back a long way for a past-only field such as a date of birth", () => {
    assert.deepEqual(yearSpan(2026, undefined, "2026-10-26"), { from: 1906, to: 2026 });
  });

  it("looks ahead for a future-only field", () => {
    assert.deepEqual(yearSpan(2026, "2026-10-26"), { from: 2026, to: 2046 });
  });

  it("is wide both ways with no limits", () => {
    assert.deepEqual(yearSpan(2026), { from: 1906, to: 2046 });
  });
});

describe("weekdayOf", () => {
  it("0 is Sunday", () => {
    assert.equal(weekdayOf("2026-10-25"), 0);
    assert.equal(weekdayOf("2026-10-26"), 1);
    assert.equal(weekdayOf("2026-10-31"), 6);
    assert.equal(weekdayOf("2000-01-01"), 6);
  });
});

describe("todayLocal", () => {
  it("is a real YYYY-MM-DD day", () => {
    assert.ok(parseIso(todayLocal()));
    assert.equal(todayLocal(new Date(2026, 9, 26, 23, 59)), "2026-10-26");
  });
});
