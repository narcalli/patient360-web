"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AlertIcon, CheckIcon, ChevronLeft, ChevronRight, DownloadIcon, InfoIcon, PlusIcon, ReplaceIcon } from "@/components/icons";
import { EmptyState, ErrorBanner, FormDialog, PageHeader, RowsSkeleton, SelectField, TextField, useToast, useUrlState } from "@/components/staff-ui";
import { api, ApiError, downloadFile, type ImportRuleColumn, type ImportRuleList, type ImportRuleView } from "@/lib/api";
import { importError, plural } from "@/lib/imports";

/**
 * Import rules: first make a rule for an import, then add inside it what each column of the Excel sheet means. Every
 * change is saved as it is made, so there is nothing to remember to save. Nobody here needs to know where the data is
 * stored: a column goes to a patient field.
 */
export default function ImportRulesPage() {
  return (
    <Suspense>
      <ImportRules />
    </Suspense>
  );
}

const asBody = (columns: Pick<ImportRuleColumn, "sheetColumn" | "fieldCode" | "required" | "aliases">[]) => ({
  columns: columns.map(({ sheetColumn, fieldCode, required, aliases }) => ({ sheetColumn, fieldCode, required, aliases })),
});

function ImportRules() {
  const { params, set } = useUrlState();
  const ruleId = Number(params.get("rule")) || null;
  return ruleId ? <RuleDetail ruleId={ruleId} onBack={() => set({ rule: null })} /> : <RuleList onOpen={(id) => set({ rule: String(id) })} />;
}

