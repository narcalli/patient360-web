"use client";

import { useRef } from "react";

export type IconTab = { key: string; label: string; icon: React.ReactNode };

/**
 * A row of icon-only tabs (the name shows on hover and focus), used by Analytics and Data. The page draws the panel:
 * give it id `${idPrefix}-panel`, role "tabpanel" and aria-labelledby `${idPrefix}-tab-${key}` of the open tab.
 */
export function IconTabs({ tabs, value, onChange, idPrefix, label }: { tabs: IconTab[]; value: string; onChange: (key: string) => void; idPrefix: string; label: string }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const move = (to: number) => {
    const t = tabs[(to + tabs.length) % tabs.length]!;
    onChange(t.key);
    refs.current[t.key]?.focus();
  };

  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1 border-b border-line">
      {tabs.map((t, i) => {
        const on = t.key === value;
        return (
          <button
            key={t.key}
            ref={(el) => {
              refs.current[t.key] = el;
            }}
            id={`${idPrefix}-tab-${t.key}`}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={`${idPrefix}-panel`}
            aria-label={t.label}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.key)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") (e.preventDefault(), move(i + 1));
              else if (e.key === "ArrowLeft") (e.preventDefault(), move(i - 1));
              else if (e.key === "Home") (e.preventDefault(), move(0));
              else if (e.key === "End") (e.preventDefault(), move(tabs.length - 1));
            }}
            className={`group relative -mb-px inline-flex h-12 w-14 items-center justify-center border-b-2 transition-colors duration-150 ${
              on ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.icon}
            <span
              role="presentation"
              className="pointer-events-none absolute top-full left-1/2 z-20 mt-1.5 -translate-x-1/2 rounded-md bg-ink px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-canvas opacity-0 shadow-[var(--shadow-pop)] transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
            >
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
