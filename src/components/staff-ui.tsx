"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { TemporaryPassword } from "@/lib/api";
import { formatDateTime, humanize } from "@/lib/format";
import { AlertIcon, CheckIcon, ClockIcon, CloseIcon, CopyIcon, KeyIcon, SearchIcon } from "./icons";

// Building blocks for the staff pages (admins, hospital staff, lab partners), in the same tokens as the patient view.

/** The area this page is in ("/admin", "/staff"): pages shared by two areas link within their own. */
export function useAreaBase(): string {
  const first = usePathname().split("/")[1];
  return first ? `/${first}` : "";
}

export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[26px] leading-tight font-extrabold sm:text-[30px]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/**
 * Query-string state for a page (search text, filters), so Back and a shared link return to the same view.
 * Must be used under a Suspense boundary (static export).
 */
export function useUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const set = useCallback(
    (changes: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(changes)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      const q = next.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );
  return { params, set };
}

/** One search box with a visible label and helper text; submits on Enter or the button. */
export function SearchBox({
  label,
  hint,
  initial,
  onSearch,
  busy = false,
  placeholder,
}: {
  label: string;
  hint: string;
  initial: string;
  onSearch: (q: string) => void;
  busy?: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = useState(initial);
  const id = useId();
  useEffect(() => setValue(initial), [initial]);
  return (
    <form
      role="search"
      className="card p-4 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(value.trim());
      }}
    >
      <label htmlFor={id} className="block text-sm font-semibold">{label}</label>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <SearchIcon size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
          <input
            id={id}
            type="search"
            className="field pl-10"
            value={value}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            aria-describedby={`${id}-hint`}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
        </div>
        <button className="btn sm:w-32" disabled={busy || !value.trim()}>{busy ? "Searching…" : "Search"}</button>
      </div>
      <p id={`${id}-hint`} className="mt-2 text-sm text-muted">{hint}</p>
    </form>
  );
}

type Tone = "ok" | "warn" | "bad" | "neutral";
const TONES: Record<Tone, string> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  neutral: "bg-subtle text-ink-soft ring-1 ring-line ring-inset",
};
const ICONS: Record<Tone, React.ComponentType<{ size?: number }> | null> = { ok: CheckIcon, warn: ClockIcon, bad: AlertIcon, neutral: null };

// Every status says itself in words; the colour and icon only support it.
const STATUS: Record<string, { label: string; tone: Tone }> = {
  AVAILABLE: { label: "Available", tone: "ok" },
  UPLOADING: { label: "Uploading", tone: "warn" },
  FAILED: { label: "Failed", tone: "bad" },
  ACTIVE: { label: "Active", tone: "ok" },
  DEACTIVATED: { label: "Deactivated", tone: "neutral" },
  GIVEN: { label: "Consent given", tone: "ok" },
  NOT_GIVEN: { label: "No consent", tone: "warn" },
  WITHDRAWN: { label: "Consent withdrawn", tone: "neutral" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: humanize(status), tone: "neutral" as Tone };
  const Icon = ICONS[s.tone];
  return (
    <span className={`badge ${TONES[s.tone]}`}>
      {Icon && <Icon size={13} />}
      {s.label}
    </span>
  );
}

export function EmptyState({ icon, title, children }: { icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-subtle text-muted">{icon}</span>
      <p className="mt-4 font-bold">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}

export function ErrorBanner({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <p role="alert" className="flex flex-wrap items-center gap-2 rounded-[var(--radius-control)] bg-bad-soft px-4 py-3 text-sm text-bad">
      <AlertIcon size={18} className="shrink-0" />
      <span className="min-w-0 flex-1">{text}</span>
      {onRetry && (
        <button type="button" className="font-semibold underline underline-offset-2" onClick={onRetry}>
          Try again
        </button>
      )}
    </p>
  );
}

/** A short confirmation after a change, read out by screen readers, gone after a few seconds. */
export function useToast() {
  const [text, setText] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((t: string) => {
    setText(t);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setText(null), 4000);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const ui = (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-6 z-40 flex justify-center">
      {text && (
        <p className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-canvas shadow-[var(--shadow-pop)] motion-safe:animate-fade-in">
          <CheckIcon size={18} className="shrink-0" />
          <span className="min-w-0 flex-1">{text}</span>
          <button className="inline-flex h-8 w-8 items-center justify-center rounded-full" aria-label="Dismiss" onClick={() => setText(null)}>
            <CloseIcon size={14} />
          </button>
        </p>
      )}
    </div>
  );
  return { show, ui };
}

/** Rows that load: same height as real ones, so the table doesn't jump. */
export function RowsSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className="card divide-y divide-line">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <span className="skeleton h-10 w-10 shrink-0 rounded-full" />
          <span className="flex-1 space-y-2">
            <span className="skeleton block h-4 w-1/3" />
            <span className="skeleton block h-3 w-1/2" />
          </span>
        </div>
      ))}
    </div>
  );
}

