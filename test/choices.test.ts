// When a list of options gets a search box, and what the search finds. node --test.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { groupChoices, matchChoices, needsSearch, type Choice } from "../src/lib/choices.ts";

const FIELDS: Choice[] = [
  ["title", "Title", "Basic details"],
  ["city", "City", "Contact and location"],
  ["eka", "Eka Care ID", "Hospital and system IDs"],
  ["akhil", "Akhil ID", "Hospital and system IDs"],
  ["state", "State", "Contact and location"],
];

describe("long lists", () => {
  const options = (n: number) => Array.from({ length: n }, (_, i): Choice => [String(i), `Option ${i}`]);

  it("10 options stay a plain list, 11 get the search", () => {
    assert.equal(needsSearch(options(10)), false);
    assert.equal(needsSearch(options(11)), true);
  });
});

describe("searching options", () => {
  const codes = (q: string) => matchChoices(FIELDS, q).map(([v]) => v);

  it("finds a label whatever the capitals", () => {
    assert.deepEqual(codes("eKa"), ["eka"]);
  });
  it("finds every word, in any order", () => {
    assert.deepEqual(codes("id care"), ["eka"]);
  });
  it("finds by heading", () => {
    assert.deepEqual(codes("location"), ["city", "state"]);
  });
  it("shows everything when nothing is typed", () => {
    assert.equal(codes("   ").length, FIELDS.length);
  });
  it("finds nothing for a word that isn't there", () => {
    assert.deepEqual(codes("billing"), []);
  });
});

describe("grouping options", () => {
  it("keeps each heading once, even when its options are apart", () => {
    const groups = groupChoices(FIELDS);
    assert.deepEqual(groups.map((g) => g.group), ["Basic details", "Contact and location", "Hospital and system IDs"]);
    assert.deepEqual(groups[1]!.choices.map(([v]) => v), ["city", "state"]);
  });
});
