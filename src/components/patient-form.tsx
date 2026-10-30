"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertIcon, CheckIcon, ChevronLeft } from "@/components/icons";
import { EmailSignIn } from "@/components/patient-staff";
import { ErrorBanner, PageHeader, RowsSkeleton, SelectField, TemporaryPasswordNotice, TextField, useAreaBase } from "@/components/staff-ui";
import { api, ApiError, isUuid, type DuplicateMatch, type PatientCreated, type StaffPatient } from "@/lib/api";
import { DatePicker } from "@/components/date-picker";
import { BLOOD_GROUP_OPTIONS, formatDate, formatMobile, GENDER_OPTIONS, RELATION_OPTIONS, todayIst } from "@/lib/format";

type Form = {
  patientCode: string;
  fullName: string;
  dob: string;
  gender: string;
  bloodGroup: string;
  abhaNumber: string;
  mobile: string;
  email: string;
  address: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
};
type FieldKey = keyof Form | "relation" | "signInEmail";
type Errors = Partial<Record<FieldKey | "form", string>>;

const EMPTY: Form = {
  patientCode: "", fullName: "", dob: "", gender: "", bloodGroup: "", abhaNumber: "", mobile: "", email: "", address: "",
  emergencyContactName: "", emergencyContactPhone: "",
};

// What each API validation path means to the person filling the form.
const FIELD_MESSAGES: Record<FieldKey, string> = {
  patientCode: "Use letters, digits and hyphens only, up to 20.",
  fullName: "Enter the full name, at least 2 letters.",
  dob: "Enter a real date of birth, not in the future.",
  gender: "Choose a gender.",
  bloodGroup: "Choose a blood group.",
  abhaNumber: "An ABHA number has 14 digits.",
  mobile: "Enter a valid 10-digit Indian mobile number.",
  email: "Enter a valid email address.",
  address: "The address is too long.",
  emergencyContactName: "Enter the contact's name (up to 150 characters) with their phone.",
  emergencyContactPhone: "Enter a valid 10-digit Indian mobile number.",
  relation: "Choose how the mobile's owner is related.",
  signInEmail: "Enter a valid email address.",
};

