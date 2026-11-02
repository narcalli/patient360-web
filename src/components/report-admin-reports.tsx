"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AreaField, Check } from "@/components/report-admin-ui";
import { ChevronDown, ChevronLeft, ClipboardIcon, CopyIcon, InfoIcon } from "@/components/icons";
import { EmptyState, ErrorBanner, FormDialog, RowsSkeleton, SelectField, StatusBadge, TextField } from "@/components/staff-ui";
import { api, ApiError } from "@/lib/api";
import {
  accessText,
  changesOf,
  draftOf,
  moveItem,
  reportAdminError,
  reportTextProblem,
  setupBody,
  setupChanged,
  toggleShown,
  wholeNumber,
  type AdminReport,
  type ReportAdminOverview,
  type ReportSetup,
  type SetupFilter,
  type SetupMetric,
} from "@/lib/report-admin";

const reason = (err: unknown) => reportAdminError(err instanceof ApiError ? err.code : "");

export interface TabProps {
  overview: ReportAdminOverview;
  reload: () => Promise<void>;
  toast: (text: string) => void;
}

// ─── The list of reports ─────────────────────────────────────────────────────

export function ReportsTab({ overview, reload, toast, onSetup }: TabProps & { onSetup: (code: string) => void }) {
  const [editing, setEditing] = useState<AdminReport | null>(null);
  const [cloning, setCloning] = useState<AdminReport | null>(null);
  const reports = useMemo(
    () =>
      [...overview.reports].sort(
        (a, b) => (overview.domains.find((d) => d.code === a.domain.code)?.sortOrder ?? 0) - (overview.domains.find((d) => d.code === b.domain.code)?.sortOrder ?? 0) || a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
      ),
    [overview],
  );

  if (reports.length === 0) {
    return (
      <EmptyState icon={<ClipboardIcon size={22} />} title="No reports yet">
        Reports appear here once they are added to the portal.
      </EmptyState>
    );
  }

  return (
    <>
      <p className="mb-3 text-sm text-muted">Turn a report off to hide it from Analytics. Built-in reports can be renamed and moved, but their numbers are locked: make a copy to change those.</p>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[52rem] border-collapse text-sm">
          <caption className="sr-only">Reports</caption>
          <thead className="border-b border-line-strong text-xs text-muted">
            <tr>
              <th scope="col" className="py-2.5 pr-3 pl-4 text-left font-semibold sm:pl-5">Report</th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold">Group</th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold">Period</th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold">Who can open it</th>
              <th scope="col" className="px-3 py-2.5 text-left font-semibold">Status</th>
              <th scope="col" className="px-3 py-2.5 text-right font-semibold">Order</th>
              <th scope="col" className="py-2.5 pr-4 pl-3 text-right font-semibold sm:pr-5"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {reports.map((r) => (
              <tr key={r.code} className={r.status === "DEACTIVATED" ? "text-muted" : undefined}>
                <th scope="row" className="py-3 pr-3 pl-4 text-left font-medium sm:pl-5">
                  <span className="block font-semibold text-ink">{r.label}</span>
                  <span className="mt-0.5 block max-w-xs text-xs font-normal text-muted">{r.question}</span>
                  <span className="mt-1.5 flex flex-wrap gap-1.5">
                    <span className="badge bg-subtle text-ink-soft">{r.isSystem ? "Built in" : r.clonedFrom ? `Copy of ${overview.reports.find((x) => x.code === r.clonedFrom)?.label ?? r.clonedFrom}` : "Copy"}</span>
                    <span className="badge bg-subtle text-ink-soft">{r.metricCount} {r.metricCount === 1 ? "number" : "numbers"}</span>
                  </span>
                </th>
                <td className="px-3 py-3 align-top">{r.domain.label}</td>
                <td className="px-3 py-3 align-top">{r.canHavePeriod ? (r.defaultPeriod?.label ?? "None") : "Follows spend window"}</td>
                <td className="px-3 py-3 align-top">{accessText(r.permissionCode, overview.permissions)}</td>
                <td className="px-3 py-3 align-top"><StatusBadge status={r.status} /></td>
                <td className="tabular px-3 py-3 text-right align-top">{r.sortOrder}</td>
                <td className="py-3 pr-4 pl-3 align-top sm:pr-5">
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <button type="button" className="btn-secondary min-h-9 px-3 text-sm" onClick={() => setEditing(r)} aria-label={`Edit ${r.label}`}>Edit</button>
                    <button type="button" className="btn-secondary min-h-9 px-3 text-sm" onClick={() => onSetup(r.code)} aria-label={`Set up ${r.label}`}>Set up</button>
                    <button type="button" className="btn-secondary min-h-9 px-3 text-sm" onClick={() => setCloning(r)} aria-label={`Make a copy of ${r.label}`}>
                      <CopyIcon size={14} /> Copy
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditReportDialog
          report={editing}
          overview={overview}
          onClose={() => setEditing(null)}
          onSaved={async (text) => {
            setEditing(null);
            toast(text);
            await reload();
          }}
        />
      )}
      {cloning && (
        <CloneDialog
          report={cloning}
          onClose={() => setCloning(null)}
          onCloned={async (code) => {
            setCloning(null);
            toast("The copy is ready and turned off. Set it up, then turn it on.");
            await reload();
            onSetup(code);
          }}
        />
      )}
    </>
  );
}

// ─── Edit a report ───────────────────────────────────────────────────────────

function EditReportDialog({ report, overview, onClose, onSaved }: { report: AdminReport; overview: ReportAdminOverview; onClose: () => void; onSaved: (text: string) => void }) {
  const before = useMemo(() => draftOf(report), [report]);
  const [label, setLabel] = useState(before.label);
  const [question, setQuestion] = useState(before.question);
  const [domain, setDomain] = useState(before.domain);
  const [period, setPeriod] = useState(before.defaultPeriod ?? "");
  const [access, setAccess] = useState(before.permissionCode ?? "");
  const [on, setOn] = useState(before.status === "ACTIVE");
  const [order, setOrder] = useState(String(before.sortOrder));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const orderNumber = wholeNumber(order);
  const textProblem = reportTextProblem(label, question);
  const groups = overview.domains.filter((d) => d.status === "ACTIVE" || d.code === report.domain.code);

  async function save() {
    setTried(true);
    if (textProblem || orderNumber == null) return;
    const changes = changesOf(before, {
      label: label.trim(),
      question: question.trim(),
      domain,
      defaultPeriod: report.canHavePeriod ? period || null : before.defaultPeriod,
      permissionCode: access || null,
      status: on ? "ACTIVE" : "DEACTIVATED",
      sortOrder: orderNumber,
    });
    if (Object.keys(changes).length === 0) return onClose();
    setBusy(true);
    setFailure(null);
    try {
      await api.patch(`/report-admin/reports/${report.code}`, changes);
      onSaved(`"${label.trim()}" is saved.`);
    } catch (err) {
      setFailure(reason(err));
      setBusy(false);
    }
  }

  return (
    <FormDialog title="Edit report" description={report.isSystem ? "A built-in report: its numbers stay as they are." : undefined} submitLabel="Save" busy={busy} error={failure} onSubmit={save} onClose={onClose}>
      <TextField label="Name" value={label} onChange={setLabel} maxLength={100} error={tried && textProblem?.startsWith("The name") ? textProblem : null} />
      <AreaField label="The question it answers" value={question} onChange={setQuestion} maxLength={300} hint="Shown under the report's name." error={tried && textProblem?.startsWith("The question") ? textProblem : null} />
      <SelectField label="Group" value={domain} onChange={setDomain} options={groups.map((d) => [d.code, d.status === "ACTIVE" ? d.label : `${d.label} (off)`])} />
      <SelectField
        label="Period when it opens"
        value={report.canHavePeriod ? period : ""}
        onChange={setPeriod}
        options={overview.periods.map((p) => [p.code, p.label])}
        placeholder={report.canHavePeriod ? "None" : "Not used"}
        disabled={!report.canHavePeriod}
        hint={report.canHavePeriod ? undefined : "This report has no date to filter by. It follows the spend window in Settings."}
      />
      <SelectField label="Who can open it" value={access} onChange={setAccess} options={overview.permissions.map((p) => [p.code, p.label])} placeholder="Everyone with Analytics" />
      <TextField label="Order" inputMode="numeric" value={order} onChange={setOrder} hint="Lower numbers come first within the group." error={tried && orderNumber == null ? "Enter a whole number." : null} />
      <Check checked={on} onChange={setOn} title="Show this report in Analytics">Turn off to hide it without losing it.</Check>
    </FormDialog>
  );
}

// ─── Make a copy ─────────────────────────────────────────────────────────────

export function CloneDialog({ report, onClose, onCloned }: { report: Pick<AdminReport, "code" | "label">; onClose: () => void; onCloned: (code: string) => void }) {
  const [label, setLabel] = useState(`${report.label} (copy)`);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [tried, setTried] = useState(false);
  const length = label.trim().length;
  const problem = length < 2 || length > 100 ? "The name needs 2 to 100 characters." : null;

  async function run() {
    setTried(true);
    if (problem) return;
    setBusy(true);
    setFailure(null);
    try {
      const out = await api.post<{ code: string }>(`/report-admin/reports/${report.code}/clone`, { label: label.trim() });
      onCloned(out.code);
    } catch (err) {
      setFailure(reason(err));
      setBusy(false);
    }
  }

  return (
    <FormDialog title="Make a copy" description={`A copy of “${report.label}” that you can change. It starts turned off.`} submitLabel="Make a copy" busyLabel="Copying…" busy={busy} error={failure} onSubmit={run} onClose={onClose}>
      <TextField label="Name of the copy" value={label} onChange={setLabel} maxLength={100} error={tried ? problem : null} />
    </FormDialog>
  );
}

// ─── Set up a report: which numbers, and which filters ──────────────────────

export function SetupPanel({ code, overview, reload, toast, onBack, onOpen }: TabProps & { code: string; onBack: () => void; onOpen: (code: string) => void }) {
  const [setup, setSetup] = useState<ReportSetup | null>(null);
  const [metrics, setMetrics] = useState<SetupMetric[]>([]);
  const [filters, setFilters] = useState<SetupFilter[]>([]);
  const [saved, setSaved] = useState<ReturnType<typeof setupBody> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [cloning, setCloning] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const apply = useCallback((s: ReportSetup) => {
    setSetup(s);
    setMetrics(s.metrics);
    setFilters(s.filters);
    setSaved(setupBody(s.metrics, s.filters));
  }, []);

  useEffect(() => {
    let live = true;
    setSetup(null);
    setError(null);
    api
      .get<ReportSetup>(`/report-admin/reports/${code}/setup`)
      .then((s) => live && apply(s))
      .catch((err) => live && setError(err instanceof ApiError && err.status === 404 ? "That report no longer exists." : reason(err)));
    return () => {
      live = false;
    };
  }, [code, attempt, apply]);

  const report = overview.reports.find((r) => r.code === code);
  const body = useMemo(() => setupBody(metrics, filters), [metrics, filters]);
  const dirty = saved != null && setupChanged(saved, body);
  const locked = setup?.isSystem ?? true;
  const noneShown = body.metrics.length === 0;

  const setMetric = (i: number, change: (m: SetupMetric) => SetupMetric) => setMetrics((all) => all.map((m, j) => (j === i ? change(m) : m)));
  const setFilter = (i: number, change: (f: SetupFilter) => SetupFilter) => setFilters((all) => all.map((f, j) => (j === i ? change(f) : f)));

  async function save() {
    if (locked || noneShown) return;
    setBusy(true);
    setFailure(null);
    try {
      apply(await api.put<ReportSetup>(`/report-admin/reports/${code}/setup`, body));
      toast("The setup is saved.");
      await reload();
    } catch (err) {
      setFailure(reason(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="btn-ghost -ml-3 mb-2" onClick={onBack}>
        <ChevronLeft size={16} /> All reports
      </button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold">Set up {setup?.label ?? report?.label ?? "report"}</h2>
          <p className="mt-1 text-sm text-muted">Choose which numbers it shows, in what order, and which filters people get.</p>
        </div>
        <Link href={`/admin/analytics/report?code=${encodeURIComponent(code)}`} className="btn-secondary">Open the report</Link>
      </div>

      <div className="mt-6 max-w-3xl space-y-8">
        {error && <ErrorBanner text={error} onRetry={() => setAttempt((n) => n + 1)} />}
        {!error && !setup && <RowsSkeleton rows={4} />}

        {setup && (
          <>
            {locked && (
              <div role="status" className="flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] bg-subtle px-4 py-3 text-sm">
                <InfoIcon size={18} className="shrink-0 text-muted" />
                <span className="min-w-0 flex-1">This is a built-in report, so its setup is locked. Make a copy to change it.</span>
                <button type="button" className="btn-secondary" onClick={() => setCloning(true)}>Clone to change</button>
              </div>
            )}

            <section aria-labelledby="setup-numbers">
              <h3 id="setup-numbers" className="font-bold">Numbers</h3>
              <p className="mt-0.5 text-sm text-muted">Tick the numbers to show. “Headline” puts a number in the row of big tiles at the top.</p>
              <ul className="mt-3 divide-y divide-line card">
                {metrics.map((m, i) => {
                  const shownCount = metrics.filter((x) => x.shown).length;
                  return (
                    <li key={m.code} className={`flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:px-5 ${m.shown ? "" : "bg-subtle/50"}`}>
                      <div className="flex shrink-0 gap-1">
                        <button type="button" className="icon-btn !h-9 !w-9" aria-label={`Move ${m.label} up`} disabled={locked || i === 0} onClick={() => setMetrics((all) => moveItem(all, i, -1))}>
                          <ChevronDown size={16} className="rotate-180" />
                        </button>
                        <button type="button" className="icon-btn !h-9 !w-9" aria-label={`Move ${m.label} down`} disabled={locked || i === metrics.length - 1} onClick={() => setMetrics((all) => moveItem(all, i, 1))}>
                          <ChevronDown size={16} />
                        </button>
                      </div>
                      <div className="min-w-0 flex-1 space-y-3">
                        <Check checked={m.shown} disabled={locked || (m.shown && shownCount === 1)} onChange={(on) => setMetric(i, (x) => toggleShown(x, on))} title={m.label}>
                          {m.definition}
                        </Check>
                        {m.shown && (
                          <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
                            <Check checked={m.isKpi} disabled={locked} onChange={(on) => setMetric(i, (x) => ({ ...x, isKpi: on }))} title="Headline" />
                            <TextField label="Show it as" optional disabled={locked} value={m.labelOverride ?? ""} maxLength={100} placeholder={m.label} onChange={(v) => setMetric(i, (x) => ({ ...x, labelOverride: v }))} />
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {noneShown && !locked && <p role="alert" className="mt-2 text-sm text-bad">{reportAdminError("NEEDS_A_METRIC")}</p>}
            </section>

            <section aria-labelledby="setup-filters">
              <h3 id="setup-filters" className="font-bold">Filters</h3>
              <p className="mt-0.5 text-sm text-muted">What people can narrow the report by. A starting value applies each time the report opens.</p>
              {filters.length === 0 ? (
                <p className="mt-3 text-sm text-muted">This report has no filters.</p>
              ) : (
                <ul className="mt-3 divide-y divide-line card">
                  {filters.map((f, i) => (
                    <li key={f.column} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:px-5">
                      <Check checked={f.isUserEditable} disabled={locked} onChange={(on) => setFilter(i, (x) => ({ ...x, isUserEditable: on }))} title={f.label}>
                        People can change it
                      </Check>
                      <TextField label="Starting value" optional disabled={locked} value={f.defaultValue ?? ""} maxLength={200} hint="Separate several with commas." onChange={(v) => setFilter(i, (x) => ({ ...x, defaultValue: v }))} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {!locked && (
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="btn" disabled={busy || !dirty || noneShown} onClick={save}>{busy ? "Saving…" : "Save setup"}</button>
                <button type="button" className="btn-secondary" disabled={busy || !dirty} onClick={() => saved && setup && apply(setup)}>Undo changes</button>
                {dirty && <span className="text-sm text-muted">You have changes that aren't saved.</span>}
              </div>
            )}
            {failure && <ErrorBanner text={failure} />}
          </>
        )}
      </div>

      {cloning && setup && (
        <CloneDialog
          report={{ code: setup.code, label: setup.label }}
          onClose={() => setCloning(false)}
          onCloned={async (copy) => {
            setCloning(false);
            toast("The copy is ready and turned off. Set it up, then turn it on.");
            await reload();
            onOpen(copy);
          }}
        />
      )}
    </>
  );
}