/** Every rule, and the way to make a new one. */
function RuleList({ onOpen }: { onOpen: (ruleId: number) => void }) {
  const [list, setList] = useState<ImportRuleList | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.get<ImportRuleList>("/admin/imports/rules").then(setList, () => setError(true));
  }, [attempt]);

  return (
    <>
      <Link href="/admin/actions" className="btn-ghost -ml-3 mb-2">
        <ChevronLeft size={16} /> Admin Actions
      </Link>
      <PageHeader
        title="Import rules"
        description="Make a rule for each kind of Excel sheet you upload, then add the columns it should read and where each value is saved on the patient's record. You choose the rule when you upload a sheet."
        actions={
          <button type="button" className="btn" disabled={!list?.types.length} onClick={() => setCreating(true)}>
            <PlusIcon size={18} /> Create a rule
          </button>
        }
      />
      <div className="mt-6 max-w-3xl" aria-busy={!list && !error}>
        {error ? (
          <ErrorBanner text="We couldn't load the import rules. Check your connection." onRetry={() => { setError(false); setAttempt((n) => n + 1); }} />
        ) : !list ? (
          <RowsSkeleton />
        ) : list.rules.length === 0 ? (
          <EmptyState icon={<ReplaceIcon size={22} />} title="No rules yet">
            Create a rule first. You can then add the columns your Excel sheet has.
          </EmptyState>
        ) : (
          <ul className="card divide-y divide-line">
            {list.rules.map((r) => (
              <li key={r.id}>
                <button type="button" className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-subtle" onClick={() => onOpen(r.id)}>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold [overflow-wrap:anywhere]">{r.name}</span>
                    <span className="block text-sm text-muted">For {r.type.label} · {plural(r.columnCount, "column")} added</span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {creating && list && (
        <CreateRuleDialog types={list.types} onClose={() => setCreating(false)} onCreated={onOpen} />
      )}
    </>
  );
}

function CreateRuleDialog({ types, onClose, onCreated }: { types: ImportRuleList["types"]; onClose: () => void; onCreated: (ruleId: number) => void }) {
  const [typeCode, setTypeCode] = useState(types[0]!.code);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  async function save() {
    setTried(true);
    if (name.trim().length < 2) return;
    setBusy(true);
    setFailure(null);
    try {
      const rule = await api.post<ImportRuleView>("/admin/imports/rules", { typeCode, name: name.trim() });
      onCreated(rule.id);
    } catch (err) {
      setFailure(err instanceof ApiError ? importError(err.code, err.body.message) : importError(""));
      setBusy(false);
    }
  }

  return (
    <FormDialog title="Create a rule" description="Next, you'll add the Excel columns inside it." submitLabel="Create rule" busyLabel="Creating…" busy={busy} error={failure} onSubmit={() => void save()} onClose={onClose}>
      <SelectField label="Which import is this rule for?" value={typeCode} onChange={setTypeCode} options={types.map((t) => [t.code, t.label])} />
      <TextField label="Rule name" value={name} maxLength={100} autoComplete="off" hint="Name it after the sheet, like: Billing sheet" error={tried && name.trim().length < 2 ? "Give the rule a name, at least 2 letters." : null} onChange={setName} />
    </FormDialog>
  );
}

/** One rule: the columns inside it. */
function RuleDetail({ ruleId, onBack }: { ruleId: number; onBack: () => void }) {
  const [rule, setRule] = useState<ImportRuleView | null>(null);
  const [error, setError] = useState(false);
  const [gone, setGone] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState<ImportRuleColumn | "new" | null>(null);
  const [removing, setRemoving] = useState<ImportRuleColumn | null>(null);
  const [busy, setBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      setRule(await api.get<ImportRuleView>(`/admin/imports/rules/${ruleId}`));
      setError(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setGone(true);
      else setError(true);
    }
  }, [ruleId]);

  async function deleteRule() {
    setBusy(true);
    setRemoveError(null);
    try {
      await api.delete(`/admin/imports/rules/${ruleId}`);
      onBack();
    } catch (err) {
      setRemoveError(err instanceof ApiError ? importError(err.code, err.body.message) : importError(""));
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, [load, attempt]);

  async function remove(c: ImportRuleColumn) {
    setBusy(true);
    setRemoveError(null);
    try {
      setRule(await api.put<ImportRuleView>(`/admin/imports/rules/${ruleId}`, asBody(rule!.columns.filter((x) => x.fieldCode !== c.fieldCode))));
      setRemoving(null);
      toast.show(`"${c.sheetColumn}" is no longer imported.`);
    } catch (err) {
      setRemoveError(err instanceof ApiError ? importError(err.code, err.body.message) : importError(""));
    } finally {
      setBusy(false);
    }
  }

  const standard = rule?.standardColumns ?? [];
  const needed = standard.filter((c) => c.required);
  const optional = standard.filter((c) => !c.required);

  return (
    <>
      <button type="button" className="btn-ghost -ml-3 mb-2" onClick={onBack}>
        <ChevronLeft size={16} /> Import rules
      </button>
      <PageHeader
        title={rule?.name ?? "Import rule"}
        description={rule ? `For ${rule.type.label}. Tell the portal what each column in your Excel sheet means, so every value is saved in the right place on the patient's record.` : undefined}
        actions={
          rule && (
            <>
            <button type="button" className="btn-ghost" onClick={() => setRenaming(true)}>Rename</button>
            <button type="button" className="btn-ghost text-bad hover:bg-bad-soft" onClick={() => { setRemoveError(null); setDeleting(true); }}>Delete rule</button>
            <button type="button" className="btn-secondary" onClick={() => void downloadFile(`/admin/imports/rules/${rule.id}/template`, `${rule.type.code.replace(/_/g, "-")}-template.xlsx`)}>
              <DownloadIcon size={18} /> Download template
            </button>
            </>
          )
        }
      />

      <div className="mt-6 max-w-3xl space-y-6" aria-busy={!rule && !error && !gone}>
        {gone ? (
          <EmptyState icon={<ReplaceIcon size={22} />} title="This rule doesn't exist">
            It may have been deleted. Go back to the list of rules to create one.
          </EmptyState>
        ) : error ? (
          <ErrorBanner text="We couldn't load the import rules. Check your connection." onRetry={() => setAttempt((n) => n + 1)} />
        ) : !rule ? (
          <RowsSkeleton />
        ) : (
          <>
            <section aria-labelledby="extra" className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h2 id="extra" className="text-base font-bold">Columns you have added</h2>
                  <p className="mt-1 text-sm text-ink-soft">Each one says: when a sheet has this column, save its value on the patient as this piece of information.</p>
                </div>
                <button type="button" className="btn" onClick={() => setEditing("new")}>
                  <PlusIcon size={18} /> Add a column
                </button>
              </div>
              {rule.columns.length === 0 ? (
                <div className="mt-4">
                  <EmptyState icon={<ReplaceIcon size={22} />} title="No columns added yet">
                    Add one when your sheet has a column the portal doesn&rsquo;t know about, like a billing ID.
                  </EmptyState>
                </div>
              ) : (
                <ul className="mt-4 divide-y divide-line rounded-[var(--radius-control)] border border-line">
                  {rule.columns.map((c) => (
                    <li key={c.fieldCode} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                      <div className="min-w-0 flex-[1_1_16rem]">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <p className="min-w-0">
                            <span className="block text-xs text-muted">Excel column</span>
                            <span className="font-bold [overflow-wrap:anywhere]">{c.sheetColumn}</span>
                          </p>
                          <ChevronRight size={16} className="shrink-0 text-muted" aria-hidden="true" />
                          <p className="min-w-0">
                            <span className="block text-xs text-muted">Saved on the patient as</span>
                            <span className="font-semibold [overflow-wrap:anywhere]">{c.fieldLabel}</span>
                          </p>
                        </div>
                        {c.aliases.length > 0 && <p className="mt-0.5 text-sm text-muted [overflow-wrap:anywhere]">Also accepted: {c.aliases.join(", ")}</p>}
                      </div>
                      <span className={`badge ${c.required ? "bg-warn-soft text-warn" : "bg-subtle text-ink-soft ring-1 ring-line ring-inset"}`}>{c.required ? "Must be in the sheet" : "Optional"}</span>
                      <div className="flex gap-1">
                        <button type="button" className="btn-ghost" aria-label={`Change ${c.sheetColumn}`} onClick={() => setEditing(c)}>Change</button>
                        <button type="button" className="btn-ghost text-bad hover:bg-bad-soft" aria-label={`Remove ${c.sheetColumn}`} onClick={() => { setRemoveError(null); setRemoving(c); }}>Remove</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="happens" className="card p-5">
              <h2 id="happens" className="flex items-center gap-2 text-base font-bold">
                <InfoIcon size={18} className="shrink-0 text-brand" /> What happens when a sheet is uploaded
              </h2>
              <ul className="mt-3 space-y-3 text-sm">
                <Outcome bad title="A column marked &ldquo;Must be in the sheet&rdquo; is missing">The whole sheet is refused, and nothing is imported. Add the column and upload it again.</Outcome>
                <Outcome title="A value is empty or wrong in one of your added columns">The patient is still imported, without that one value. You see it listed under &ldquo;Value left out&rdquo; on the import.</Outcome>
                <Outcome title="A column isn't on this page">It is ignored. Nothing from that column is saved.</Outcome>
              </ul>
            </section>

            <section aria-labelledby="standard" className="card p-5">
              <h2 id="standard" className="text-base font-bold">Columns the portal already knows</h2>
              <p className="mt-1 text-sm text-ink-soft">You don&rsquo;t need to add these. Every sheet needs these {plural(needed.length, "column")}.</p>
              <ul className="mt-4 space-y-3 text-sm">
                {needed.map((c) => (
                  <li key={c.header}>
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-bold">{c.header}</span>
                      <span className="badge bg-warn-soft text-warn">Always needed</span>
                      {c.identifies && <span className="badge bg-brand-soft text-ink">Used to recognise the patient</span>}
                    </span>
                    <span className="mt-0.5 block text-muted">{c.hint}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 rounded-[var(--radius-control)] bg-subtle p-3 text-sm text-ink-soft">
                If a patient with the same <strong>name and mobile</strong> is already registered, that row is left out, so nobody is added twice.
              </p>
              {optional.length > 0 && (
                <details className="mt-4 text-sm">
                  <summary className="cursor-pointer font-semibold text-brand">{plural(optional.length, "more column")} you can include if you have them</summary>
                  <ul className="mt-3 space-y-2">
                    {optional.map((c) => (
                      <li key={c.header}>
                        <span className="font-semibold">{c.header}</span>
                        <span className="block text-muted">{c.hint}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </section>
          </>
        )}
      </div>

      {renaming && rule && (
        <RenameDialog
          rule={rule}
          onClose={() => setRenaming(false)}
          onSaved={(next) => {
            setRule(next);
            setRenaming(false);
            toast.show("Rule renamed.");
          }}
        />
      )}
      {deleting && rule && (
        <ConfirmDialog title={`Delete "${rule.name}"?`} confirmLabel="Delete rule" busy={busy} onConfirm={() => void deleteRule()} onCancel={() => setDeleting(false)}>
          <p>Imports not run yet that use it will read only the columns the portal already knows. Values already imported stay on the patients&rsquo; records.</p>
          {removeError && <p role="alert" className="mt-3 font-semibold text-bad">{removeError}</p>}
        </ConfirmDialog>
      )}
      {editing && rule && (
        <ColumnDialog
          rule={rule}
          column={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(next, name) => {
            setRule(next);
            setEditing(null);
            toast.show(`Saved. The next sheet you upload will use "${name}".`);
          }}
        />
      )}
      {removing && (
        <ConfirmDialog title={`Stop importing "${removing.sheetColumn}"?`} confirmLabel="Remove column" busy={busy} onConfirm={() => void remove(removing)} onCancel={() => setRemoving(null)}>
          <p>Future sheets won&rsquo;t save this column. Values already imported stay on the patients&rsquo; records.</p>
          {removeError && <p role="alert" className="mt-3 font-semibold text-bad">{removeError}</p>}
        </ConfirmDialog>
      )}
      {toast.ui}
    </>
  );
}

function RenameDialog({ rule, onClose, onSaved }: { rule: ImportRuleView; onClose: () => void; onSaved: (next: ImportRuleView) => void }) {
  const [name, setName] = useState(rule.name);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  async function save() {
    setTried(true);
    if (name.trim().length < 2) return;
    setBusy(true);
    setFailure(null);
    try {
      onSaved(await api.patch<ImportRuleView>(`/admin/imports/rules/${rule.id}`, { name: name.trim() }));
    } catch (err) {
      setFailure(err instanceof ApiError ? importError(err.code, err.body.message) : importError(""));
      setBusy(false);
    }
  }

  return (
    <FormDialog title="Rename this rule" submitLabel="Save" busy={busy} error={failure} onSubmit={() => void save()} onClose={onClose}>
      <TextField label="Rule name" value={name} maxLength={100} autoComplete="off" error={tried && name.trim().length < 2 ? "Give the rule a name, at least 2 letters." : null} onChange={setName} />
    </FormDialog>
  );
}

function Outcome({ title, bad = false, children }: { title: React.ReactNode; bad?: boolean; children: React.ReactNode }) {
  const Icon = bad ? AlertIcon : CheckIcon;
  return (
    <li className="flex items-start gap-2.5">
      <Icon size={18} className={`mt-0.5 shrink-0 ${bad ? "text-bad" : "text-ok"}`} />
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="text-ink-soft">{children}</span>
      </span>
    </li>
  );
}

/** Add or change one column: which column of the sheet, and what it is on the patient's record. */
function ColumnDialog({ rule, column, onClose, onSaved }: { rule: ImportRuleView; column: ImportRuleColumn | null; onClose: () => void; onSaved: (next: ImportRuleView, name: string) => void }) {
  const [fieldCode, setFieldCode] = useState(column?.fieldCode ?? "");
  const [sheetColumn, setSheetColumn] = useState(column?.sheetColumn ?? "");
  // The column's name follows the chosen field until someone types their own.
  const [typedName, setTypedName] = useState(Boolean(column));
  const [required, setRequired] = useState(column?.required ?? false);
  const [aliases, setAliases] = useState(column?.aliases.join(", ") ?? "");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  // A field may have been added in Patient fields, in another tab, since this page loaded.
  const [availableFields, setAvailableFields] = useState(rule.availableFields);
  const refreshFields = useCallback(async () => {
    setAvailableFields((await api.get<ImportRuleView>(`/admin/imports/rules/${rule.id}`)).availableFields);
  }, [rule.id]);

  const others = rule.columns.filter((c) => c.fieldCode !== column?.fieldCode);
  const usedByOthers = new Set(others.map((c) => c.fieldCode));
  const choices = availableFields.filter((f) => !usedByOthers.has(f.code));
  const chosen = choices.find((f) => f.code === fieldCode);

  function choose(code: string) {
    setFieldCode(code);
    if (!typedName) setSheetColumn(choices.find((f) => f.code === code)?.label ?? "");
  }

  async function save() {
    setTried(true);
    if (!fieldCode || !sheetColumn.trim()) return;
    setBusy(true);
    setFailure(null);
    const mine = { sheetColumn: sheetColumn.trim(), fieldCode, required, aliases: aliases.split(",").map((a) => a.trim()).filter(Boolean) };
    const columns = column ? rule.columns.map((c) => (c.fieldCode === column.fieldCode ? mine : c)) : [...rule.columns, mine];
    try {
      onSaved(await api.put<ImportRuleView>(`/admin/imports/rules/${rule.id}`, asBody(columns)), mine.sheetColumn);
    } catch (err) {
      setFailure(err instanceof ApiError ? importError(err.code, err.body.message) : importError(""));
      setBusy(false);
    }
  }

  return (
    <FormDialog title={column ? `Change "${column.sheetColumn}"` : "Add a column"} submitLabel={column ? "Save" : "Add column"} busy={busy} error={failure} onSubmit={() => void save()} onClose={onClose}>
      <SelectField
        label="What is this information?"
        value={fieldCode}
        onChange={choose}
        onRefresh={refreshFields}
        addLink={{ href: "/admin/actions/patient-fields?add=1", label: "Add a field" }}
        options={choices.map((f) => [f.code, f.label, f.group])}
        placeholder="Choose one…"
        error={tried && !fieldCode ? "Choose what this column holds." : null}
        hint={chosen?.helpText ?? <>Not on the list? <Link href="/admin/actions/patient-fields?add=1" target="_blank" className="font-semibold text-brand underline">Add it in Patient fields</Link>, then come back here.</>}
      />
      <TextField
        label="Column name in your Excel sheet"
        value={sheetColumn}
        maxLength={100}
        autoComplete="off"
        error={tried && !sheetColumn.trim() ? "Type the name at the top of the column." : null}
        hint="Exactly as it is at the top of the column. Capital letters and spaces don't matter."
        onChange={(v) => {
          setTypedName(true);
          setSheetColumn(v);
        }}
      />
      <TextField label="Other names this column might have" optional value={aliases} autoComplete="off" hint="Separate them with commas, like: Bill No, Invoice ID" onChange={setAliases} />
      <fieldset>
        <legend className="text-sm font-semibold">Must every sheet have this column?</legend>
        <div className="mt-2 space-y-2">
          <Choice name="must-have" checked={!required} onSelect={() => setRequired(false)} title="No, it's optional">A sheet without this column still imports.</Choice>
          <Choice name="must-have" checked={required} onSelect={() => setRequired(true)} title="Yes, it must be there">A sheet without this column is refused. If only a few rows have it empty, those patients still import.</Choice>
        </div>
      </fieldset>
    </FormDialog>
  );
}

function Choice({ name, checked, onSelect, title, children }: { name: string; checked: boolean; onSelect: () => void; title: string; children: React.ReactNode }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border p-3 ${checked ? "border-brand bg-brand-soft" : "border-line"}`}>
      <input type="radio" name={name} className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-brand)]" checked={checked} onChange={onSelect} />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-sm text-ink-soft">{children}</span>
      </span>
    </label>
  );
}
