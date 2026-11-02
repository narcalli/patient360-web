"use client";

import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AlertIcon, PlusIcon } from "@/components/icons";
import { AreaField, Check } from "@/components/report-admin-ui";
import type { TabProps } from "@/components/report-admin-reports";
import { EmptyState, FormDialog, SelectField, StatusBadge, TextField } from "@/components/staff-ui";
import { api, ApiError } from "@/lib/api";
import {
  bandIssues,
  bandProblem,
  bandRange,
  BASIS_TEXT,
  monthName,
  parseAmount,
  reportAdminError,
  settingsChanges,
  settingsDraftOf,
  settingsProblem,
  sortedBands,
  wholeNumber,
  type AdminDomain,
  type SettingsDraft,
  type SpendBand,
  type SpendBasis,
} from "@/lib/report-admin";
import { formatRupees } from "@/lib/reports";

const reason = (err: unknown) => reportAdminError(err instanceof ApiError ? err.code : "");

// ─── Groups ──────────────────────────────────────────────────────────────────

export function GroupsTab({ overview, reload, toast }: TabProps) {
  const [editing, setEditing] = useState<AdminDomain | null>(null);
  const groups = [...overview.domains].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));

  if (groups.length === 0) return <EmptyState icon={<AlertIcon size={22} />} title="No groups yet" />;

  return (
    <>
      <p className="mb-3 text-sm text-muted">Groups are the headings on the Analytics page. A group with no reports turned on isn't shown.</p>
      <ul className="card divide-y divide-line">
        {groups.map((g) => (
          <li key={g.code} className={`flex flex-wrap items-center gap-3 px-4 py-4 sm:px-5 ${g.status === "DEACTIVATED" ? "text-muted" : ""}`}>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">{g.label}</p>
              {g.description && <p className="mt-0.5 text-sm text-ink-soft">{g.description}</p>}
              <p className="mt-1 text-xs text-muted">{g.reportCount} {g.reportCount === 1 ? "report" : "reports"} · order {g.sortOrder}</p>
            </div>
            <StatusBadge status={g.status} />
            <button type="button" className="btn-secondary min-h-9 px-3 text-sm" onClick={() => setEditing(g)} aria-label={`Edit ${g.label}`}>Edit</button>
          </li>
        ))}
      </ul>
      {editing && (
        <GroupDialog
          group={editing}
          onClose={() => setEditing(null)}
          onSaved={async (text) => {
            setEditing(null);
            toast(text);
            await reload();
          }}
        />
      )}
    </>
  );
}

function GroupDialog({ group, onClose, onSaved }: { group: AdminDomain; onClose: () => void; onSaved: (text: string) => void }) {
  const [label, setLabel] = useState(group.label);
  const [description, setDescription] = useState(group.description ?? "");
  const [order, setOrder] = useState(String(group.sortOrder));
  const [on, setOn] = useState(group.status === "ACTIVE");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const orderNumber = wholeNumber(order);
  const labelProblem = label.trim().length < 2 || label.trim().length > 80 ? "The name needs 2 to 80 characters." : null;

  async function save() {
    setTried(true);
    if (labelProblem || orderNumber == null) return;
    const body: Record<string, unknown> = {};
    if (label.trim() !== group.label) body.label = label.trim();
    if ((description.trim() || null) !== group.description) body.description = description.trim() || null;
    if (orderNumber !== group.sortOrder) body.sortOrder = orderNumber;
    if (on !== (group.status === "ACTIVE")) body.status = on ? "ACTIVE" : "DEACTIVATED";
    if (Object.keys(body).length === 0) return onClose();
    setBusy(true);
    setFailure(null);
    try {
      await api.patch(`/report-admin/domains/${group.code}`, body);
      onSaved(`"${label.trim()}" is saved.`);
    } catch (err) {
      setFailure(reason(err));
      setBusy(false);
    }
  }

  return (
    <FormDialog title="Edit group" submitLabel="Save" busy={busy} error={failure} onSubmit={save} onClose={onClose}>
      <TextField label="Name" value={label} onChange={setLabel} maxLength={80} error={tried ? labelProblem : null} />
      <AreaField label="Short description" optional value={description} onChange={setDescription} maxLength={300} />
      <TextField label="Order" inputMode="numeric" value={order} onChange={setOrder} hint="Lower numbers come first." error={tried && orderNumber == null ? "Enter a whole number." : null} />
      <Check checked={on} onChange={setOn} title="Show this group in Analytics">
        {!on && group.reportCount > 0 ? `Its ${group.reportCount} ${group.reportCount === 1 ? "report is" : "reports are"} hidden while it is off.` : "Turn off to hide the group and its reports."}
      </Check>
    </FormDialog>
  );
}

// ─── Settings ────────────────────────────────────────────────────────────────

