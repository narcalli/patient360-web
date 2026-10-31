"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ChevronDown, ChevronLeft, ChevronRight, ClipboardIcon, CloseIcon, EyeIcon, PlusIcon, SearchIcon, ShieldIcon, UndoIcon } from "@/components/icons";
import { EmptyState, ErrorBanner, FormDialog, PageHeader, RowsSkeleton, SelectField, TextField, useToast, useUrlState } from "@/components/staff-ui";
import { api, ApiError, type CatalogDataType, type CatalogField, type CatalogFieldDetail, type CatalogGroup } from "@/lib/api";
import { ANSWER_KIND, answerKind, canHoldSeveral, catalogError, fieldLockNote, fieldMatches, fieldSummary, hasLengthLimit, isNumeric } from "@/lib/catalog";
import { plural } from "@/lib/imports";
import { can } from "@/lib/session";
import { useSessionContext } from "@/lib/use-session";

/**
 * Patient fields: what information the hospital keeps about each patient, sorted into sections. Written for someone who
 * has never seen a database: people give things names, and the portal looks after whatever is behind them.
 */
export default function PatientFieldsPage() {
  return (
    <Suspense>
      <PatientFields />
    </Suspense>
  );
}

const reason = (err: unknown) => (err instanceof ApiError ? catalogError(err.code, err.body) : catalogError(""));

