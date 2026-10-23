// Light, dark or follow the device. The choice is kept in localStorage for the first paint on this device, and on
// the account (PUT /session/preferences) so it follows the login to other devices.

export type ThemeChoice = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEMES: readonly ThemeChoice[] = ["system", "light", "dark"];
export const THEME_KEY = "p360.theme";
// Set when a choice couldn't be saved to the account (e.g. made on the sign-in page). The next /me then saves this
// device's choice instead of taking the account's.
export const THEME_UNSYNCED_KEY = "p360.theme.unsynced";

export const isTheme = (v: unknown): v is ThemeChoice => THEMES.includes(v as ThemeChoice);

export const resolveTheme = (choice: ThemeChoice, prefersDark: boolean): ResolvedTheme =>
  choice === "dark" || (choice === "system" && prefersDark) ? "dark" : "light";

export const DARK_QUERY = "(prefers-color-scheme: dark)";

export function readStoredTheme(): ThemeChoice {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return isTheme(v) ? v : "system";
  } catch {
    return "system";
  }
}

export function storeTheme(choice: ThemeChoice, unsynced: boolean) {
  try {
    localStorage.setItem(THEME_KEY, choice);
    if (unsynced) localStorage.setItem(THEME_UNSYNCED_KEY, "1");
    else localStorage.removeItem(THEME_UNSYNCED_KEY);
  } catch {
    // Storage blocked: the theme still applies for this visit.
  }
}

export function isUnsynced(): boolean {
  try {
    return localStorage.getItem(THEME_UNSYNCED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Sets data-theme on <html> and matches the browser's toolbar colour to the page. */
export function applyTheme(choice: ThemeChoice): ResolvedTheme {
  const resolved = resolveTheme(choice, window.matchMedia(DARK_QUERY).matches);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  const surface = getComputedStyle(root).getPropertyValue("--color-surface").trim();
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  if (surface) meta.content = surface;
  return resolved;
}

/**
 * Runs in <head> before the first paint (see layout.tsx), so a dark-mode visitor never sees a white flash. Same rule
 * as resolveTheme; it can't import, so it is written out here.
 */
export const THEME_BOOT_SCRIPT = `(function(){var t=null;try{t=localStorage.getItem(${JSON.stringify(THEME_KEY)})}catch(e){}var d=t==="dark"||(t!=="light"&&window.matchMedia(${JSON.stringify(DARK_QUERY)}).matches);var r=document.documentElement;r.setAttribute("data-theme",d?"dark":"light");r.style.colorScheme=d?"dark":"light"})()`;
