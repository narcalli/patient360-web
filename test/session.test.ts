// The portal's side of role-based access: which pages a session may open, which nav item is lit, and where a
// signed-out visitor signs in. The nav itself always comes from GET /api/session.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatDateTime, humanize } from "../src/lib/format.ts";
import { activeHref, can, cleanPath, mayOpen, type NavItem } from "../src/lib/session.ts";

const item = (href: string): NavItem => ({ key: href, label: href, icon: "overview", href });
const patient = { nav: [item("/patient"), item("/patient/records"), item("/patient/profile")] };
const admin = { nav: [item("/admin/patients"), item("/admin/lab-partners"), item("/admin/audit")] };

describe("mayOpen", () => {
  it("opens pages under the session's own nav, with or without a trailing slash", () => {
    assert.equal(mayOpen(admin, "/admin/patients/view"), true);
    assert.equal(mayOpen(admin, "/admin/audit/"), true);
    assert.equal(mayOpen(patient, "/patient/records"), true);
  });

  it("refuses other roles' pages and look-alike paths", () => {
    assert.equal(mayOpen(patient, "/admin/patients"), false);
    assert.equal(mayOpen(admin, "/partner/uploads"), false);
    assert.equal(mayOpen(admin, "/admin"), false);
    assert.equal(mayOpen(patient, "/patients"), false);
    assert.equal(mayOpen({ nav: [] }, "/patient"), false);
  });
});

describe("activeHref", () => {
  it("lights the most specific item, not the home that contains it", () => {
    assert.equal(activeHref(patient.nav, "/patient/records"), "/patient/records");
    assert.equal(activeHref(patient.nav, "/patient"), "/patient");
    assert.equal(activeHref(admin.nav, "/admin/patients/view/"), "/admin/patients");
    assert.equal(activeHref(admin.nav, "/elsewhere"), null);
  });
});

describe("can", () => {
  it("shows an action only when the person's type has its permission", () => {
    const desk = { permissions: ["patients.view", "patients.create"] };
    assert.equal(can(desk, "patients.create"), true);
    assert.equal(can(desk, "users.manage"), false);
    assert.equal(can({ permissions: [] }, "patients.view"), false);
  });
});

describe("cleanPath", () => {
  it("drops the static export's trailing slash, but keeps the root", () => {
    assert.equal(cleanPath("/admin/audit/"), "/admin/audit");
    assert.equal(cleanPath("/"), "/");
  });
});

describe("staff labels", () => {
  it("turns codes into words without a lookup table", () => {
    assert.equal(humanize("DOCUMENT_VIEWED"), "Document viewed");
    assert.equal(humanize("LAB_PARTNER"), "Lab partner");
    assert.equal(humanize("TOTP_ENROLLED"), "TOTP enrolled");
    assert.equal(humanize("OTP_SENT"), "OTP sent");
  });

  it("shows times in IST", () => {
    assert.match(formatDateTime("2026-10-23T09:34:00Z"), /23 Oct 2026, 3:04\spm/i);
  });
});