function PatientFields() {
  const session = useSessionContext();
  const canManage = can(session, "catalog.manage");
  const [groups, setGroups] = useState<CatalogGroup[] | null>(null);
  const [fields, setFields] = useState<CatalogField[] | null>(null);
  const [types, setTypes] = useState<CatalogDataType[]>([]);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [showRetired, setShowRetired] = useState(false);
  const [editing, setEditing] = useState<CatalogField | "new" | null>(null);
  const [newIn, setNewIn] = useState<string | null>(null);
  const [section, setSection] = useState<CatalogGroup | "new" | null>(null);
  const [retiring, setRetiring] = useState<CatalogField | null>(null);
  const [retireError, setRetireError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { params, set } = useUrlState();

  // Linked from a list of fields elsewhere ("Add a field"): opens straight on the form.
  const askedToAdd = canManage && params.has("add");
  useEffect(() => {
    if (!askedToAdd) return;
    setEditing("new");
    set({ add: null });
  }, [askedToAdd, set]);

  const load = useCallback(async () => {
    try {
      const [g, f, t] = await Promise.all([
        api.get<CatalogGroup[]>("/admin/catalog/groups"),
        api.get<CatalogField[]>("/admin/catalog/fields"),
        api.get<CatalogDataType[]>("/admin/catalog/data-types"),
      ]);
      setGroups(g);
      setFields(f);
      setTypes(t);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, attempt]);

  const searching = query.trim().length > 0;
  const shown = useMemo(() => (fields ?? []).filter((f) => (showRetired ? f.status === "DEACTIVATED" : f.status === "ACTIVE") && fieldMatches(f, query)), [fields, showRetired, query]);
  const retiredCount = (fields?.filter((f) => f.status === "DEACTIVATED").length ?? 0) + (groups?.filter((g) => g.status === "DEACTIVATED").length ?? 0);
  const activeGroups = groups?.filter((g) => g.status === "ACTIVE") ?? [];
  const listed = (groups ?? []).filter((g) => (showRetired || searching ? shown.some((f) => f.group.code === g.code) : g.status === "ACTIVE") || (showRetired && !searching && g.status === "DEACTIVATED"));

  async function retire(f: CatalogField) {
    setBusy(true);
    setRetireError(null);
    try {
      await api.post(`/admin/catalog/fields/${f.code}/retire`);
      setRetiring(null);
      toast.show(`"${f.label}" is no longer in use. Answers already saved are kept.`);
      await load();
    } catch (err) {
      setRetireError(reason(err));
    } finally {
      setBusy(false);
    }
  }

  async function restore(f: CatalogField) {
    try {
      await api.post(`/admin/catalog/fields/${f.code}/restore`);
      toast.show(`"${f.label}" is back in use.`);
      await load();
    } catch (err) {
      toast.show(reason(err));
    }
  }

  async function restoreSection(g: CatalogGroup) {
    try {
      await api.post(`/admin/catalog/groups/${g.code}/restore`);
      toast.show(`"${g.label}" is back in use.`);
      await load();
    } catch (err) {
      toast.show(reason(err));
    }
  }

  return (
    <>
      <Link href="/admin/actions" className="btn-ghost -ml-3 mb-2">
        <ChevronLeft size={16} /> Admin Actions
      </Link>
      <PageHeader
        title="Patient fields"
        description="The information the hospital keeps about each patient, like a form with sections. Add what you need and choose who can see it."
        actions={
          canManage && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary" onClick={() => setSection("new")}>Add a section</button>
              <button type="button" className="btn" onClick={() => { setNewIn(null); setEditing("new"); }}>
                <PlusIcon size={18} /> Add a field
              </button>
            </div>
          )
        }
      />

      <div className="mt-6 max-w-3xl">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[14rem] flex-1">
            <SearchIcon size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
            <input type="search" aria-label="Search fields" className="field pl-11" placeholder="Search, like “billing” or “doctor”" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          {retiredCount > 0 && (
            <button type="button" className="chip" aria-pressed={showRetired} onClick={() => setShowRetired((s) => !s)}>
              No longer in use <span className="tabular">{retiredCount}</span>
            </button>
          )}
        </div>

        <section aria-label="Patient fields" aria-busy={!fields && !error} className="mt-5 space-y-3">
          {error ? (
            <ErrorBanner text="We couldn't load the patient fields. Check your connection." onRetry={() => setAttempt((n) => n + 1)} />
          ) : !fields || !groups ? (
            <RowsSkeleton />
          ) : searching && shown.length === 0 ? (
            <EmptyState icon={<SearchIcon size={22} />} title="Nothing matches that">
              {canManage ? "Try another word, or add it as a new field." : "Try another word."}
            </EmptyState>
          ) : listed.length === 0 ? (
            <EmptyState icon={<ClipboardIcon size={22} />} title={showRetired ? "Nothing here" : "No sections yet"} />
          ) : (
            listed.map((g) => {
              const mine = shown.filter((f) => f.group.code === g.code);
              return (
                <Section
                  key={g.code}
                  group={g}
                  fields={mine}
                  open={searching || showRetired}
                  canManage={canManage}
                  onAdd={() => { setNewIn(g.code); setEditing("new"); }}
                  onEditSection={() => setSection(g)}
                  onRestoreSection={() => void restoreSection(g)}
                  onEdit={setEditing}
                  onRestore={(f) => void restore(f)}
                />
              );
            })
          )}
        </section>
      </div>

      {editing && groups && (
        <FieldDialog
          field={editing === "new" ? null : editing}
          initialGroup={newIn}
          groups={activeGroups}
          types={types}
          onClose={() => setEditing(null)}
          onRetire={(f) => { setEditing(null); setRetireError(null); setRetiring(f); }}
          onSaved={(name) => {
            setEditing(null);
            toast.show(`Saved "${name}".`);
            void load();
          }}
        />
      )}
      {section && (
        <SectionDialog
          group={section === "new" ? null : section}
          onClose={() => setSection(null)}
          onSaved={(text) => {
            setSection(null);
            toast.show(text);
            void load();
          }}
        />
      )}
      {retiring && (
        <ConfirmDialog title={`Stop using "${retiring.label}"?`} confirmLabel="Stop using it" busy={busy} onConfirm={() => void retire(retiring)} onCancel={() => setRetiring(null)}>
          <p>Staff won&rsquo;t be able to fill it in any more. Answers already saved are kept, and you can bring it back at any time.</p>
          {retireError && <p role="alert" className="mt-3 font-semibold text-bad">{retireError}</p>}
        </ConfirmDialog>
      )}
      {toast.ui}
    </>
  );
}

function Section({
  group, fields, open, canManage, onAdd, onEditSection, onRestoreSection, onEdit, onRestore,
}: {
  group: CatalogGroup;
  fields: CatalogField[];
  open: boolean;
  canManage: boolean;
  onAdd: () => void;
  onEditSection: () => void;
  onRestoreSection: () => void;
  onEdit: (f: CatalogField) => void;
  onRestore: (f: CatalogField) => void;
}) {
  const retired = group.status === "DEACTIVATED";
  return (
    <details className="card group/section overflow-hidden" open={open || undefined}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 transition-colors hover:bg-subtle sm:px-5 [&::-webkit-details-marker]:hidden">
        <ChevronDown size={18} className="shrink-0 -rotate-90 text-muted transition-transform group-open/section:rotate-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block font-bold">{group.label}</span>
          {group.description && <span className="block text-sm text-ink-soft">{group.description}</span>}
        </span>
        <span className="shrink-0 text-sm text-muted">{plural(fields.length, "field")}</span>
      </summary>
      <div className="border-t border-line">
        {fields.length === 0 ? (
          <p className="px-5 py-4 text-sm text-ink-soft">{retired ? "This section is no longer in use." : "Nothing in this section yet."}</p>
        ) : (
          <ul className="divide-y divide-line">
            {fields.map((f) => <FieldLine key={f.code} field={f} canManage={canManage} onEdit={() => onEdit(f)} onRestore={() => onRestore(f)} />)}
          </ul>
        )}
        {canManage && (
          <div className="flex flex-wrap gap-1 border-t border-line bg-subtle/50 px-3 py-2">
            {retired ? (
              <button type="button" className="btn-ghost" onClick={onRestoreSection}><UndoIcon size={16} /> Use this section again</button>
            ) : (
              <>
                <button type="button" className="btn-ghost" onClick={onAdd}><PlusIcon size={16} /> Add a field here</button>
                <button type="button" className="btn-ghost" onClick={onEditSection}>Rename section</button>
              </>
            )}
          </div>
        )}
      </div>
    </details>
  );
}

function FieldLine({ field: f, canManage, onEdit, onRestore }: { field: CatalogField; canManage: boolean; onEdit: () => void; onRestore: () => void }) {
  const lockedOut = f.isCore;
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold [overflow-wrap:anywhere]">{f.label}</span>
          {f.isCore && <span className="badge bg-subtle text-ink-soft ring-1 ring-line ring-inset">Built in</span>}
          {f.isComputed && <span className="badge bg-subtle text-ink-soft ring-1 ring-line ring-inset">Automatic</span>}
          {f.isRequired && <span className="badge bg-warn-soft text-warn">Must be filled in</span>}
          {f.isSensitive && <span className="badge bg-brand-soft text-ink"><ShieldIcon size={13} /> Private</span>}
          {f.isPatientVisible && <span className="badge bg-ok-soft text-ok"><EyeIcon size={13} /> Patients can see it</span>}
        </span>
        <span className="mt-0.5 block text-sm text-muted [overflow-wrap:anywhere]">{fieldLockNote(f) ?? fieldSummary(f)}</span>
      </span>
    </>
  );
  if (f.status === "DEACTIVATED") {
    return (
      <li className="flex items-center gap-3 px-4 py-3 sm:px-5">
        {body}
        {canManage && <button type="button" className="btn-ghost shrink-0" onClick={onRestore} aria-label={`Use ${f.label} again`}><UndoIcon size={16} /> Use again</button>}
      </li>
    );
  }
  if (lockedOut || !canManage) return <li className="flex items-center gap-3 px-4 py-3 sm:px-5">{body}</li>;
  return (
    <li>
      <button type="button" onClick={onEdit} aria-label={`Change ${f.label}`} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-subtle sm:px-5">
        {body}
        <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden="true" />
      </button>
    </li>
  );
}

