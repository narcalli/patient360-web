"use client";

import { useId, useRef } from "react";

/** A tick box with a bold title and a line of help, the same as on the patient fields page. */
export function Check({ checked, onChange, disabled = false, title, children }: { checked: boolean; onChange: (on: boolean) => void; disabled?: boolean; title: string; children?: React.ReactNode }) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-brand)]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        {children && <span className="block text-sm text-ink-soft">{children}</span>}
      </span>
    </label>
  );
}

/** A labelled box for a few lines of text. */
export function AreaField({
  label,
  value,
  onChange,
  hint,
  error,
  optional = false,
  maxLength,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: React.ReactNode;
  error?: string | null;
  optional?: boolean;
  maxLength?: number;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold">
        {label} {optional && <span className="font-normal text-muted">(optional)</span>}
      </label>
      <textarea
        id={id}
        rows={3}
        maxLength={maxLength}
        disabled={disabled}
        className={`field mt-1.5 min-h-24 py-3 ${error ? "border-bad" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-note` : undefined}
      />
      {(error || hint) && (
        <p id={`${id}-note`} className={`mt-1.5 text-sm ${error ? "text-bad" : "text-muted"}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export interface TabDef<K extends string> {
  key: K;
  label: string;
}

/** Tabs that work with the keyboard: arrow keys move between them, Home and End jump, and the panel is named by its tab. */
export function Tabs<K extends string>({ tabs, current, onChange, label, idPrefix }: { tabs: TabDef<K>[]; current: K; onChange: (key: K) => void; label: string; idPrefix: string }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const move = (to: number) => {
    const t = tabs[(to + tabs.length) % tabs.length]!;
    onChange(t.key);
    refs.current[t.key]?.focus();
  };
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t, i) => {
        const on = t.key === current;
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
            tabIndex={on ? 0 : -1}
            className={`-mb-px min-h-11 shrink-0 border-b-2 px-4 text-sm font-semibold whitespace-nowrap transition-colors ${on ? "border-brand text-ink" : "border-transparent text-muted hover:text-ink"}`}
            onClick={() => onChange(t.key)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") (e.preventDefault(), move(i + 1));
              else if (e.key === "ArrowLeft") (e.preventDefault(), move(i - 1));
              else if (e.key === "Home") (e.preventDefault(), move(0));
              else if (e.key === "End") (e.preventDefault(), move(tabs.length - 1));
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** The panel under the tabs, named by the current tab. */
export function TabPanel({ idPrefix, current, children }: { idPrefix: string; current: string; children: React.ReactNode }) {
  return (
    <div role="tabpanel" id={`${idPrefix}-panel`} aria-labelledby={`${idPrefix}-tab-${current}`} className="mt-6">
      {children}
    </div>
  );
}