/** A labelled input with its hint or error underneath, tied together for screen readers. */
export function TextField({
  label,
  value,
  onChange,
  hint,
  error,
  optional = false,
  ...props
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: React.ReactNode;
  error?: string | null;
  optional?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold">
        {label} {optional && <span className="font-normal text-muted">(optional)</span>}
      </label>
      <input
        id={id}
        className={`field mt-1.5 ${error ? "border-bad" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-note` : undefined}
        {...props}
      />
      <FieldNote id={`${id}-note`} hint={hint} error={error} />
    </div>
  );
}

/** A labelled native select (keyboard and screen readers work as everywhere else). */
export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  hint,
  error,
  optional = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
  /** Shown as the empty choice. */
  placeholder?: string;
  hint?: React.ReactNode;
  error?: string | null;
  optional?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold">
        {label} {optional && <span className="font-normal text-muted">(optional)</span>}
      </label>
      <select
        id={id}
        className={`field mt-1.5 ${error ? "border-bad" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-note` : undefined}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
      <FieldNote id={`${id}-note`} hint={hint} error={error} />
    </div>
  );
}

function FieldNote({ id, hint, error }: { id: string; hint?: React.ReactNode; error?: string | null }) {
  if (!error && !hint) return null;
  return (
    <p id={id} className={`mt-1.5 flex items-start gap-1.5 text-sm ${error ? "font-semibold text-bad" : "text-muted"}`}>
      {error && <AlertIcon size={16} className="mt-px shrink-0" />}
      {error ?? hint}
    </p>
  );
}

/**
 * A modal with a form: opens focused on its first field, Escape or Close cancels (unless saving), and the page
 * behind can't be reached until it closes.
 */
export function FormDialog({
  title,
  description,
  children,
  submitLabel,
  busy,
  busyLabel = "Saving…",
  destructive = false,
  canSubmit = true,
  error,
  onSubmit,
  onClose,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  submitLabel: string;
  busy: boolean;
  busyLabel?: string;
  /** Removes something: the submit button is red, as in ConfirmDialog. */
  destructive?: boolean;
  canSubmit?: boolean;
  error?: string | null;
  onSubmit: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    // showModal focuses the first focusable element (Close); start at the first field instead.
    d?.querySelector<HTMLElement>("input, select, textarea")?.focus();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(34rem,calc(100vw-2rem))] overflow-y-auto rounded-[var(--radius-card)] border border-line bg-surface p-0 text-ink shadow-[var(--shadow-pop)] backdrop:bg-overlay/60"
    >
      <form
        className="p-6"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold">{title}</h2>
            {description && <div className="mt-1 text-sm text-muted">{description}</div>}
          </div>
          <button type="button" className="icon-btn" aria-label="Close" disabled={busy} onClick={onClose}>
            <CloseIcon size={16} />
          </button>
        </div>
        <div className="mt-5 space-y-4">{children}</div>
        {error && (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-[var(--radius-control)] bg-bad-soft px-4 py-3 text-sm text-bad">
            <AlertIcon size={18} className="mt-px shrink-0" /> {error}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" disabled={busy} onClick={onClose}>Cancel</button>
          <button className={destructive ? "btn bg-bad text-surface hover:bg-bad/90 disabled:hover:bg-bad" : "btn"} disabled={busy || !canSubmit}>
            {busy ? busyLabel : submitLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}

/**
 * A temporary password, shown once to the person who made it, to pass on. Only its hash is kept, so it can't be
 * shown again; a new one can be issued instead.
 */
export function TemporaryPasswordNotice({ temp, who, className = "" }: { temp: TemporaryPassword; who: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div role="status" className={`rounded-[var(--radius-card)] border border-line bg-warn-soft p-4 sm:p-5 ${className}`}>
      <p className="flex items-center gap-2 font-bold text-ink">
        <KeyIcon size={18} className="shrink-0 text-warn" /> Temporary password for {who}
      </p>
      <p className="mt-1 text-sm text-ink-soft">Pass it on now: it won&apos;t be shown again.</p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-x-6">
        <dt className="text-sm text-muted">Email</dt>
        <dd className="font-semibold [overflow-wrap:anywhere]">{temp.email}</dd>
        <dt className="text-sm text-muted sm:self-center">Password</dt>
        <dd className="flex items-center gap-2">
          <code className="rounded-[var(--radius-control)] bg-surface px-3 py-2 font-mono text-lg tracking-wider ring-1 ring-line">{temp.password}</code>
          <button
            type="button"
            className="icon-btn"
            aria-label={copied ? "Password copied" : "Copy password"}
            title="Copy password"
            onClick={() =>
              void navigator.clipboard?.writeText(temp.password).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              })
            }
          >
            {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
          </button>
        </dd>
      </dl>
      <p className="mt-4 text-sm text-ink-soft">
        Works until {formatDateTime(temp.expiresAt)}. They sign in with &ldquo;Email &amp; password&rdquo; and must choose their own password before
        anything else opens.
      </p>
    </div>
  );
}
