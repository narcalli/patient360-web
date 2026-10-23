// Brand colours are typed into hospital_config by hand, so nothing guarantees they are readable. These helpers move a
// colour just far enough towards black or white that text in it, and text on it, meets WCAG AA (4.5:1) in each theme.

export type Rgb = readonly [number, number, number];

export const WHITE: Rgb = [255, 255, 255];
export const BLACK: Rgb = [0, 0, 0];

/**
 * The neutral surfaces a brand colour must read on, per theme. They mirror --color-canvas, --color-surface,
 * --color-subtle and --color-ink in globals.css; test/color.test.ts fails if the two drift apart.
 */
export const NEUTRALS = {
  light: { canvas: [244, 247, 248], surface: [255, 255, 255], subtle: [240, 244, 246], ink: [15, 27, 34] },
  dark: { canvas: [38, 38, 36], surface: [48, 48, 46], subtle: [58, 57, 54], ink: [245, 244, 239] },
} as const satisfies Record<"light" | "dark", Record<"canvas" | "surface" | "subtle" | "ink", Rgb>>;

export function parseHex(value: string | null | undefined): Rgb | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value ?? "");
  return m ? [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)] : null;
}

export const toHex = (c: Rgb) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

const linear = (v: number) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance. */
export const luminance = ([r, g, b]: Rgb) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);

/** WCAG contrast ratio, 1 to 21. */
export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const mix = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map((i) => Math.round(a[i]! + (b[i]! - a[i]!) * t)) as unknown as Rgb;

/** The colour, moved towards `toward` in 5% steps until it reaches `ratio` on every background. */
export function ensureContrast(color: Rgb, backgrounds: readonly Rgb[], toward: Rgb, ratio = 4.5): Rgb {
  for (let step = 0; step <= 20; step++) {
    const c = mix(color, toward, step / 20);
    if (backgrounds.every((bg) => contrast(c, bg) >= ratio)) return c;
  }
  return toward;
}

/** Whichever of the candidates reads best on `bg`. */
export const readableOn = (bg: Rgb, ...candidates: Rgb[]) =>
  candidates.reduce((best, c) => (contrast(bg, c) > contrast(bg, best) ? c : best));

export interface BrandColors {
  primaryColor: string | null;
  primaryColorDark: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
}

/**
 * CSS variables for the hospital's colours, already adjusted for contrast. globals.css reads them, with neutral
 * fallbacks, so a hospital with no colours set still gets a readable portal.
 *   --p360-brand / --p360-on-brand            light theme: links, buttons and the text on buttons
 *   --p360-brand-dark / --p360-on-brand-dark  dark theme, from primary_color_dark or else primary_color
 *   --p360-heading                            light theme headings (secondary_color, when it reads)
 *   --p360-panel / --p360-on-panel            sign-in panel (accent_color) and its text
 */
export function brandVariables(h: BrandColors): Record<string, string | null> {
  const L = NEUTRALS.light;
  const D = NEUTRALS.dark;
  const primary = parseHex(h.primaryColor);
  const secondary = parseHex(h.secondaryColor);
  const vars: Record<string, string | null> = {
    "--p360-brand": null,
    "--p360-on-brand": null,
    "--p360-brand-dark": null,
    "--p360-on-brand-dark": null,
    "--p360-heading": null,
    "--p360-panel": null,
    "--p360-on-panel": null,
  };
  if (!primary) return vars;

  const light = ensureContrast(primary, [L.surface, L.canvas, L.subtle], BLACK);
  const dark = ensureContrast(parseHex(h.primaryColorDark) ?? primary, [D.surface, D.canvas, D.subtle], WHITE);
  vars["--p360-brand"] = toHex(light);
  vars["--p360-on-brand"] = toHex(readableOn(light, WHITE, L.ink));
  vars["--p360-brand-dark"] = toHex(dark);
  vars["--p360-on-brand-dark"] = toHex(readableOn(dark, D.canvas, WHITE));

  if (secondary && [L.surface, L.canvas].every((bg) => contrast(secondary, bg) >= 4.5)) vars["--p360-heading"] = toHex(secondary);

  // Panel text: secondary_color when it reads, else white or ink. A mid-tone panel where neither reaches 4.5:1 is
  // nudged away from its text colour until it does.
  let panel = parseHex(h.accentColor) ?? mix(primary, WHITE, 0.65);
  const onPanel = secondary && contrast(secondary, panel) >= 4.5 ? secondary : readableOn(panel, WHITE, L.ink);
  if (contrast(onPanel, panel) < 4.5) panel = ensureContrast(panel, [onPanel], luminance(onPanel) > 0.5 ? BLACK : WHITE);
  vars["--p360-panel"] = toHex(panel);
  vars["--p360-on-panel"] = toHex(onPanel);
  return vars;
}
