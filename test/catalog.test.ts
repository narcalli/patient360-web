// How patient fields are worded on screen. node --test (no extra framework).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ANSWER_KIND, answerKind, canHoldSeveral, catalogError, fieldLockNote, fieldMatches, fieldSummary } from "../src/lib/catalog.ts";

const field = (over = {}) => ({ label: "Billing ID", helpText: null, group: { code: "last_bill", label: "Latest bill" }, dataType: { code: "TEXT", label: "Text", inputControl: "text" }, isCore: false, isComputed: false, isMultiValued: false, importColumn: null, ...over });

describe("patient field words", () => {
  it("has plain words for every kind of answer the portal seeds", () => {
    for (const code of ["TEXT", "LONG_TEXT", "INTEGER", "DECIMAL", "DATE", "BOOLEAN", "CHOICE", "PHONE", "EMAIL"]) assert.ok(ANSWER_KIND[code]?.help, code);
    assert.equal(answerKind({ code: "CHOICE", label: "Choice" }), "Pick from a list");
    assert.equal(answerKind({ code: "NEW_KIND", label: "New kind" }), "New kind");
  });

  it("agrees with the API on which answers can hold several values", () => {
    assert.equal(canHoldSeveral("TEXT"), true);
    assert.equal(canHoldSeveral("CHOICE"), true);
    for (const code of ["INTEGER", "DECIMAL", "DATE", "BOOLEAN"]) assert.equal(canHoldSeveral(code), false, code);
  });

  it("says where a field's value comes from", () => {
    assert.equal(fieldSummary(field()), "Short text");
    assert.equal(fieldSummary(field({ isMultiValued: true, importColumn: "Bill No" })), 'Short text, more than one allowed · filled from the Excel column "Bill No"');
    assert.match(fieldLockNote(field({ isCore: true }))!, /main record/);
    assert.match(fieldLockNote(field({ isComputed: true }))!, /automatically/);
    assert.equal(fieldLockNote(field()), null);
  });

  it("finds a field by what people see", () => {
    assert.ok(fieldMatches(field(), "  billing "));
    assert.ok(fieldMatches(field(), "LATEST"));
    assert.ok(!fieldMatches(field(), "last_invoice_id"));
    assert.ok(fieldMatches(field(), ""));
  });

  it("explains a refusal without technical words", () => {
    assert.match(catalogError("FIELD_IN_IMPORT_RULE", { sheetColumn: "Bill No" }), /"Bill No".*Import rules/);
    assert.match(catalogError("TYPE_LOCKED"), /already have an answer/);
    assert.equal(catalogError("SOMETHING_NEW"), "Something went wrong. Please try again.");
    for (const code of ["TYPE_LOCKED", "BAD_LIMITS", "GROUP_HAS_FIELDS", "CORE_FIELD_LOCKED"]) assert.doesNotMatch(catalogError(code), /column|table|database|code/i, code);
  });
});
