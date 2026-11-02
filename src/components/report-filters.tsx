"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { DatePicker } from "@/components/date-picker";
import { useDisclosure } from "@/components/disclosure";
import { CheckIcon, ChevronDown } from "@/components/icons";
import { SelectField } from "@/components/staff-ui";
import { matchChoices, MOST_WITHOUT_SEARCH, type Choice } from "@/lib/choices";
import { customRangeProblem, EMPTY_VIEW, type ReportDetail, type ReportView } from "@/lib/reports";

/** A list of values to tick, for a filter. Opens as a panel under its button; Escape or a click outside closes it. */
function MultiSelect({
  label,
  options,
  value,
  onChange,
  loading,
  failed,
}: {
  label: string;
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  loading: boolean;
  failed: boolean;
}) {
  const d = useDisclosure();
  const [query, setQuery] = useState("");
  const searchId = useId();
  // A value kept from the address that the list no longer has still shows, so it can be unticked.
  const all = useMemo(() => [...new Set([...options, ...value])], [options, value]);
  const shown = useMemo(() => matchChoices(all.map<Choice>((o) => [o, o]), query).map(([v]) => v), [all, query]);
  const summary = value.length === 0 ? "All" : value.length === 1 ? value[0]! : `${value.length} selected`;
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div className="relative min-w-0">
      <span className="block text-sm font-semibold" id={`${searchId}-label`}>
        {label}
      </span>
      <button {...d.buttonProps} aria-labelledby={`${searchId}-label ${searchId}-value`} className="field mt-1.5 flex items-center justify-between gap-2 text-left">
        <span id={`${searchId}-value`} className="truncate">
          {summary}
        </span>
        <ChevronDown size={18} className="shrink-0 text-muted" />
      </button>
      <div
        {...d.panelProps}
        className="absolute top-full left-0 z-30 mt-2 w-full min-w-60 rounded-[var(--radius-card)] border border-line bg-surface p-2 shadow-[var(--shadow-pop)] motion-safe:animate-fade-in"
      >
        {failed ? (
          <p className="px-2 py-2 text-sm text-bad">Couldn&apos;t load the values. Close and try again.</p>
        ) : loading ? (
          <p className="px-2 py-2 text-sm text-muted">Loading…</p>
        ) : all.length === 0 ? (
          <p className="px-2 py-2 text-sm text-muted">No values yet.</p>
        ) : (
          <>
            {all.length > MOST_WITHOUT_SEARCH && (
              <div className="p-1">
                <label htmlFor={searchId} className="sr-only">
                  Search {label}
                </label>
                <input id={searchId} className="field min-h-10" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
            )}
            <ul className="max-h-64 overflow-y-auto" role="group" aria-label={label}>
              {shown.map((v) => (
                <li key={v}>
                  <label className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-md px-2 text-sm hover:bg-subtle">
                    <input type="checkbox" className="h-4 w-4 accent-[var(--color-brand)]" checked={value.includes(v)} onChange={() => toggle(v)} />
                    <span className="min-w-0 flex-1 truncate" title={v}>
                      {v}
                    </span>
                    {value.includes(v) && <CheckIcon size={16} className="shrink-0 text-brand" />}
                  </label>
                </li>
              ))}
              {shown.length === 0 && <li className="px-2 py-2 text-sm text-muted">Nothing matches.</li>}
            </ul>
            <div className="mt-1 flex justify-between border-t border-line pt-1">
              <button type="button" className="btn-ghost" onClick={() => onChange([])} disabled={value.length === 0}>
                Clear
              </button>
              <button type="button" className="btn-ghost" onClick={() => d.close()}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export type FilterOptions = Record<string, { values: string[]; loading: boolean; failed: boolean }>;

/**
 * Period, filters and breakdown for a report. Changes are held until Apply, which puts them in the page address, so
 * a view can be shared and Back returns to the last applied one.
 */
export function ReportFilterBar({
  detail,
  applied,
  options,
  today,
  onApply,
  onReset,
}: {
  detail: ReportDetail;
  applied: ReportView;
  options: FilterOptions;
  today: string;
  onApply: (view: ReportView) => void;
  onReset: () => void;
}) {
  const [draft, setDraft] = useState<ReportView>(applied);
  const [shownError, setShownError] = useState<string | null>(null);
  const appliedKey = JSON.stringify(applied);
  useEffect(() => {
    setDraft(applied);
    setShownError(null);
  }, [appliedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasPeriod = detail.periods.length > 0;
  const period = draft.period || detail.defaultPeriod || "";
  const periodChoices: Choice[] = [...detail.periods.map<Choice>((p) => [p.code, p.label]), ["custom", "Custom range"]];
  const breakdownChoices: Choice[] = [["", "None"], ...detail.breakdowns.map<Choice>((b) => [b.code, b.label])];
  const editable = detail.filters.filter((f) => f.editable);
  const rangeProblem = period === "custom" ? customRangeProblem(draft.from, draft.to) : null;
  const dirty = JSON.stringify(draft) !== appliedKey;
  const touched = JSON.stringify(applied) !== JSON.stringify(EMPTY_VIEW);

  function apply(e: React.FormEvent) {
    e.preventDefault();
    if (rangeProblem) {
      setShownError(rangeProblem);
      return;
    }
    setShownError(null);
    onApply({ ...draft, period: period === detail.defaultPeriod ? "" : period });
  }

  return (
    <form onSubmit={apply} className="card p-4 sm:p-5" aria-label="Report filters">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {hasPeriod && <SelectField label="Period" value={period} onChange={(v) => setDraft({ ...draft, period: v })} options={periodChoices} />}
        {hasPeriod && period === "custom" && (
          <>
            <DatePicker label="From" value={draft.from} onChange={(v) => setDraft({ ...draft, from: v })} max={draft.to || today} today={today} error={shownError && !draft.from ? shownError : null} />
            <DatePicker label="To" value={draft.to} onChange={(v) => setDraft({ ...draft, to: v })} min={draft.from || undefined} max={today} today={today} error={shownError && draft.from ? shownError : null} />
          </>
        )}
        {editable.map((f) => {
          const o = options[f.column];
          return (
            <MultiSelect
              key={f.column}
              label={f.label}
              options={o?.values ?? []}
              value={draft.filters[f.column] ?? []}
              loading={!o || o.loading}
              failed={!!o?.failed}
              onChange={(v) => setDraft({ ...draft, filters: { ...draft.filters, [f.column]: v } })}
            />
          );
        })}
        {detail.breakdowns.length > 0 && (
          <SelectField label="Break down by" value={draft.breakdown} onChange={(v) => setDraft({ ...draft, breakdown: v })} options={breakdownChoices} />
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="submit" className="btn" disabled={!dirty && !shownError}>
          Apply
        </button>
        <button type="button" className="btn-secondary" onClick={onReset} disabled={!touched && !dirty}>
          Reset
        </button>
        {shownError && (
          <span role="alert" className="text-sm text-bad">
            {shownError}
          </span>
        )}
      </div>
    </form>
  );
}
