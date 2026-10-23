"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { AlertIcon, CloseIcon, FlaskIcon, PlusIcon } from "@/components/icons";
import { EmptyState, ErrorBanner, PageHeader, RowsSkeleton, StatusBadge, useToast } from "@/components/staff-ui";
import { api, ApiError, type LabPartner, type LabPartnerUser } from "@/lib/api";
import { formatDate, formatDateTime, formatMobile } from "@/lib/format";

type Confirm =
  | { kind: "lab"; lab: LabPartner; to: "ACTIVE" | "DEACTIVATED" }
  | { kind: "user"; lab: LabPartner; user: LabPartnerUser; to: "ACTIVE" | "DEACTIVATED" };

/**
 * US-15: lab partner accounts. A lab and the people who sign in for it (mobile + OTP). Deactivating a lab signs all
 * its people out on their next click; deactivating one person leaves the rest working. Every change is audited.
 */
export default function LabPartnersPage() {
  const [labs, setLabs] = useState<LabPartner[] | null>(null);
  const [error, setError] = useState(false);
  const [adding, setAdding] = useState<{ lab: LabPartner | null } | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const load = useCallback(
    () =>
      api
        .get<LabPartner[]>("/admin/lab-partners")
        .then((l) => {
          setLabs(l);
          setError(false);
        })
        .catch(() => setError(true)),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);

  async function changeStatus(c: Confirm) {
    setBusy(true);
    try {
      if (c.kind === "lab") await api.put(`/admin/lab-partners/${c.lab.id}/status`, { status: c.to });
      else await api.put(`/admin/users/${c.user.id}/status`, { status: c.to });
      const who = c.kind === "lab" ? c.lab.name : c.user.fullName;
      toast.show(`${who} ${c.to === "ACTIVE" ? "reactivated" : "deactivated"}.`);
      setConfirm(null);
      await load();
    } catch {
      toast.show("That didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Lab partners"
        description="Labs that upload results, and the people who sign in for them with their mobile number."
        actions={
          <button className="btn" onClick={() => setAdding({ lab: null })}>
            <PlusIcon size={18} /> Add lab partner
          </button>
        }
      />

      <div className="mt-6 space-y-5" aria-busy={!labs && !error}>
        {error ? (
          <ErrorBanner text="We couldn't load the lab partners. Check your connection." onRetry={() => void load()} />
        ) : !labs ? (
          <RowsSkeleton />
        ) : labs.length === 0 ? (
          <EmptyState icon={<FlaskIcon size={22} />} title="No lab partners yet">
            Add a lab and its first person; they sign in with their mobile number.
          </EmptyState>
        ) : (
          labs.map((lab) => <LabCard key={lab.id} lab={lab} onAddUser={() => setAdding({ lab })} onConfirm={setConfirm} />)
        )}
      </div>

      {adding && (
        <AddDialog
          lab={adding.lab}
          onClose={() => setAdding(null)}
          onDone={async (text) => {
            setAdding(null);
            toast.show(text);
            await load();
          }}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={confirmTitle(confirm)}
          confirmLabel={confirm.to === "ACTIVE" ? "Reactivate" : "Deactivate"}
          destructive={confirm.to === "DEACTIVATED"}
          busy={busy}
          onConfirm={() => void changeStatus(confirm)}
          onCancel={() => setConfirm(null)}
        >
          {confirmBody(confirm)}
        </ConfirmDialog>
      )}
      {toast.ui}
    </>
  );
}

const confirmTitle = (c: Confirm) =>
  c.kind === "lab"
    ? `${c.to === "ACTIVE" ? "Reactivate" : "Deactivate"} ${c.lab.name}?`
    : `${c.to === "ACTIVE" ? "Reactivate" : "Deactivate"} ${c.user.fullName}?`;

function confirmBody(c: Confirm) {
  if (c.kind === "lab") {
    return c.to === "DEACTIVATED"
      ? `Everyone at ${c.lab.name} is signed out on their next click and can't sign in again until the lab is reactivated. Their uploads stay on patients' records.`
      : `People at ${c.lab.name} whose own accounts are active can sign in again.`;
  }
  return c.to === "DEACTIVATED"
    ? `${c.user.fullName} is signed out on their next click and can't sign in. Others at ${c.lab.name} are not affected.`
    : `${c.user.fullName} can sign in again${c.lab.status === "ACTIVE" ? "" : " once the lab is reactivated"}.`;
}

function LabCard({ lab, onAddUser, onConfirm }: { lab: LabPartner; onAddUser: () => void; onConfirm: (c: Confirm) => void }) {
  const active = lab.status === "ACTIVE";
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className={`card overflow-hidden ${active ? "" : "opacity-90"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-brand-soft text-brand">
            <FlaskIcon size={20} />
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="flex flex-wrap items-center gap-2 text-base font-bold">
              <span className="[overflow-wrap:anywhere]">{lab.name}</span> <StatusBadge status={lab.status} />
            </h2>
            <p className="text-sm text-muted tabular">
              {lab.users.length} {lab.users.length === 1 ? "person" : "people"} · {lab.uploadCount} {lab.uploadCount === 1 ? "upload" : "uploads"} · added {formatDate(lab.createdAt.slice(0, 10))}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary min-h-10 px-3 text-sm" onClick={onAddUser}>
            <PlusIcon size={16} /> Add person
          </button>
          <button
            className={`btn-ghost ${active ? "text-bad hover:bg-bad-soft" : ""}`}
            onClick={() => onConfirm({ kind: "lab", lab, to: active ? "DEACTIVATED" : "ACTIVE" })}
          >
            {active ? "Deactivate lab" : "Reactivate lab"}
          </button>
        </div>
      </div>

      {lab.users.length === 0 ? (
        <p className="p-5 text-sm text-muted">Nobody can sign in for this lab yet. Add a person.</p>
      ) : (
        <ul className="divide-y divide-line">
          {lab.users.map((u) => {
            const on = u.status === "ACTIVE";
            return (
              <li key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {u.fullName} {!on && <StatusBadge status={u.status} />}
                  </p>
                  <p className="text-sm text-muted tabular [overflow-wrap:anywhere]">
                    {u.mobile ? formatMobile(u.mobile) : u.email}
                    {u.email ? ` · ${u.email}` : ""}
                  </p>
                </div>
                <p className="text-sm text-muted">{u.lastLoginAt ? `Last signed in ${formatDateTime(u.lastLoginAt)}` : "Never signed in"}</p>
                <button
                  className={`btn-ghost ${on ? "text-bad hover:bg-bad-soft" : ""}`}
                  aria-label={`${on ? "Deactivate" : "Reactivate"} ${u.fullName}`}
                  onClick={() => onConfirm({ kind: "user", lab, user: u, to: on ? "DEACTIVATED" : "ACTIVE" })}
                >
                  {on ? "Deactivate" : "Reactivate"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

type Errors = Partial<Record<"name" | "fullName" | "mobile" | "email" | "form", string>>;

/** API validation paths (/user/mobile, /mobile…) to the field they belong to. */
function fieldErrors(e: unknown): Errors {
  if (e instanceof ApiError && e.code === "MOBILE_OR_EMAIL_IN_USE") return { mobile: "This mobile number or email already has a staff account." };
  if (e instanceof ApiError && e.code === "VALIDATION") {
    const issues = (e.body.issues as string[] | undefined) ?? [];
    const out: Errors = {};
    for (const path of issues) {
      if (path.endsWith("/mobile")) out.mobile = "Enter a valid 10-digit Indian mobile number.";
      else if (path.endsWith("/email")) out.email = "Enter a valid email address, or leave it empty.";
      else if (path.endsWith("/fullName")) out.fullName = "Enter the person's full name.";
      else if (path === "/name") out.name = "Enter the lab's name.";
    }
    return Object.keys(out).length ? out : { form: "Some details aren't right. Check them and try again." };
  }
  return { form: "That didn't work. Check your connection and try again." };
}

/** Add a lab with its first person, or a person to an existing lab. A native modal dialog. */
function AddDialog({ lab, onClose, onDone }: { lab: LabPartner | null; onClose: () => void; onDone: (text: string) => Promise<void> }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [form, setForm] = useState({ name: "", fullName: "", mobile: "", email: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    // showModal focuses the first focusable element (Close); start at the first field instead.
    d?.querySelector<HTMLInputElement>("input")?.focus();
  }, []);

  async function submit() {
    setBusy(true);
    setErrors({});
    const user = { fullName: form.fullName.trim(), mobile: form.mobile.replace(/\D/g, ""), ...(form.email.trim() ? { email: form.email.trim() } : {}) };
    try {
      if (lab) {
        await api.post(`/admin/lab-partners/${lab.id}/users`, user);
        await onDone(`${user.fullName} can now sign in for ${lab.name}.`);
      } else {
        await api.post("/admin/lab-partners", { name: form.name.trim(), user });
        await onDone(`${form.name.trim()} added. ${user.fullName} can now sign in.`);
      }
    } catch (e) {
      setErrors(fieldErrors(e));
    } finally {
      setBusy(false);
    }
  }

  const field = (key: keyof typeof form, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, hint?: string) => {
    const err = errors[key];
    const id = `${titleId}-${key}`;
    return (
      <div>
        <label htmlFor={id} className="block text-sm font-semibold">{label}</label>
        <input
          id={id}
          className={`field mt-1.5 ${err ? "border-bad" : ""}`}
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
          aria-invalid={err ? true : undefined}
          aria-describedby={err || hint ? `${id}-note` : undefined}
          {...props}
        />
        {(err || hint) && (
          <p id={`${id}-note`} className={`mt-1.5 flex items-start gap-1.5 text-sm ${err ? "text-bad" : "text-muted"}`}>
            {err && <AlertIcon size={16} className="mt-px shrink-0" />}
            {err ?? hint}
          </p>
        )}
      </div>
    );
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-[var(--radius-card)] border border-line bg-surface p-0 text-ink shadow-[var(--shadow-pop)] backdrop:bg-overlay/60"
    >
      <form
        className="p-6"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id={titleId} className="text-lg font-bold">{lab ? `Add a person to ${lab.name}` : "Add a lab partner"}</h2>
            <p className="mt-1 text-sm text-muted">They sign in with a WhatsApp code sent to this mobile number. Users can give them a temporary password later.</p>
          </div>
          <button type="button" className="icon-btn" aria-label="Close" disabled={busy} onClick={onClose}>
            <CloseIcon size={16} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {!lab && field("name", "Lab name", { required: true, maxLength: 150, autoComplete: "organization" })}
          {!lab && <p className="eyebrow pt-2">First person to sign in</p>}
          {field("fullName", "Full name", { required: true, maxLength: 150, autoComplete: "name" })}
          {field("mobile", "Mobile number", { required: true, inputMode: "numeric", autoComplete: "tel-national", maxLength: 14, placeholder: "98765 43210" }, "10 digits. The sign-in code goes to this number on WhatsApp.")}
          {field("email", "Email (optional)", { type: "email", autoComplete: "email", maxLength: 255 })}
        </div>

        {errors.form && (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-[var(--radius-control)] bg-bad-soft px-4 py-3 text-sm text-bad">
            <AlertIcon size={18} className="mt-px shrink-0" /> {errors.form}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" disabled={busy} onClick={onClose}>Cancel</button>
          <button className="btn" disabled={busy || !form.fullName.trim() || !form.mobile.trim() || (!lab && !form.name.trim())}>
            {busy ? "Saving…" : lab ? "Add person" : "Add lab partner"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
