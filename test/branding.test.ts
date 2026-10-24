// Portal-side checks on branding and links: node --test (no extra test framework).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseHospital, safeHttpsUrl } from "../src/lib/branding.ts";
import { securityHeaders } from "../security-headers.mjs";

const good = {
  name: "Test Hospital",
  shortName: "Test",
  portalTitle: "Patient portal",
  logoUrl: "/api/hospital/logo/default?v=a11964b2b3dd",
  logoLightUrl: null,
  primaryColor: "#112233",
  primaryColorDark: "#88AACC",
  secondaryColor: "#445566",
  accentColor: null,
  loginHeadline: "Your care,\nin one place.",
  loginTagline: "Tagline",
  loginPoints: ["One", "Two"],
  termsUrl: "https://example.org/terms",
  privacyUrl: null,
  supportPhone: null,
  supportEmail: null,
};

describe("parseHospital", () => {
  it("keeps good branding as is", () => {
    assert.deepEqual(parseHospital(good), good);
  });

  it("needs a name and short name", () => {
    for (const bad of [null, "x", 42, [], { ...good, name: "" }, { ...good, shortName: "  " }, { ...good, name: 7 }]) {
      assert.equal(parseHospital(bad), null);
    }
  });

  it("drops colours that could carry more than a colour", () => {
    const h = parseHospital({ ...good, primaryColor: "red;background:url(https://evil.example/x)", primaryColorDark: "#fff;", secondaryColor: "var(--x)", accentColor: "#12345" });
    assert.deepEqual([h?.primaryColor, h?.primaryColorDark, h?.secondaryColor, h?.accentColor], [null, null, null, null]);
  });

  it("only loads logos from the API's own logo route", () => {
    for (const bad of ["https://evil.example/logo.png", "//evil.example/logo.png", "javascript:alert(1)", "data:image/svg+xml,<svg/>", "/api/patient/documents/1/url", "/api/hospital/logo/default?v=abc"]) {
      assert.equal(parseHospital({ ...good, logoUrl: bad })?.logoUrl, null, bad);
    }
  });

  it("only links to https pages", () => {
    for (const bad of ["javascript:alert(1)", " javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,x", "http://example.org", "//example.org", "/terms", "https://u:p@example.org"]) {
      assert.equal(parseHospital({ ...good, termsUrl: bad, privacyUrl: bad })?.termsUrl, null, bad);
    }
  });

  it("keeps only short text points and caps them at five", () => {
    const h = parseHospital({ ...good, loginPoints: ["a", 1, null, { x: 1 }, "x".repeat(121), "b", "c", "d", "e", "f"] });
    assert.deepEqual(h?.loginPoints, ["a", "b", "c", "d", "e"]);
    assert.deepEqual(parseHospital({ ...good, loginPoints: "a" })?.loginPoints, []);
  });

  it("drops over-long text", () => {
    assert.equal(parseHospital({ ...good, loginTagline: "x".repeat(256) })?.loginTagline, null);
  });
});

describe("safeHttpsUrl (document links)", () => {
  it("passes a presigned S3 link and refuses anything else", () => {
    const s3 = "https://bucket.s3.ap-south-1.amazonaws.com/a.pdf?X-Amz-Signature=abc";
    assert.equal(safeHttpsUrl(s3), s3);
    for (const bad of ["javascript:alert(1)", "data:application/pdf;base64,AA", "http://bucket.s3.amazonaws.com/a.pdf", "", null, 3]) assert.equal(safeHttpsUrl(bad), null);
  });
});

describe("securityHeaders", () => {
  const docs = "https://bucket.s3.ap-south-1.amazonaws.com";
  const reports = "https://reports.s3.ap-south-1.amazonaws.com";
  const get = (dev: boolean) =>
    Object.fromEntries(securityHeaders({ documentsOrigin: docs, reportsOrigin: reports, dev }).map((h: { key: string; value: string }) => [h.key, h.value]));

  it("blocks framing, plugins and foreign scripts, and allows documents only from the two buckets", () => {
    const h = get(false);
    const csp = h["Content-Security-Policy"];
    for (const part of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", `frame-src ${docs} ${reports}`, "upgrade-insecure-requests"]) assert.ok(csp.includes(part), part);
    // Uploads may go only to the reports bucket, never to the documents bucket.
    assert.ok(csp.includes(`connect-src 'self' ${reports};`));
    assert.ok(!/connect-src[^;]*bucket\.s3/.test(csp));
    assert.ok(!csp.includes("unsafe-eval"));
    assert.equal(h["X-Frame-Options"], "DENY");
    assert.ok(h["Strict-Transport-Security"]);
  });

  it("relaxes only what next dev needs", () => {
    const csp = get(true)["Content-Security-Policy"];
    assert.ok(csp.includes("'unsafe-eval'") && csp.includes("ws:"));
    assert.equal(get(true)["Strict-Transport-Security"], undefined);
  });

  it("refuses a bucket origin that isn't a bare https origin", () => {
    for (const bad of ["http://bucket.s3.amazonaws.com", "https://bucket.s3.amazonaws.com/path", "not a url"]) {
      assert.throws(() => securityHeaders({ documentsOrigin: bad, reportsOrigin: reports }));
      assert.throws(() => securityHeaders({ documentsOrigin: docs, reportsOrigin: bad }));
    }
  });
});
