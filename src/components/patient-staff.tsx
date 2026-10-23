"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useDocumentActions } from "@/components/documents";
import { telHref } from "@/components/help";
import { ChevronLeft, ChevronRight, DocTypeIcon, DownloadIcon, EyeIcon, FileIcon, KeyIcon, MailIcon, PhoneIcon, PlusIcon, UsersIcon } from "@/components/icons";
import {
  EmptyState,
  ErrorBanner,
  FormDialog,
  PageHeader,
  RowsSkeleton,
  SearchBox,
  SelectField,
  StatusBadge,
  TemporaryPasswordNotice,
  TextField,
  useAreaBase,
  useToast,
  useUrlState,
} from "@/components/staff-ui";
import { api, ApiError, type LinkCreated, type PatientLogin, type SearchResult, type StaffDocument, type StaffPatient, type StaffSearchRow, type TemporaryPassword } from "@/lib/api";
import { ageFromDob, bloodGroupLabel, documentDay, formatDate, formatDateTime, formatMobile, formatSize, genderLabel, initials, relationLabel, RELATION_OPTIONS } from "@/lib/format";
import { can } from "@/lib/session";
import { useSessionContext } from "@/lib/use-session";

// Patients for hospital people (admins and hospital staff): find, open, and manage who signs in for a patient.
// Each action shows only when the person's type has its permission; the API checks the same permission.

/** US-12: find any patient by name, mobile number or patient ID, and open their record. */
export function PatientSearchPage() {
  return (
    <Suspense>
      <Search />
    </Suspense>
  );
}

