"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { TemporaryPassword } from "@/lib/api";
import { groupChoices, matchChoices, needsSearch, type Choice } from "@/lib/choices";
import { formatDateTime, humanize } from "@/lib/format";
import { plural } from "@/lib/imports";
import { AlertIcon, CheckIcon, ChevronDown, ClockIcon, CloseIcon, CopyIcon, KeyIcon, PlusIcon, ReplaceIcon, SearchIcon } from "./icons";

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

/**
 * A labelled choice. Up to 10 options it is a native select (keyboard and screen readers work as everywhere else);
 * above that, a button that opens a modal list with a search box, because a long native list is hard to read through.
 */
export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  hint,
  error,
  optional = false,
  disabled = false,
  onRefresh,
  addLink,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** Value, label, and optionally the heading it is listed under. */
  options: Choice[];
  /** Shown as the empty choice. */
  placeholder?: string;
  hint?: React.ReactNode;
  error?: string | null;
  optional?: boolean;
  disabled?: boolean;
  /** Fetches the options again: called when the list is opened, on coming back from another tab, and by its Refresh button. */
  onRefresh?: () => Promise<unknown>;
  /** Where to add an option that isn't listed. Opens in a new tab, so nothing typed here is lost. */
  addLink?: { href: string; label: string };
}) {
  const id = useId();
  const [picking, setPicking] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  // A background refresh that fails just leaves the list as it was.
  const refreshQuietly = useCallback(() => void onRefresh?.().catch(() => {}), [onRefresh]);
  useEffect(() => {
    if (!onRefresh) return;
    window.addEventListener("focus", refreshQuietly);
    return () => window.removeEventListener("focus", refreshQuietly);
  }, [onRefresh, refreshQuietly]);
  const describedBy = error || hint ? `${id}-note` : undefined;
  const chosen = options.find(([v]) => v === value);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold">
        {label} {optional && <span className="font-normal text-muted">(optional)</span>}
      </label>
      {needsSearch(options) ? (
        <button
          ref={trigger}
          id={id}
          type="button"
          className={`field mt-1.5 flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:text-muted ${error ? "border-bad" : ""}`}
          disabled={disabled}
          onClick={() => {
            refreshQuietly();
            setPicking(true);
          }}
          aria-haspopup="dialog"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        >
          <span className={`min-w-0 truncate ${chosen ? "" : "text-placeholder"}`}>{chosen?.[1] ?? placeholder ?? "Choose…"}</span>
          <ChevronDown size={16} className="shrink-0 text-muted" aria-hidden="true" />
        </button>
      ) : (
        <select
          id={id}
          className={`field mt-1.5 ${error ? "border-bad" : ""}`}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onFocus={refreshQuietly}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {groupChoices(options).map(({ group, choices }) => {
            const rows = choices.map(([v, l]) => <option key={v} value={v}>{l}</option>);
            return group ? <optgroup key={group} label={group}>{rows}</optgroup> : rows;
          })}
        </select>
      )}
      <FieldNote id={`${id}-note`} hint={hint} error={error} />
      {picking && (
        <ChoiceDialog
          title={label}
          value={value}
          options={options}
          placeholder={placeholder}
          returnFocus={trigger}
          onRefresh={onRefresh}
          addLink={addLink}
          onPick={(v) => {
            onChange(v);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </div>
  );
}

/**
 * The large modal behind a long SelectField, nearly the whole screen so the options can be read at a glance. Typing
 * filters it; arrow keys and Enter choose without leaving the search box. It sits on the page body because it can open from inside a form, where Enter would otherwise submit that form.
 */
function ChoiceDialog({
  title,
  value,
  options,
  placeholder,
  returnFocus,
  onRefresh,
  addLink,
  onPick,
  onClose,
}: {
  title: string;
  value: string;
  options: Choice[];
  placeholder?: string;
  returnFocus: React.RefObject<HTMLButtonElement | null>;
  onRefresh?: () => Promise<unknown>;
  addLink?: { href: string; label: string };
  onPick: (v: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const listId = useId();
  const [query, setQuery] = useState("");
  const all = useMemo<Choice[]>(() => (placeholder !== undefined ? [["", placeholder], ...options] : options), [options, placeholder]);
  const groups = useMemo(() => groupChoices(matchChoices(all, query)), [all, query]);
  const rows = groups.flatMap((g) => g.choices);
  const [cursor, setActive] = useState(() => Math.max(0, rows.findIndex(([v]) => v === value)));
  // The list can get shorter while it is open, when the options are fetched again.
  const active = Math.max(0, Math.min(cursor, rows.length - 1));
  const optionId = (i: number) => `${listId}-${i}`;
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNote, setRefreshNote] = useState<string | null>(null);

  async function refresh() {
    setRefreshing(true);
    setRefreshNote(null);
    try {
      await onRefresh?.();
      setRefreshNote("List is up to date.");
    } catch {
      setRefreshNote("Couldn't refresh the list. Check your connection.");
    } finally {
      setRefreshing(false);
      searchRef.current?.focus();
    }
  }

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    // showModal focuses the first focusable element (Close); start in the search box instead.
    searchRef.current?.focus();
    // Back to the button once this has gone; while it is open, everything behind it can't take focus.
    return () => returnFocus.current?.focus();
  }, [returnFocus]);

  useEffect(() => {
    listRef.current?.querySelector(`[id="${optionId(active)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (rows.length) setActive((active + (e.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const row = rows[active];
      if (row) onPick(row[0]);
    }
  }

  let index = -1;
  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        // React passes this up to the dialog this one opened from, and Escape should close only this one.
        e.stopPropagation();
        onClose();
      }}
      className="m-auto h-[90dvh] max-h-none w-[90vw] max-w-none rounded-[var(--radius-card)] border border-line bg-surface p-0 text-ink shadow-[var(--shadow-pop)] backdrop:bg-overlay/60"
    >
      <div className="flex h-full flex-col">
        <div className="border-b border-line p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={titleId} className="min-w-0 flex-1 basis-48 text-lg font-bold">{title}</h2>
            {addLink && (
              <a href={addLink.href} target="_blank" rel="noopener" className="btn-secondary">
                <PlusIcon size={18} /> {addLink.label}
              </a>
            )}
            {onRefresh && (
              <button type="button" className="btn-secondary" disabled={refreshing} onClick={() => void refresh()}>
                <ReplaceIcon size={18} /> {refreshing ? "Refreshing…" : "Refresh"}
              </button>
            )}
            <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
              <CloseIcon size={16} />
            </button>
          </div>
          <div className="relative mt-4">
            <SearchIcon size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
            <input
              ref={searchRef}
              type="search"
              className="field pl-10"
              role="combobox"
              aria-label={`Search: ${title}`}
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={rows.length ? optionId(active) : undefined}
              placeholder="Search"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
            />
          </div>
          <p role="status" className="mt-2 text-sm text-muted">
            {rows.length === 0 ? <>Nothing matches &ldquo;{query.trim()}&rdquo;.</> : plural(rows.filter(([v]) => v).length, "option")}
            {refreshNote && ` · ${refreshNote}`}
          </p>
        </div>
        <ul ref={listRef} id={listId} role="listbox" aria-labelledby={titleId} className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          {groups.map(({ group, choices }) => (
            <li key={group ?? ""} role="presentation">
              {group && <p className="eyebrow mb-2" aria-hidden="true">{group}</p>}
              <ul role="group" aria-label={group ?? undefined} className="grid grid-cols-[repeat(auto-fill,minmax(min(15rem,100%),1fr))] gap-2">
                {choices.map(([v, l]) => {
                  const i = ++index;
                  return (
                    <li
                      key={v}
                      id={optionId(i)}
                      role="option"
                      aria-selected={v === value}
                      className={`flex min-h-11 cursor-pointer items-center justify-between gap-2 rounded-[var(--radius-control)] border px-3 py-2 text-sm [overflow-wrap:anywhere] ${v === value ? "border-brand bg-brand-soft font-semibold" : i === active ? "border-line-strong bg-subtle" : "border-line"}`}
                      onMouseMove={() => setActive(i)}
                      onClick={() => onPick(v)}
                    >
                      <span className="min-w-0">{l}</span>
                      {v === value && <CheckIcon size={16} className="shrink-0 text-brand" aria-hidden="true" />}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </dialog>,
    document.body,
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
    d?.querySelector<HTMLElement>('input, select, textarea, [aria-haspopup="dialog"]')?.focus();
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
