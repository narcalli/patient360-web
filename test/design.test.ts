// Design-system checks: contrast of the theme tokens in both themes, the contrast guarantee on hospital colours,
// the theme boot script, and the date and label helpers. node --test (no extra test framework).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { runInNewContext } from "node:vm";
import { brandVariables, contrast, NEUTRALS, parseHex, toHex, WHITE, type Rgb } from "../src/lib/color.ts";
import { ageFromDob, bloodGroupLabel, dayParts, documentDay, genderLabel, monthLabel, relativeDay } from "../src/lib/format.ts";
import { resolveTheme, THEME_BOOT_SCRIPT, THEME_KEY } from "../src/lib/theme.ts";

// ─── Tokens, read from globals.css itself ────────────────────────────────────

const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

function tokens(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]!] = m[2]!;
  return out;
}
const lightBlock = css.slice(css.indexOf("@theme {"), css.indexOf("@layer base"));
const darkBlock = css.slice(css.indexOf('[data-theme="dark"] {'), css.indexOf("html,"));
const light = tokens(lightBlock);
const dark = { ...light, ...tokens(darkBlock) };
// The neutral fallbacks for brand colours sit inside var(--p360-…, #hex).
const fallback = (block: string, name: string) => block.match(new RegExp(`--color-${name}:\\s*var\\(--p360-[a-z-]+,\\s*(#[0-9a-fA-F]{6})\\)`))?.[1];
light.brand = fallback(lightBlock, "brand")!;
light["on-brand"] = fallback(lightBlock, "on-brand")!;
dark.brand = fallback(darkBlock, "brand")!;
dark["on-brand"] = fallback(darkBlock, "on-brand")!;

const ratio = (t: Record<string, string>, a: string, b: string) => contrast(parseHex(t[a])!, parseHex(t[b])!);

// [foreground, background, minimum]: 4.5 for text (WCAG 1.4.3), 3 for control edges and focus (1.4.11).
const PAIRS: [string, string, number][] = [
  ...["ink", "ink-soft", "muted"].flatMap((fg) => ["canvas", "surface", "subtle"].map((bg) => [fg, bg, 4.5] as [string, string, number])),
  ...["ink", "ink-soft", "muted"].map((fg) => [fg, "sidebar", 4.5] as [string, string, number]),
  ["placeholder", "surface", 4.5],
  ["ok", "surface", 4.5],
  ["ok", "ok-soft", 4.5],
  ["warn", "surface", 4.5],
  ["warn", "warn-soft", 4.5],
  ["bad", "surface", 4.5],
  ["bad", "bad-soft", 4.5],
  ["brand", "surface", 4.5],
  ["brand", "canvas", 4.5],
  ["on-brand", "brand", 4.5],
  ["field-line", "surface", 3],
  ["canvas", "ink", 4.5], // the toast is inverted
];

describe("theme tokens", () => {
  for (const [name, t] of [["light", light], ["dark", dark]] as const) {
    for (const [fg, bg, min] of PAIRS) {
      it(`${name}: ${fg} on ${bg} is at least ${min}:1`, () => {
        assert.ok(t[fg] && t[bg], `missing token ${fg} or ${bg}`);
        const r = ratio(t, fg, bg);
        assert.ok(r >= min, `${fg} ${t[fg]} on ${bg} ${t[bg]} is ${r.toFixed(2)}:1`);
      });
    }
  }

  it("NEUTRALS in color.ts match globals.css", () => {
    for (const [theme, t] of [["light", light], ["dark", dark]] as const) {
      for (const [key, rgb] of Object.entries(NEUTRALS[theme])) {
        assert.equal(toHex(rgb).toLowerCase(), t[key]!.toLowerCase(), `${theme} ${key}`);
      }
    }
  });
});

// ─── Hospital colours: whatever is in the DB, the result reads ───────────────