// ─── Adding or changing a field ──────────────────────────────────────────────

type DraftOption = { id?: number; label: string; original?: string; status: "ACTIVE" | "DEACTIVATED"; originalStatus?: "ACTIVE" | "DEACTIVATED" };

const positive = (s: string) => /^\d+$/.test(s.trim()) && Number(s) > 0;
const asNumber = (s: string) => /^-?\d+(\.\d+)?$/.test(s.trim());

function FieldDialog({ field, initialGroup, groups, types, onClose, onRetire, onSaved }: {
  field: CatalogField | null;
  initialGroup: string | null;
  groups: CatalogGroup[];
  types: CatalogDataType[];
  onClose: () => void;
  onRetire: (f: CatalogField) => void;
  onSaved: (name: string) => void;
}) {
  const [label, setLabel] = useState(field?.label ?? "");
  const [group, setGroup] = useState(field?.group.code ?? initialGroup ?? groups.find((g) => g.code === "general")?.code ?? groups[0]?.code ?? "");
  const [typeCode, setTypeCode] = useState(field?.dataType.code ?? "TEXT");
  const [help, setHelp] = useState(field?.helpText ?? "");
  const [required, setRequired] = useState(field?.isRequired ?? false);
  const [several, setSeveral] = useState(field?.isMultiValued ?? false);
  const [sensitive, setSensitive] = useState(field?.isSensitive ?? false);
  const [visible, setVisible] = useState(field?.isPatientVisible ?? false);
  const [maxLength, setMaxLength] = useState(field?.maxLength?.toString() ?? "");
  const [decimals, setDecimals] = useState(field?.decimalPlaces?.toString() ?? "");
  const [minValue, setMinValue] = useState(field?.minValue ?? "");
  const [maxValue, setMaxValue] = useState(field?.maxValue ?? "");
  const [options, setOptions] = useState<DraftOption[]>([]);
  const [newOption, setNewOption] = useState("");
  const [detail, setDetail] = useState<CatalogFieldDetail | null>(null);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    if (!field) return;
    api.get<CatalogFieldDetail>(`/admin/catalog/fields/${field.code}`).then((d) => {
      setDetail(d);
      setOptions(d.options.map((o) => ({ id: o.id, label: o.label, original: o.label, status: o.status, originalStatus: o.status })));
    }, (err) => setFailure(reason(err)));
  }, [field]);

  const automatic = field?.isComputed ?? false;
  const inUse = (detail?.patientsWithValue ?? 0) > 0;
  const isChoice = typeCode === "CHOICE";
  const liveOptions = options.filter((o) => o.status === "ACTIVE");
  const problem = {
    label: tried && !label.trim() ? "Give this field a name." : null,
    options: tried && isChoice && liveOptions.length === 0 ? "Add at least one answer to the list." : null,
    maxLength: maxLength.trim() && !positive(maxLength) ? "Use a whole number, like 50." : null,
    decimals: decimals.trim() && !/^\d+$/.test(decimals.trim()) ? "Use a whole number, like 2." : null,
    min: isNumeric(typeCode) && minValue.trim() && !asNumber(minValue) ? "Use a number." : null,
    max: isNumeric(typeCode) && maxValue.trim() && !asNumber(maxValue) ? "Use a number." : null,
  };
  const hasProblem = Object.values(problem).some(Boolean);

  function addOption() {
    const t = newOption.trim();
    if (!t) return;
    if (!options.some((o) => o.label.toLowerCase() === t.toLowerCase())) setOptions([...options, { label: t, status: "ACTIVE" }]);
    setNewOption("");
  }

  async function save() {
    setTried(true);
    if (!label.trim() || hasProblem || (isChoice && !automatic && liveOptions.length === 0 && !newOption.trim())) return;
    setBusy(true);
    setFailure(null);
    const pending = newOption.trim() ? [...options, { label: newOption.trim(), status: "ACTIVE" as const }] : options;
    const limits = {
      maxLength: hasLengthLimit(typeCode) && maxLength.trim() ? Number(maxLength) : null,
      decimalPlaces: typeCode === "DECIMAL" && decimals.trim() ? Number(decimals) : null,
      minValue: (isNumeric(typeCode) || typeCode === "DATE") && minValue.trim() ? minValue.trim() : null,
      maxValue: (isNumeric(typeCode) || typeCode === "DATE") && maxValue.trim() ? maxValue.trim() : null,
    };
    const multi = canHoldSeveral(typeCode) && several;
    try {
      if (!field) {
        await api.post("/admin/catalog/fields", {
          label: label.trim(), group, dataType: typeCode, helpText: help.trim() || null, isRequired: required, isMultiValued: multi, isSensitive: sensitive, isPatientVisible: visible, ...limits,
          ...(isChoice ? { options: pending.map((o) => ({ label: o.label })) } : {}),
        });
      } else if (automatic) {
        await api.patch(`/admin/catalog/fields/${field.code}`, { label: label.trim(), group, helpText: help.trim() || null, isSensitive: sensitive });
      } else {
        await api.patch(`/admin/catalog/fields/${field.code}`, {
          label: label.trim(), group, helpText: help.trim() || null, isRequired: required, isSensitive: sensitive, isPatientVisible: visible, ...limits,
          ...(typeCode !== field.dataType.code ? { dataType: typeCode } : {}),
          ...(multi !== field.isMultiValued ? { isMultiValued: multi } : {}),
        });
        if (isChoice) {
          for (const o of pending) {
            if (o.id === undefined) await api.post(`/admin/catalog/fields/${field.code}/options`, { label: o.label });
            else if (o.label !== o.original || o.status !== o.originalStatus) await api.patch(`/admin/catalog/fields/${field.code}/options/${o.id}`, { label: o.label, status: o.status });
          }
        }
      }
      onSaved(label.trim());
    } catch (err) {
      setFailure(reason(err));
      setBusy(false);
    }
  }

  const kind = ANSWER_KIND[typeCode];
  return (
    <FormDialog title={field ? `Change "${field.label}"` : "Add a field"} description={automatic ? "The portal works this out by itself, so you can only change how it is named and who can see it." : undefined} submitLabel={field ? "Save" : "Add field"} busy={busy} error={failure} onSubmit={() => void save()} onClose={onClose}>
      <TextField label="Name" value={label} maxLength={100} autoComplete="off" error={problem.label} hint="What staff see on the patient's record, like “Blood sugar”." onChange={setLabel} />
      <SelectField label="Section" value={group} onChange={setGroup} options={groups.map((g) => [g.code, g.label])} />

      {!automatic && (
        <>
          <SelectField label="What kind of answer is it?" value={typeCode} disabled={inUse} onChange={(v) => { setTypeCode(v); setTried(false); }} options={types.map((t) => [t.code, answerKind(t)])} hint={inUse ? `${plural(detail!.patientsWithValue, "patient already has", "patients already have")} an answer here, so this can't be changed.` : kind?.help} />

          {isChoice && (
            <fieldset>
              <legend className="text-sm font-semibold">Answers to pick from</legend>
              {options.length > 0 && (
                <ul className="mt-2 space-y-2">
                  {options.map((o, i) => (
                    <li key={o.id ?? `new-${i}`} className="flex items-center gap-2">
                      <input aria-label={`Answer ${i + 1}`} className={`field ${o.status !== "ACTIVE" ? "text-muted line-through" : ""}`} maxLength={150} value={o.label} disabled={o.status !== "ACTIVE"} onChange={(e) => setOptions(options.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                      {o.id === undefined ? (
                        <button type="button" className="icon-btn" aria-label={`Remove ${o.label}`} onClick={() => setOptions(options.filter((_, j) => j !== i))}><CloseIcon size={16} /></button>
                      ) : o.status === "ACTIVE" ? (
                        <button type="button" className="icon-btn" aria-label={`Stop offering ${o.label}`} onClick={() => setOptions(options.map((x, j) => (j === i ? { ...x, status: "DEACTIVATED" } : x)))}><CloseIcon size={16} /></button>
                      ) : (
                        <button type="button" className="icon-btn" aria-label={`Offer ${o.label} again`} onClick={() => setOptions(options.map((x, j) => (j === i ? { ...x, status: "ACTIVE" } : x)))}><UndoIcon size={16} /></button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-2 flex gap-2">
                <input
                  aria-label="New answer"
                  className={`field ${problem.options ? "border-bad" : ""}`}
                  maxLength={150}
                  placeholder="Type an answer, like “Cash”"
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addOption();
                    }
                  }}
                />
                <button type="button" className="btn-secondary shrink-0" onClick={addOption}>Add</button>
              </div>
              {problem.options && !newOption.trim() && <p role="alert" className="mt-1.5 text-sm font-semibold text-bad">{problem.options}</p>}
            </fieldset>
          )}

          {canHoldSeveral(typeCode) && (
            <Check checked={several} disabled={inUse} onChange={setSeveral} title="A patient can have more than one answer">For example, several allergies.</Check>
          )}
          <Check checked={required} onChange={setRequired} title="Must be filled in">The record is flagged until staff fill this in.</Check>
        </>
      )}

      <Check checked={sensitive} onChange={setSensitive} title="Private">Only staff with permission to see private information can read this. Each time they do, it is recorded.</Check>
      {!automatic && <Check checked={visible} onChange={setVisible} title="Patients can see it">It shows on the patient&rsquo;s own portal.</Check>}

      {!automatic && (
        <details className="rounded-[var(--radius-control)] border border-line p-3">
          <summary className="cursor-pointer text-sm font-semibold text-brand">More settings</summary>
          <div className="mt-3 space-y-4">
            <TextField label="Note for staff" optional value={help} maxLength={300} autoComplete="off" hint="A short tip shown with this field." onChange={setHelp} />
            {hasLengthLimit(typeCode) && <TextField label="Longest answer allowed, in letters" optional inputMode="numeric" value={maxLength} error={problem.maxLength} onChange={setMaxLength} />}
            {typeCode === "DECIMAL" && <TextField label="Digits after the decimal point" optional inputMode="numeric" value={decimals} error={problem.decimals} hint="Amounts usually use 2." onChange={setDecimals} />}
            {isNumeric(typeCode) && (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField label="Smallest allowed" optional inputMode="decimal" value={minValue} error={problem.min} onChange={setMinValue} />
                <TextField label="Largest allowed" optional inputMode="decimal" value={maxValue} error={problem.max} onChange={setMaxValue} />
              </div>
            )}
            {typeCode === "DATE" && (
              <Check checked={maxValue === "today"} onChange={(on) => setMaxValue(on ? "today" : "")} title="Can't be a future date">Useful for things that have already happened.</Check>
            )}
          </div>
        </details>
      )}

      {field && (
        <div className="border-t border-line pt-4">
          <button type="button" className="btn-ghost -ml-3 text-bad hover:bg-bad-soft" disabled={busy} onClick={() => onRetire(field)}>Stop using this field</button>
        </div>
      )}
    </FormDialog>
  );
}

function Check({ checked, onChange, disabled = false, title, children }: { checked: boolean; onChange: (on: boolean) => void; disabled?: boolean; title: string; children: React.ReactNode }) {
  return (
    <label className={`flex items-start gap-3 ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-brand)]" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-sm text-ink-soft">{children}</span>
      </span>
    </label>
  );
}

// ─── Adding or renaming a section ────────────────────────────────────────────

function SectionDialog({ group, onClose, onSaved }: { group: CatalogGroup | null; onClose: () => void; onSaved: (text: string) => void }) {
  const [label, setLabel] = useState(group?.label ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function run(work: () => Promise<unknown>, text: string) {
    setBusy(true);
    setFailure(null);
    try {
      await work();
      onSaved(text);
    } catch (err) {
      setFailure(reason(err));
      setBusy(false);
    }
  }

  function save() {
    setTried(true);
    const name = label.trim();
    if (!name) return;
    const body = { label: name, description: description.trim() || null };
    void run(() => (group ? api.patch(`/admin/catalog/groups/${group.code}`, body) : api.post("/admin/catalog/groups", body)), `Saved "${name}".`);
  }

  return (
    <FormDialog title={group ? `Rename "${group.label}"` : "Add a section"} description="Sections keep related fields together, like headings on a form." submitLabel={group ? "Save" : "Add section"} busy={busy} error={failure} onSubmit={save} onClose={onClose}>
      <TextField label="Name" value={label} maxLength={100} autoComplete="off" error={tried && !label.trim() ? "Give this section a name." : null} onChange={setLabel} />
      <TextField label="What goes in it" optional value={description} maxLength={300} autoComplete="off" onChange={setDescription} />
      {group && group.fieldCount === 0 && (
        <div className="border-t border-line pt-4">
          <button type="button" className="btn-ghost -ml-3 text-bad hover:bg-bad-soft" disabled={busy} onClick={() => void run(() => api.post(`/admin/catalog/groups/${group.code}/retire`), `"${group.label}" is no longer in use.`)}>Stop using this section</button>
        </div>
      )}
    </FormDialog>
  );
}
