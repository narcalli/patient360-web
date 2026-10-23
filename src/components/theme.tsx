"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { applyTheme, DARK_QUERY, isTheme, isUnsynced, readStoredTheme, storeTheme, type ResolvedTheme, type ThemeChoice } from "@/lib/theme";
import { MonitorIcon, MoonIcon, SunIcon } from "./icons";

interface ThemeState {
  choice: ThemeChoice;
  resolved: ResolvedTheme;
  setChoice: (choice: ThemeChoice) => void;
  /** Called with the account's saved theme after /me: adopts it, or saves this device's choice if that is newer. */
  syncFromAccount: (accountTheme: string) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

/** Saves to the account; a failure (signed out, offline) leaves the choice to be saved on the next /me. */
function saveToAccount(choice: ThemeChoice) {
  api
    .put("/session/preferences", { theme: choice })
    .then(() => storeTheme(choice, false))
    .catch(() => storeTheme(choice, true));
}

/**
 * Light, dark or follow the device. Rendered inside BrandProvider, which renders nothing until the client has
 * mounted, so reading localStorage in the initial state can't cause a hydration mismatch.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(readStoredTheme);
  const [resolved, setResolved] = useState<ResolvedTheme>("light");
  const choiceRef = useRef(choice);
  choiceRef.current = choice;

  // Before paint: the boot script already set data-theme; this re-applies it after React's dev remount and keeps
  // the toolbar colour in step.
  useLayoutEffect(() => setResolved(applyTheme(choice)), [choice]);

  // "System" follows the device live, e.g. when the phone switches to dark at sunset.
  useEffect(() => {
    if (choice !== "system") return;
    const mq = window.matchMedia(DARK_QUERY);
    const onChange = () => setResolved(applyTheme("system"));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [choice]);

  const setChoice = useCallback((next: ThemeChoice) => {
    storeTheme(next, true);
    setChoiceState(next);
    saveToAccount(next);
  }, []);

  const syncFromAccount = useCallback((accountTheme: string) => {
    if (!isTheme(accountTheme)) return;
    if (isUnsynced()) {
      saveToAccount(choiceRef.current);
    } else if (accountTheme !== choiceRef.current) {
      storeTheme(accountTheme, false);
      setChoiceState(accountTheme);
    }
  }, []);

  const value = useMemo(() => ({ choice, resolved, setChoice, syncFromAccount }), [choice, resolved, setChoice, syncFromAccount]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const t = useContext(ThemeContext);
  if (!t) throw new Error("useTheme outside ThemeProvider");
  return t;
}

const OPTIONS = [
  { value: "system", label: "System", Icon: MonitorIcon },
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
] as const;

/**
 * Segmented System / Light / Dark control: a radio group, so arrow keys move the choice and Tab enters and leaves
 * it as one stop. `compact` shows icons only (each keeps its name for screen readers and as a tooltip).
 */
export function ThemeSwitch({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  const { choice, setChoice } = useTheme();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + OPTIONS.length) % OPTIONS.length;
    setChoice(OPTIONS[next]!.value);
    refs.current[next]?.focus();
  }

  return (
    <div role="radiogroup" aria-label="Appearance" className={`inline-flex max-w-full rounded-full border border-line bg-subtle p-1 ${className}`}>
      {OPTIONS.map(({ value, label, Icon }, i) => {
        const on = choice === value;
        return (
          <button
            key={value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={compact ? label : undefined}
            title={label}
            tabIndex={on ? 0 : -1}
            onClick={() => setChoice(value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`inline-flex min-h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors duration-150 ${
              compact ? "w-9" : "px-2.5"
            } ${on ? "bg-surface text-ink shadow-[var(--shadow-card)] ring-1 ring-line" : "text-muted hover:text-ink"}`}
          >
            <Icon size={16} className="shrink-0" />
            {!compact && label}
          </button>
        );
      })}
    </div>
  );
}