function Search() {
  const session = useSessionContext();
  const base = useAreaBase();
  const { params, set } = useUrlState();
  const q = params.get("q") ?? "";
  const [result, setResult] = useState<SearchResult<StaffSearchRow> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // The search lives in the address, so Back from a patient returns to the same results.
  useEffect(() => {
    if (!q) return setResult(null);
    let live = true;
    setLoading(true);
    setError(false);
    api
      .get<SearchResult<StaffSearchRow>>(`/patients?q=${encodeURIComponent(q)}`)
      .then((r) => live && setResult(r))
      .catch(() => live && setError(true))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [q, attempt]);

  return (
    <>
      <PageHeader
        title="Patients"
        description="Open any patient's record: profile, documents and the mobile numbers that sign in for them."
        actions={
          can(session, "patients.create") && (
            <Link href={`${base}/patients/new`} className="btn">
              <PlusIcon size={18} /> Register a patient
            </Link>
          )
        }
      />
      <div className="mt-6">
        <SearchBox
          label="Find a patient"
          hint="Name, mobile number (or its last 4+ digits) or patient ID."
          placeholder="Name, mobile number or patient ID"
          initial={q}
          busy={loading}
          onSearch={(v) => set({ q: v || null })}
        />
      </div>

      <section aria-label="Results" aria-busy={loading} className="mt-6">
        {error ? (
          <ErrorBanner text="We couldn't search just now. Check your connection." onRetry={() => setAttempt((n) => n + 1)} />
        ) : loading && !result ? (
          <RowsSkeleton />
        ) : !q ? (
          <EmptyState icon={<UsersIcon size={22} />} title="Search to find a patient">
            Every search is recorded in the audit log.
          </EmptyState>
        ) : result?.tooShort ? (
          <EmptyState icon={<UsersIcon size={22} />} title="Type a little more">
            Use at least 2 letters of the name, 4 digits of the mobile number, or the patient ID.
          </EmptyState>
        ) : result && result.results.length === 0 ? (
          <EmptyState icon={<UsersIcon size={22} />} title={`No patient matches “${q}”`}>
            Check the spelling, or try the mobile number or patient ID instead.
            {can(session, "patients.create") && (
              <Link href={`${base}/patients/new`} className="mt-3 block font-semibold text-brand hover:underline">Register a new patient</Link>
            )}
          </EmptyState>
        ) : result ? (
          <Results rows={result.results} base={base} />
        ) : null}
      </section>
    </>
  );
}

function Results({ rows, base }: { rows: StaffSearchRow[]; base: string }) {
  const href = (id: number) => `${base}/patients/view?id=${id}`;
  return (
    <>
      <p className="mb-3 text-sm text-muted" role="status">
        {rows.length === 25 ? "Showing the first 25 matches. Narrow the search to see others." : `${rows.length} ${rows.length === 1 ? "patient" : "patients"}`}
      </p>

      {/* Phones: one card per patient. */}
      <ul className="card divide-y divide-line md:hidden">
        {rows.map((p) => (
          <li key={p.id}>
            <Link href={href(p.id)} className="flex items-center gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-subtle">
              <span className="avatar h-10 w-10 text-sm" aria-hidden="true">{initials(p.fullName)}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-semibold">
                  <span className="truncate">{p.fullName}</span>
                  {p.isTest && <span className="badge bg-subtle text-muted">Test</span>}
                </span>
                <span className="block truncate text-sm text-muted tabular">
                  {p.patientCode} · {formatDate(p.dob)} · {formatMobile(p.mobile)}
                </span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-muted" />
            </Link>
          </li>
        ))}
      </ul>

      {/* Tablets and up: a table. The name opens the record. */}
      <div className="card hidden overflow-hidden md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-subtle text-xs font-semibold tracking-wide text-muted uppercase">
            <tr>
              <th scope="col" className="px-5 py-3">Patient</th>
              <th scope="col" className="px-5 py-3">Date of birth</th>
              <th scope="col" className="px-5 py-3">Gender</th>
              <th scope="col" className="px-5 py-3">Mobile</th>
              <th scope="col" className="px-5 py-3 text-right">Documents</th>
              <th scope="col" className="w-10 px-3 py-3"><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((p) => (
              <tr key={p.id} className="group relative transition-colors duration-150 hover:bg-subtle">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="avatar h-9 w-9 text-xs" aria-hidden="true">{initials(p.fullName)}</span>
                    <div className="min-w-0">
                      <Link href={href(p.id)} className="font-semibold text-ink after:absolute after:inset-0 hover:text-brand hover:underline">
                        {p.fullName}
                      </Link>
                      <p className="flex items-center gap-2 text-muted tabular">
                        {p.patientCode}
                        {p.isTest && <span className="badge h-5 bg-surface text-muted ring-1 ring-line ring-inset">Test</span>}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 tabular">
                  {formatDate(p.dob)} <span className="text-muted">({ageFromDob(p.dob)})</span>
                </td>
                <td className="px-5 py-3">{genderLabel(p.gender) ?? <span className="text-muted">—</span>}</td>
                <td className="px-5 py-3 tabular">{formatMobile(p.mobile)}</td>
                <td className="px-5 py-3 text-right tabular">{p.documentCount}</td>
                <td className="px-3 py-3 text-muted group-hover:text-ink"><ChevronRight size={18} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** US-12: one patient's whole record, as the hospital sees it. Opening it is audited. */
export function PatientRecordPage() {
  return (
    <Suspense>
      <PatientRecord />
    </Suspense>
  );
}

function PatientRecord() {
  const router = useRouter();
  const base = useAreaBase();
  const id = Number(useSearchParams().get("id"));
  const [data, setData] = useState<StaffPatient | null>(null);
  const [error, setError] = useState<"missing" | "failed" | null>(null);
  const actions = useDocumentActions<StaffDocument>("/documents");

  const load = useCallback(() => {
    if (!Number.isInteger(id) || id <= 0) return setError("missing");
    api
      .get<StaffPatient>(`/patients/${id}`)
      .then(setData)
      .catch((e) => setError(e instanceof ApiError && e.status === 404 ? "missing" : "failed"));
  }, [id]);
  useEffect(load, [load]);

  // Back to the search results when we came from them; otherwise to an empty search.
  const back = () => (window.history.length > 1 ? router.back() : router.push(`${base}/patients`));

  return (
    <>
      <button type="button" onClick={back} className="btn-ghost -ml-3 mb-4">
        <ChevronLeft size={16} /> Patients
      </button>

      {error === "missing" ? (
        <EmptyState icon={<FileIcon size={22} />} title="This patient record doesn't exist">
          The link may be old. Search for the patient again.
        </EmptyState>
      ) : error ? (
        <ErrorBanner text="We couldn't load this record. Check your connection." onRetry={() => window.location.reload()} />
      ) : !data ? (
        <RowsSkeleton rows={5} />
      ) : (
        <Record data={data} actions={actions} base={base} onChanged={load} />
      )}
      {actions.ui}
    </>
  );
}

type Field = { label: string; value: string | null; href?: string | null };

function Record({ data, actions, base, onChanged }: { data: StaffPatient; actions: ReturnType<typeof useDocumentActions<StaffDocument>>; base: string; onChanged: () => void }) {
  const session = useSessionContext();
  const p = data.patient;
  const details: Field[] = [
    { label: "Date of birth", value: `${formatDate(p.dob)} (${ageFromDob(p.dob)})` },
    { label: "Gender", value: genderLabel(p.gender) },
    { label: "Blood group", value: bloodGroupLabel(p.bloodGroup) },
    { label: "ABHA number", value: p.abhaNumber },
    { label: "Mobile number", value: formatMobile(p.mobile), href: telHref(p.mobile) },
    { label: "Email", value: p.email },
    { label: "Address", value: p.address },
    {
      label: "Emergency contact",
      value: p.emergencyContact ? `${p.emergencyContact.name}${p.emergencyContact.phone ? ` · ${formatMobile(p.emergencyContact.phone)}` : ""}` : null,
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-4">
        <span className="avatar h-14 w-14 text-lg" aria-hidden="true">{initials(p.fullName)}</span>
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-[26px] leading-tight font-extrabold sm:text-[30px]">
            {p.fullName}
            {p.isTest && <span className="badge bg-subtle text-muted ring-1 ring-line ring-inset">Test patient</span>}
          </h1>
          <p className="text-muted">
            ID <span className="tabular">{p.patientCode}</span> · {ageFromDob(p.dob)} · on record since {formatDate(p.createdAt.slice(0, 10))}
          </p>
        </div>
        {can(session, "patients.edit") && (
          <Link href={`${base}/patients/edit?id=${p.id}`} className="btn-secondary">Edit details</Link>
        )}
      </div>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-labelledby="docs-title" className="card min-w-0 p-5 sm:p-6 lg:row-span-2">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="docs-title" className="text-base font-bold">Documents</h2>
            <span className="text-sm text-muted tabular">{data.documents.length}</span>
          </div>
          {data.documents.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No documents yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {data.documents.map((d) => (
                <DocumentLine key={d.id} doc={d} actions={actions} />
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="details-title" className="card p-5 sm:p-6">
          <h2 id="details-title" className="text-base font-bold">Details</h2>
          <dl className="mt-4 grid gap-y-3.5 sm:grid-cols-2 lg:grid-cols-1">
            {details.map((f) => (
              <div key={f.label}>
                <dt className="text-sm text-muted">{f.label}</dt>
                <dd className="mt-0.5 font-semibold [overflow-wrap:anywhere]">
                  {f.value === null ? (
                    <span className="font-normal text-muted italic">Not recorded</span>
                  ) : f.href ? (
                    <a href={f.href} className="text-brand underline-offset-2 hover:underline">{f.value}</a>
                  ) : (
                    f.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <LoginsCard patient={p} logins={data.logins} canManage={can(session, "patients.link")} onChanged={onChanged} />
      </div>
    </>
  );
}

type LoginDialog = { kind: "link" } | { kind: "temporary"; login: PatientLogin } | { kind: "unlink"; login: PatientLogin };

/** Who signs in for this patient: each mobile, its email sign-in if any, and its consent. */
function LoginsCard({ patient, logins, canManage, onChanged }: { patient: StaffPatient["patient"]; logins: PatientLogin[]; canManage: boolean; onChanged: () => void }) {
  const [dialog, setDialog] = useState<LoginDialog | null>(null);
  const [revealed, setRevealed] = useState<{ temp: TemporaryPassword; who: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function unlink(login: PatientLogin) {
    setBusy(true);
    try {
      await api.delete(`/patients/${patient.id}/logins/${login.accountId}`);
      setDialog(null);
      toast.show(`${formatMobile(login.mobile)} no longer sees ${patient.fullName}'s records.`);
      onChanged();
    } catch {
      toast.show("Couldn't unlink. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="logins-title" className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="logins-title" className="text-base font-bold">Signs in with</h2>
          <p className="mt-1 text-sm text-muted">Logins that can open this record, and their consent.</p>
        </div>
        {canManage && (
          <button type="button" className="btn-secondary h-10 px-3 text-sm" onClick={() => setDialog({ kind: "link" })}>
            <PlusIcon size={16} /> Link a mobile
          </button>
        )}
      </div>

      {revealed && <TemporaryPasswordNotice className="mt-4" temp={revealed.temp} who={revealed.who} />}

      {logins.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No mobile number is linked yet, so nobody can sign in for this patient.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {logins.map((l) => (
            <li key={l.accountId} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-semibold tabular">
                  <PhoneIcon size={16} className="text-muted" /> {formatMobile(l.mobile)}
                </span>
                <StatusBadge status={l.consent} />
              </div>
              {l.email && (
                <p className="mt-1 flex items-center gap-2 text-sm [overflow-wrap:anywhere]">
                  <MailIcon size={14} className="shrink-0 text-muted" /> {l.email}
                  {l.passwordMustChange && <span className="badge bg-warn-soft text-warn">Temporary password</span>}
                </p>
              )}
              <p className="mt-1 text-sm text-muted">
                {relationLabel(l.relation)} · {l.lastLoginAt ? `last signed in ${formatDateTime(l.lastLoginAt)}` : "never signed in"}
              </p>
              {canManage && (
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  <button type="button" className="inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-brand hover:underline" onClick={() => setDialog({ kind: "temporary", login: l })}>
                    <KeyIcon size={14} /> {l.hasPassword ? "New temporary password" : "Give email sign-in"}
                  </button>
                  <button type="button" className="inline-flex min-h-9 items-center text-sm font-semibold text-bad hover:underline" onClick={() => setDialog({ kind: "unlink", login: l })}>
                    Unlink
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {dialog?.kind === "link" && (
        <LinkDialog
          patient={patient}
          onClose={() => setDialog(null)}
          onDone={(r, mobile) => {
            setDialog(null);
            if (r.temporaryPassword) setRevealed({ temp: r.temporaryPassword, who: formatMobile(mobile) });
            toast.show(`${formatMobile(mobile)} can now open ${patient.fullName}'s records${r.keptOwnPassword ? ". It already has its own password, so none was made." : "."}`);
            onChanged();
          }}
        />
      )}
      {dialog?.kind === "temporary" && (
        <TemporaryDialog
          patientId={patient.id}
          login={dialog.login}
          onClose={() => setDialog(null)}
          onDone={(temp) => {
            setDialog(null);
            setRevealed({ temp, who: formatMobile(dialog.login.mobile) });
            onChanged();
          }}
        />
      )}
      {dialog?.kind === "unlink" && (
        <ConfirmDialog
          title={`Unlink ${formatMobile(dialog.login.mobile)}?`}
          confirmLabel="Unlink"
          busy={busy}
          onConfirm={() => void unlink(dialog.login)}
          onCancel={() => setDialog(null)}
        >
          This login stops seeing {patient.fullName}&apos;s records straight away. Other people it signs in for are not affected, and the change is kept in the audit log.
        </ConfirmDialog>
      )}
      {toast.ui}
    </section>
  );
}

const issuesOf = (e: unknown) => (e instanceof ApiError ? ((e.body.issues as string[] | undefined) ?? []) : []);

function LinkDialog({ patient, onClose, onDone }: { patient: StaffPatient["patient"]; onClose: () => void; onDone: (r: LinkCreated, mobile: string) => void }) {
  const [mobile, setMobile] = useState("");
  const [relation, setRelation] = useState("");
  const [withEmail, setWithEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ mobile?: string; relation?: string; email?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  async function submit() {
    const local = {
      ...(mobile.replace(/\D/g, "").length < 10 && { mobile: "Enter a 10-digit mobile number." }),
      ...(!relation && { relation: "Choose how this person is related to the patient." }),
      ...(withEmail && !/^\S+@\S+\.\S+$/.test(email.trim()) && { email: "Enter a valid email address." }),
    };
    if (Object.keys(local).length) return setErrors(local);
    setBusy(true);
    setErrors({});
    try {
      const digits = mobile.replace(/\D/g, "");
      const r = await api.post<LinkCreated>(`/patients/${patient.id}/logins`, { mobile: digits, relation, ...(withEmail ? { signInEmail: email.trim() } : {}) });
      onDone(r, `+91${digits.slice(-10)}`);
    } catch (e) {
      const issues = issuesOf(e);
      if (e instanceof ApiError && e.code === "ALREADY_LINKED") setErrors({ mobile: "This number already signs in for this patient." });
      else if (e instanceof ApiError && e.code === "EMAIL_IN_USE") setErrors({ email: "Someone else already signs in with this email." });
      else if (issues.some((i) => i.includes("mobile"))) setErrors({ mobile: "Enter a valid 10-digit Indian mobile number." });
      else if (issues.some((i) => i.includes("signInEmail"))) setErrors({ email: "Enter a valid email address." });
      else setErrors({ form: "Couldn't link this number. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormDialog
      title={`Link a mobile to ${patient.fullName}`}
      description="That mobile number signs in with a WhatsApp code and sees this patient's records once consent is given."
      submitLabel="Link mobile"
      busy={busy}
      error={errors.form}
      onSubmit={() => void submit()}
      onClose={onClose}
    >
      <TextField label="Mobile number" value={mobile} onChange={setMobile} error={errors.mobile} inputMode="numeric" autoComplete="off" maxLength={14} placeholder="98765 43210" />
      <SelectField label="Relation to the patient" value={relation} onChange={setRelation} options={RELATION_OPTIONS} placeholder="Choose…" error={errors.relation} />
      <EmailSignIn checked={withEmail} onToggle={setWithEmail} email={email} onEmail={setEmail} error={errors.email} />
    </FormDialog>
  );
}

/** "Also give an email and temporary password": a second way in, for someone who can't use WhatsApp codes. */
export function EmailSignIn({ checked, onToggle, email, onEmail, error }: { checked: boolean; onToggle: (v: boolean) => void; email: string; onEmail: (v: string) => void; error?: string }) {
  return (
    <div className="rounded-[var(--radius-control)] border border-line p-4">
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--color-brand)]" checked={checked} onChange={(e) => onToggle(e.target.checked)} />
        <span>
          <span className="block text-sm font-semibold">Also give an email and temporary password</span>
          <span className="block text-sm text-muted">You&apos;ll see the password once, to pass on. They choose their own at the first sign-in.</span>
        </span>
      </label>
      {checked && (
        <div className="mt-4">
          <TextField label="Email they'll sign in with" type="email" value={email} onChange={onEmail} error={error} autoComplete="off" maxLength={255} />
        </div>
      )}
    </div>
  );
}

function TemporaryDialog({ patientId, login, onClose, onDone }: { patientId: number; login: PatientLogin; onClose: () => void; onDone: (t: TemporaryPassword) => void }) {
  const [email, setEmail] = useState(login.email ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email address.");
    setBusy(true);
    setError(null);
    try {
      // A password the person chose themselves is replaced only on purpose: this dialog says so before they confirm.
      const replaceOwnPassword = login.hasPassword && !login.passwordMustChange;
      onDone(await api.post<TemporaryPassword>(`/patients/${patientId}/logins/${login.accountId}/temporary-password`, { email: email.trim(), replaceOwnPassword }));
    } catch (e) {
      setError(e instanceof ApiError && e.code === "EMAIL_IN_USE" ? "Someone else already signs in with this email." : "Couldn't make a temporary password. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormDialog
      title={login.hasPassword ? "New temporary password" : "Give email sign-in"}
      description={
        <>
          For {formatMobile(login.mobile)}.{" "}
          {login.hasPassword
            ? "Only if they can't get in: the password they use now stops working, they're signed out everywhere, and the audit log records that you replaced it."
            : "They can still sign in with a WhatsApp code too."}
        </>
      }
      submitLabel="Make temporary password"
      busy={busy}
      onSubmit={() => void submit()}
      onClose={onClose}
    >
      <TextField label="Email they'll sign in with" type="email" value={email} onChange={setEmail} error={error} autoComplete="off" maxLength={255} />
    </FormDialog>
  );
}

function DocumentLine({ doc, actions }: { doc: StaffDocument; actions: ReturnType<typeof useDocumentActions<StaffDocument>> }) {
  const busy = actions.busyId === doc.id;
  const available = doc.status === "AVAILABLE";
  return (
    <li className="flex flex-wrap items-center gap-3 py-3 sm:flex-nowrap sm:gap-4" aria-busy={busy || undefined}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-brand-soft text-brand">
        <DocTypeIcon name={doc.type.icon} size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{doc.title}</p>
        <p className="mt-0.5 flex flex-wrap gap-x-1.5 text-sm text-muted">
          <span>{doc.type.label}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={documentDay(doc)}>{formatDate(documentDay(doc))}</time>
          <span aria-hidden="true">·</span>
          <span>{doc.source}, uploaded by {doc.uploadedBy}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular">{formatSize(doc.sizeBytes)}</span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!available && <StatusBadge status={doc.status} />}
        {doc.canView && (
          <button className="icon-btn" aria-label={`View ${doc.title}`} title="View" disabled={busy} onClick={() => actions.view(doc)}>
            <EyeIcon size={18} />
          </button>
        )}
        {available && (
          <button className="icon-btn" aria-label={`Download ${doc.title}`} title="Download" disabled={busy} onClick={() => actions.download(doc)}>
            <DownloadIcon size={18} />
          </button>
        )}
      </div>
    </li>
  );
}