export function SettingsTab({ overview, reload, toast }: TabProps) {
  const settings = overview.settings;
  const start = useMemo(() => settingsDraftOf(settings), [settings]);
  const [draft, setDraft] = useState<SettingsDraft>(start);
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const problem = settingsProblem(draft);
  const changes = settingsChanges(settings, draft);
  const dirty = Object.keys(changes).length > 0;
  const set = <K extends keyof SettingsDraft>(key: K, value: SettingsDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  async function save() {
    setBusy(true);
    setFailure(null);
    try {
      await api.patch("/report-admin/settings", changes);
      setAsking(false);
      toast("The settings are saved.");
      await reload();
    } catch (err) {
      setAsking(false);
      setFailure(reason(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="max-w-xl space-y-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (problem || !dirty) return;
        // The revenue basis changes every number, so it is asked about; the rest save straight away.
        if (changes.spendBasis) setAsking(true);
        else void save();
      }}
    >
      <SelectField
        label="Financial year starts in"
        value={draft.fiscalYearStartMonth}
        onChange={(v) => set("fiscalYearStartMonth", v)}
        options={Array.from({ length: 12 }, (_, i): [string, string] => [String(i + 1), monthName(i + 1)])}
        hint="“Financial year to date” and “Last financial year” start from this month."
      />
      <SelectField
        label="Revenue is counted as"
        value={draft.spendBasis}
        onChange={(v) => set("spendBasis", v as SpendBasis)}
        options={(Object.keys(BASIS_TEXT) as SpendBasis[]).map((k): [string, string] => [k, BASIS_TEXT[k]])}
        hint="Changes the numbers in every report at once, spend bands included."
      />
      <TextField
        label="Spend window, in months"
        optional
        inputMode="numeric"
        value={draft.spendWindowMonths}
        onChange={(v) => set("spendWindowMonths", v)}
        hint="How far back spend is added up for spend bands. Leave empty for all time."
      />
      <TextField
        label="Smallest group shown"
        inputMode="numeric"
        value={draft.minCountThreshold}
        onChange={(v) => set("minCountThreshold", v)}
        hint="Groups with fewer patients than this are merged into “Other”, so no small group stands out. 1 turns it off."
      />
      <div>
        <p className="text-sm font-semibold">Spend is added up</p>
        <p className="mt-1.5 text-sm text-ink-soft">Per patient. Family accounts come later.</p>
      </div>

      {problem && <p role="alert" className="text-sm text-bad">{problem}</p>}
      {failure && <p role="alert" className="flex items-start gap-2 rounded-[var(--radius-control)] bg-bad-soft px-4 py-3 text-sm text-bad"><AlertIcon size={18} className="mt-px shrink-0" /> {failure}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn" disabled={busy || !dirty || problem != null}>{busy ? "Saving…" : "Save settings"}</button>
        <button type="button" className="btn-secondary" disabled={busy || !dirty} onClick={() => setDraft(start)}>Undo changes</button>
      </div>

      {asking && (
        <ConfirmDialog title="Change how revenue is counted?" confirmLabel="Change it" destructive={false} busy={busy} onConfirm={save} onCancel={() => setAsking(false)}>
          Every report will now show revenue as “{BASIS_TEXT[draft.spendBasis]}”. Numbers people saw before will look different.
        </ConfirmDialog>
      )}
    </form>
  );
}

// ─── Spend bands ─────────────────────────────────────────────────────────────

export function BandsTab({ overview, reload, toast }: TabProps) {
  const [editing, setEditing] = useState<SpendBand | "new" | null>(null);
  const [turningOff, setTurningOff] = useState<SpendBand | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const bands = useMemo(() => sortedBands(overview.spendBands), [overview.spendBands]);
  const issues = useMemo(() => bandIssues(overview.spendBands, formatRupees), [overview.spendBands]);

  async function setStatus(b: SpendBand, status: "ACTIVE" | "DEACTIVATED") {
    setBusy(true);
    setFailure(null);
    try {
      await api.patch(`/report-admin/spend-bands/${b.id}`, { status });
      setTurningOff(null);
      toast(status === "ACTIVE" ? `"${b.label}" is back in use.` : `"${b.label}" is turned off.`);
      await reload();
    } catch (err) {
      setTurningOff(null);
      toast(reason(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-xl text-sm text-muted">Spend bands sort patients by how much they spend. Each band includes its lower amount and stops just before its upper amount, so the next band starts where this one ends.</p>
        <button type="button" className="btn" onClick={() => setEditing("new")}>
          <PlusIcon size={18} /> Add a band
        </button>
      </div>

      {issues.length > 0 && (
        <div role="status" className="mb-4 rounded-[var(--radius-control)] bg-warn-soft px-4 py-3 text-sm text-ink">
          <p className="flex items-center gap-2 font-semibold"><AlertIcon size={16} className="shrink-0" /> Check your bands</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-6">
            {issues.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      {bands.length === 0 ? (
        <EmptyState icon={<PlusIcon size={22} />} title="No spend bands yet">
          Add the first band, usually starting from ₹0.
        </EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <caption className="sr-only">Spend bands, lowest first</caption>
            <thead className="border-b border-line-strong text-xs text-muted">
              <tr>
                <th scope="col" className="py-2.5 pr-3 pl-4 text-left font-semibold sm:pl-5">Band</th>
                <th scope="col" className="px-3 py-2.5 text-left font-semibold">Spend</th>
                <th scope="col" className="px-3 py-2.5 text-left font-semibold">Status</th>
                <th scope="col" className="py-2.5 pr-4 pl-3 text-right font-semibold sm:pr-5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {bands.map((b) => (
                <tr key={b.id} className={b.status === "DEACTIVATED" ? "text-muted" : undefined}>
                  <th scope="row" className="py-3 pr-3 pl-4 text-left font-semibold text-ink sm:pl-5">{b.label}</th>
                  <td className="tabular px-3 py-3">{bandRange(b, formatRupees)}</td>
                  <td className="px-3 py-3"><StatusBadge status={b.status} /></td>
                  <td className="py-3 pr-4 pl-3 sm:pr-5">
                    <div className="flex justify-end gap-1.5">
                      <button type="button" className="btn-secondary min-h-9 px-3 text-sm" onClick={() => setEditing(b)} aria-label={`Edit ${b.label}`}>Edit</button>
                      {b.status === "ACTIVE" ? (
                        <button type="button" className="btn-secondary min-h-9 px-3 text-sm" onClick={() => setTurningOff(b)} aria-label={`Turn off ${b.label}`}>Turn off</button>
                      ) : (
                        <button type="button" className="btn-secondary min-h-9 px-3 text-sm" disabled={busy} onClick={() => void setStatus(b, "ACTIVE")} aria-label={`Turn on ${b.label}`}>Turn on</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {failure && <p role="alert" className="mt-3 text-sm text-bad">{failure}</p>}

      {editing && (
        <BandDialog
          band={editing === "new" ? null : editing}
          bands={overview.spendBands}
          onClose={() => setEditing(null)}
          onSaved={async (text) => {
            setEditing(null);
            toast(text);
            await reload();
          }}
        />
      )}
      {turningOff && (
        <ConfirmDialog title={`Turn off “${turningOff.label}”?`} confirmLabel="Turn off" busy={busy} onConfirm={() => void setStatus(turningOff, "DEACTIVATED")} onCancel={() => setTurningOff(null)}>
          Patients who spend {bandRange(turningOff, formatRupees)} will show as “No band set” in the spend report until another band covers that range. You can turn it back on later.
        </ConfirmDialog>
      )}
    </>
  );
}

function BandDialog({ band, bands, onClose, onSaved }: { band: SpendBand | null; bands: SpendBand[]; onClose: () => void; onSaved: (text: string) => void }) {
  const [label, setLabel] = useState(band?.label ?? "");
  const [min, setMin] = useState(band ? String(band.minAmount) : "");
  const [max, setMax] = useState(band?.maxAmount != null ? String(band.maxAmount) : "");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const labelProblem = label.trim().length < 2 || label.trim().length > 60 ? "The name needs 2 to 60 characters." : null;
  const amountProblem = bandProblem(min, max, bands, band?.id, band ? band.status === "ACTIVE" : true);

  async function save() {
    setTried(true);
    if (labelProblem || amountProblem) return;
    const minAmount = parseAmount(min)!;
    const maxAmount = max.trim() ? parseAmount(max)! : null;
    setBusy(true);
    setFailure(null);
    try {
      if (band) await api.patch(`/report-admin/spend-bands/${band.id}`, { label: label.trim(), minAmount, maxAmount });
      else await api.post("/report-admin/spend-bands", { label: label.trim(), minAmount, maxAmount });
      onSaved(`"${label.trim()}" is saved.`);
    } catch (err) {
      setFailure(reason(err));
      setBusy(false);
    }
  }

  return (
    <FormDialog title={band ? "Edit band" : "Add a band"} submitLabel="Save" busy={busy} error={failure} onSubmit={save} onClose={onClose}>
      <TextField label="Name" value={label} onChange={setLabel} maxLength={60} placeholder="For example, Regular" error={tried ? labelProblem : null} />
      <TextField label="From (₹)" inputMode="decimal" value={min} onChange={setMin} hint="Included in this band." error={tried && amountProblem?.includes("lowest amount") ? amountProblem : null} />
      <TextField
        label="Up to (₹)"
        optional
        inputMode="decimal"
        value={max}
        onChange={setMax}
        hint="Not included: the next band starts here. Leave empty for no upper limit."
        error={tried && amountProblem && !amountProblem.includes("lowest amount") ? amountProblem : null}
      />
    </FormDialog>
  );
}