describe("brandVariables", () => {
  const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
  // A spread of colours across the cube, including near-white, near-black and saturated ones.
  const samples: string[] = [];
  for (let r = 0; r < 256; r += 36) for (let g = 0; g < 256; g += 36) for (let b = 0; b < 256; b += 36) samples.push(hex((r << 16) | (g << 8) | b));

  const rgb = (v: string | null) => parseHex(v)!;
  const L = NEUTRALS.light;
  const D = NEUTRALS.dark;

  it(`keeps every brand colour at 4.5:1 or more in both themes (${samples.length} colours)`, () => {
    for (const primaryColor of samples) {
      const v = brandVariables({ primaryColor, primaryColorDark: null, secondaryColor: null, accentColor: null });
      const brand = rgb(v["--p360-brand"]!);
      const brandDark = rgb(v["--p360-brand-dark"]!);
      for (const bg of [L.surface, L.canvas, L.subtle] as Rgb[]) assert.ok(contrast(brand, bg) >= 4.5, `${primaryColor} light`);
      for (const bg of [D.surface, D.canvas, D.subtle] as Rgb[]) assert.ok(contrast(brandDark, bg) >= 4.5, `${primaryColor} dark`);
      assert.ok(contrast(rgb(v["--p360-on-brand"]!), brand) >= 4.5, `${primaryColor} button text, light`);
      assert.ok(contrast(rgb(v["--p360-on-brand-dark"]!), brandDark) >= 4.5, `${primaryColor} button text, dark`);
    }
  });

  it("keeps sign-in panel text at 4.5:1 for any accent colour", () => {
    for (const accentColor of samples) {
      for (const secondaryColor of [null, "#0F2E6E", "#FFFFFF", "#808080"]) {
        const v = brandVariables({ primaryColor: "#00798C", primaryColorDark: null, secondaryColor, accentColor });
        const r = contrast(rgb(v["--p360-on-panel"]!), rgb(v["--p360-panel"]!));
        assert.ok(r >= 4.5, `panel ${accentColor} with text ${secondaryColor}: ${r.toFixed(2)}`);
      }
    }
  });

  it("leaves a colour that already reads unchanged", () => {
    const v = brandVariables({ primaryColor: "#00798C", primaryColorDark: "#00B4C9", secondaryColor: "#0F2E6E", accentColor: "#00B4C9" });
    assert.equal(v["--p360-brand"], "#00798c");
    assert.equal(v["--p360-brand-dark"], "#00b4c9");
    assert.equal(v["--p360-on-brand"], toHex(WHITE));
    assert.equal(v["--p360-heading"], "#0f2e6e");
    assert.equal(v["--p360-on-panel"], "#0f2e6e");
  });

  it("uses headings in the secondary colour only when they read", () => {
    const v = brandVariables({ primaryColor: "#00798C", primaryColorDark: null, secondaryColor: "#E8F0F8", accentColor: null });
    assert.equal(v["--p360-heading"], null);
  });

  it("sets nothing without a primary colour, so the neutral defaults apply", () => {
    const v = brandVariables({ primaryColor: null, primaryColorDark: "#00B4C9", secondaryColor: "#0F2E6E", accentColor: "#00B4C9" });
    assert.ok(Object.values(v).every((x) => x === null));
  });
});

// ─── Theme ───────────────────────────────────────────────────────────────────

describe("theme", () => {
  it("resolves the choice against the device setting", () => {
    assert.equal(resolveTheme("system", true), "dark");
    assert.equal(resolveTheme("system", false), "light");
    assert.equal(resolveTheme("light", true), "light");
    assert.equal(resolveTheme("dark", false), "dark");
  });

  function boot(stored: string | null | "throws", prefersDark: boolean) {
    const attrs: Record<string, string> = {};
    const style: Record<string, string> = {};
    runInNewContext(THEME_BOOT_SCRIPT, {
      localStorage: {
        getItem: (k: string) => {
          if (stored === "throws") throw new Error("SecurityError");
          return k === THEME_KEY ? stored : null;
        },
      },
      window: { matchMedia: () => ({ matches: prefersDark }) },
      document: { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v), style } },
    });
    return [attrs["data-theme"], style.colorScheme];
  }

  it("boot script sets the theme before paint", () => {
    assert.deepEqual(boot("dark", false), ["dark", "dark"]);
    assert.deepEqual(boot("light", true), ["light", "light"]);
    assert.deepEqual(boot("system", true), ["dark", "dark"]);
    assert.deepEqual(boot(null, true), ["dark", "dark"]);
    assert.deepEqual(boot(null, false), ["light", "light"]);
    assert.deepEqual(boot("<script>", true), ["dark", "dark"]);
  });

  it("boot script still follows the device when storage is blocked", () => {
    assert.deepEqual(boot("throws", true), ["dark", "dark"]);
    assert.deepEqual(boot("throws", false), ["light", "light"]);
  });
});

// ─── Formatting ──────────────────────────────────────────────────────────────

describe("format", () => {
  const now = new Date("2026-10-23T06:00:00Z"); // 11:30 IST

  it("ages from date of birth on IST days", () => {
    assert.equal(ageFromDob("1992-04-11", now), "34 yrs");
    assert.equal(ageFromDob("1992-10-24", now), "33 yrs");
    assert.equal(ageFromDob("1992-10-23", now), "34 yrs");
    assert.equal(ageFromDob("2026-02-03", now), "8 months");
    assert.equal(ageFromDob("2026-10-10", now), "Under 1 month");
  });

  it("relative days for the last week, dates after", () => {
    assert.equal(relativeDay("2026-10-23", now), "Today");
    assert.equal(relativeDay("2026-10-22", now), "Yesterday");
    assert.equal(relativeDay("2026-10-19", now), "4 days ago");
    assert.equal(relativeDay("2026-09-12", now), "12 Sep 2026");
  });

  it("puts undated documents on the IST day they were added", () => {
    assert.equal(documentDay({ documentDate: null, uploadedAt: "2026-10-22T20:00:00Z" }), "2026-10-23");
    assert.equal(documentDay({ documentDate: "2026-09-12", uploadedAt: "2026-10-22T20:00:00Z" }), "2026-09-12");
  });

  it("labels", () => {
    assert.deepEqual(dayParts("2026-09-12"), { day: "12", month: "Sep", weekday: "Sat" });
    assert.equal(monthLabel("2026-09-01"), "September 2026");
    assert.equal(bloodGroupLabel("AB_NEG"), "AB−");
    assert.equal(bloodGroupLabel("Z"), null);
    assert.equal(genderLabel("UNKNOWN"), null);
    assert.equal(genderLabel("FEMALE"), "Female");
  });
});