function errorsFrom(e: unknown): Errors {
  if (!(e instanceof ApiError)) return { form: "Couldn't save. Check your connection and try again." };
  if (e.code === "PATIENT_CODE_IN_USE") return { patientCode: "Another patient already has this ID." };
  if (e.code === "EMAIL_IN_USE") return { signInEmail: "Someone else already signs in with this email." };
  if (e.code === "TRY_AGAIN") return { form: "Someone saved this mobile at the same moment. Please try again." };
  if (e.code === "VALIDATION") {
    const out: Errors = {};
    for (const path of (e.body.issues as string[] | undefined) ?? []) {
      const key = path.replace(/^\//, "").split("/")[0] as FieldKey;
      if (key in FIELD_MESSAGES) out[key] = FIELD_MESSAGES[key];
    }
    return Object.keys(out).length ? out : { form: "Some details need fixing." };
  }
  return { form: "Couldn't save. Please try again." };
}

/** Register a new patient (mode "new") or change one's details (mode "edit", ?id=). */
export function PatientFormPage({ mode }: { mode: "new" | "edit" }) {
  return (
    <Suspense>
      <PatientForm mode={mode} />
    </Suspense>
  );
}

function PatientForm({ mode }: { mode: "new" | "edit" }) {
  const router = useRouter();
  const base = useAreaBase();
  const id = useSearchParams().get("uuid") ?? "";
  const [form, setForm] = useState<Form>(EMPTY);
  const [loaded, setLoaded] = useState(mode === "new");
  const [loadFailed, setLoadFailed] = useState(false);
  const [relation, setRelation] = useState("SELF");
  const [withEmail, setWithEmail] = useState(false);
  const [signInEmail, setSignInEmail] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null);
  const [reason, setReason] = useState("");
  const [created, setCreated] = useState<{ result: PatientCreated; name: string } | null>(null);

  useEffect(() => {
    if (mode !== "edit") return;
    if (!isUuid(id)) return setLoadFailed(true);
    api
      .get<StaffPatient>(`/patients/${id}`)
      .then(({ patient: p }) => {
        setForm({
          patientCode: p.patientCode,
          fullName: p.fullName,
          dob: p.dob,
          gender: p.gender ?? "",
          bloodGroup: p.bloodGroup ?? "",
          abhaNumber: p.abhaNumber ?? "",
          mobile: p.mobile.replace(/^\+91/, ""),
          email: p.email ?? "",
          address: p.address ?? "",
          emergencyContactName: p.emergencyContact?.name ?? "",
          emergencyContactPhone: p.emergencyContact?.phone?.replace(/^\+91/, "") ?? "",
        });
        setLoaded(true);
      })
      .catch(() => setLoadFailed(true));
  }, [mode, id]);

  const set = (k: keyof Form) => (v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
    // Who this is changed: an earlier duplicate warning no longer applies.
    if (k === "fullName" || k === "dob" || k === "mobile") setDuplicates(null);
  };

  async function submit(duplicateReason?: string) {
    const local: Errors = {
      ...(form.fullName.trim().length < 2 && { fullName: FIELD_MESSAGES.fullName }),
      ...((!form.dob || form.dob > todayIst()) && { dob: FIELD_MESSAGES.dob }),
      ...(form.mobile.replace(/\D/g, "").length < 10 && { mobile: FIELD_MESSAGES.mobile }),
      ...(form.emergencyContactPhone.trim() && !form.emergencyContactName.trim() && { emergencyContactName: FIELD_MESSAGES.emergencyContactName }),
      ...(mode === "new" && withEmail && !/^\S+@\S+\.\S+$/.test(signInEmail.trim()) && { signInEmail: FIELD_MESSAGES.signInEmail }),
    };
    if (Object.keys(local).length) {
      setErrors(local);
      document.getElementById(`field-${Object.keys(local)[0]}`)?.querySelector<HTMLElement>("input, select")?.focus();
      return;
    }
    setBusy(true);
    setErrors({});
    const body = {
      ...form,
      gender: form.gender || null,
      bloodGroup: form.bloodGroup || null,
      ...(duplicateReason ? { duplicateReason } : {}),
      ...(mode === "new" ? { relation, ...(withEmail ? { signInEmail: signInEmail.trim() } : {}) } : {}),
    };
    try {
      if (mode === "new") {
        const result = await api.post<PatientCreated>("/patients", body);
        setCreated({ result, name: form.fullName.trim() });
        window.scrollTo({ top: 0 });
      } else {
        await api.put(`/patients/${id}`, body);
        router.replace(`${base}/patients/view?uuid=${id}`);
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === "POSSIBLE_DUPLICATE") {
        setDuplicates(e.body.matches as DuplicateMatch[]);
        return;
      }
      setErrors(errorsFrom(e));
    } finally {
      setBusy(false);
    }
  }

  if (created) return <Created created={created} base={base} onAnother={() => { setCreated(null); setForm(EMPTY); setWithEmail(false); setSignInEmail(""); setRelation("SELF"); setReason(""); setDuplicates(null); }} />;

  const back = mode === "edit" ? `${base}/patients/view?uuid=${id}` : `${base}/patients`;
  const field = (k: keyof Form, label: string, props: Omit<Parameters<typeof TextField>[0], "label" | "value" | "onChange"> = {}) => (
    <div id={`field-${k}`}>
      <TextField label={label} value={form[k]} onChange={set(k)} error={errors[k]} {...props} />
    </div>
  );

  return (
    <>
      <Link href={back} className="btn-ghost -ml-3 mb-4">
        <ChevronLeft size={16} /> {mode === "edit" ? "Back to the record" : "Patients"}
      </Link>
      <PageHeader
        title={mode === "new" ? "Register a patient" : "Edit details"}
        description={mode === "new" ? "As on the hospital's registration form. The mobile number signs in to see this patient's records." : "Every change is recorded in the audit log."}
      />

      {loadFailed ? (
        <ErrorBanner text="We couldn't load this patient. Go back and open the record again." />
      ) : !loaded ? (
        <div className="mt-6"><RowsSkeleton rows={4} /></div>
      ) : (
        <form
          className="mt-6 max-w-3xl space-y-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <fieldset className="card p-5 sm:p-6">
            <legend className="sr-only">Personal details</legend>
            <h2 className="text-base font-bold">Personal details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">{field("fullName", "Full name", { autoComplete: "off", maxLength: 150, required: true })}</div>
              <div id="field-dob">
                <DatePicker label="Date of birth" value={form.dob} onChange={set("dob")} max={todayIst()} today={todayIst()} required autoComplete="bday" error={errors.dob} />
              </div>
              <div id="field-gender">
                <SelectField label="Gender" value={form.gender} onChange={set("gender")} options={GENDER_OPTIONS} placeholder="Not recorded" optional error={errors.gender} />
              </div>
              <div id="field-bloodGroup">
                <SelectField label="Blood group" value={form.bloodGroup} onChange={set("bloodGroup")} options={BLOOD_GROUP_OPTIONS} placeholder="Not recorded" optional error={errors.bloodGroup} />
              </div>
              {field("abhaNumber", "ABHA number", { optional: true, inputMode: "numeric", maxLength: 17, placeholder: "12-3456-7890-1234" })}
              <div className="sm:col-span-2">
                {field("patientCode", "Patient ID", {
                  optional: mode === "new",
                  maxLength: 20,
                  autoComplete: "off",
                  hint: mode === "new" ? "The hospital's own ID (UHID), if it has one. Leave empty and the portal gives one." : undefined,
                })}
              </div>
            </div>
          </fieldset>

          <fieldset className="card p-5 sm:p-6">
            <legend className="sr-only">Contact</legend>
            <h2 className="text-base font-bold">Contact</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {field("mobile", "Mobile number", {
                inputMode: "numeric",
                maxLength: 14,
                placeholder: "98765 43210",
                required: true,
                hint: mode === "new" ? "This number signs in with a WhatsApp code." : "Changing it doesn't change who signs in: link a number on the record for that.",
              })}
              {field("email", "Email", { type: "email", optional: true, maxLength: 255, autoComplete: "off" })}
              <div className="sm:col-span-2">{field("address", "Address", { optional: true, maxLength: 500, autoComplete: "off" })}</div>
              {field("emergencyContactName", "Emergency contact name", { optional: true, maxLength: 150, autoComplete: "off" })}
              {field("emergencyContactPhone", "Emergency contact phone", { optional: true, inputMode: "numeric", maxLength: 14 })}
            </div>
          </fieldset>

          {mode === "new" && (
            <fieldset className="card p-5 sm:p-6">
              <legend className="sr-only">Sign-in</legend>
              <h2 className="text-base font-bold">Sign-in</h2>
              <p className="mt-1 text-sm text-muted">
                {form.mobile.replace(/\D/g, "").length >= 10 ? formatMobile(`+91${form.mobile.replace(/\D/g, "").slice(-10)}`) : "The mobile number above"} will sign in with a
                WhatsApp code. If it already signs in for family, this patient is added to that login.
              </p>
              <div className="mt-4 grid gap-4">
                <div id="field-relation" className="sm:max-w-xs">
                  <SelectField label="The mobile's owner is the patient's" value={relation} onChange={setRelation} options={RELATION_OPTIONS} error={errors.relation} />
                </div>
                <div id="field-signInEmail">
                  <EmailSignIn
                    checked={withEmail}
                    onToggle={(v) => {
                      setWithEmail(v);
                      if (v && !signInEmail) setSignInEmail(form.email);
                    }}
                    email={signInEmail}
                    onEmail={setSignInEmail}
                    error={errors.signInEmail}
                  />
                </div>
              </div>
            </fieldset>
          )}

          {duplicates && (
            <section role="alert" aria-labelledby="dup-title" className="rounded-[var(--radius-card)] border border-line bg-warn-soft p-5">
              <h2 id="dup-title" className="flex items-center gap-2 font-bold">
                <AlertIcon size={18} className="text-warn" /> This may be a patient already on record
              </h2>
              <p className="mt-1 text-sm text-ink-soft">Same date of birth, and the same name or mobile. Open the record to check before going on.</p>
              <ul className="mt-3 divide-y divide-line rounded-[var(--radius-control)] bg-surface ring-1 ring-line">
                {duplicates.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <span className="min-w-0">
                      <span className="block font-semibold">{d.fullName}</span>
                      <span className="block text-sm text-muted tabular">
                        {d.patientCode} · {formatDate(d.dob)} · {formatMobile(d.mobile)}
                      </span>
                    </span>
                    <a href={`${base}/patients/view?uuid=${d.id}`} target="_blank" rel="noopener" className="text-sm font-semibold text-brand hover:underline">
                      Open record (new tab)
                    </a>
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <TextField
                  label="Why is this a different person?"
                  value={reason}
                  onChange={setReason}
                  maxLength={300}
                  hint="For example: twins, or a relative with the same name. Kept in the audit log."
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                <button type="button" className="btn" disabled={busy || reason.trim().length < 5} onClick={() => void submit(reason.trim())}>
                  {busy ? "Saving…" : mode === "new" ? "Register anyway" : "Save anyway"}
                </button>
                <button type="button" className="btn-secondary" disabled={busy} onClick={() => setDuplicates(null)}>Change the details</button>
              </div>
            </section>
          )}

          {errors.form && (
            <p role="alert" className="flex items-start gap-2 rounded-[var(--radius-control)] bg-bad-soft px-4 py-3 text-sm text-bad">
              <AlertIcon size={18} className="mt-px shrink-0" /> {errors.form}
            </p>
          )}

          {!duplicates && (
            <div className="flex flex-wrap gap-3">
              <button className="btn" disabled={busy}>{busy ? "Saving…" : mode === "new" ? "Register patient" : "Save changes"}</button>
              <Link href={back} className="btn-secondary">Cancel</Link>
            </div>
          )}
        </form>
      )}
    </>
  );
}

function Created({ created, base, onAnother }: { created: { result: PatientCreated; name: string }; base: string; onAnother: () => void }) {
  const { result, name } = created;
  return (
    <div className="max-w-2xl">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ok-soft text-ok" aria-hidden="true">
        <CheckIcon size={24} />
      </span>
      <h1 className="mt-4 text-[26px] leading-tight font-extrabold sm:text-[30px]">{name} is registered</h1>
      <p className="mt-1 text-muted">
        Patient ID <span className="font-semibold text-ink tabular">{result.patientCode}</span>.{" "}
        {result.login.joinedExisting
          ? `${formatMobile(result.login.mobile)} already signed in for family; this patient was added to that login.`
          : `${formatMobile(result.login.mobile)} can now sign in with a WhatsApp code.`}{" "}
        They give consent at their first sign-in.
      </p>
      {result.login.temporaryPassword && <TemporaryPasswordNotice className="mt-5" temp={result.login.temporaryPassword} who={name} />}
      {result.login.keptOwnPassword && (
        <p className="mt-4 text-sm text-muted">That login already has its own password, so no temporary one was made. They can keep using it.</p>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={`${base}/patients/view?uuid=${result.id}`} className="btn">Open the record</Link>
        <button type="button" className="btn-secondary" onClick={onAnother}>Register another</button>
      </div>
    </div>
  );
}
