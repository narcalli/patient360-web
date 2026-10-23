"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { IdCardIcon, KeyIcon, MailIcon, PhoneIcon, PlusIcon, ShieldIcon } from "@/components/icons";
import {
  EmptyState,
  ErrorBanner,
  FormDialog,
  PageHeader,
  RowsSkeleton,
  SelectField,
  StatusBadge,
  TemporaryPasswordNotice,
  TextField,
  useToast,
  useUrlState,
} from "@/components/staff-ui";
import { api, ApiError, type StaffRoleCode, type StaffUserRow, type TemporaryPassword, type UserOptions } from "@/lib/api";
import { formatDateTime, formatMobile } from "@/lib/format";

/**
 * Users: everyone who signs in for the hospital and its lab partners, by type. Admins add people of every type,
 * give temporary passwords (shown once; changed at the first sign-in), reset an admin's authenticator, and switch
 * people off. Nobody can do these to themselves, and the last person who can manage users always stays.
 */
export default function UsersPage() {
  return (
    <Suspense>
      <Users />
    </Suspense>
  );
}

type Action = { kind: "status"; user: StaffUserRow } | { kind: "temporary"; user: StaffUserRow } | { kind: "authenticator"; user: StaffUserRow };

const ACTION_ERRORS: Record<string, string> = {
  LAST_ADMIN: "This is the last active person who can manage users, so they stay on.",
  CANNOT_CHANGE_SELF: "You can't do this to your own account. Use Account instead.",
  EMAIL_REQUIRED: "Add an email for this person first.",
  EMAIL_IN_USE: "Someone else already signs in with this email.",
};

function Users() {
  const { params, set } = useUrlState();
  const raw = params.get("type");
  const [options, setOptions] = useState<UserOptions | null>(null);
  const [users, setUsers] = useState<StaffUserRow[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [adding, setAdding] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<{ temp: TemporaryPassword; who: string } | null>(null);
  const toast = useToast();
  const type = options?.roles.some((r) => r.code === raw) ? (raw as StaffRoleCode) : null;

  const load = useCallback(async () => {
    setError(false);
    try {
      const [o, u] = await Promise.all([api.get<UserOptions>("/admin/users/options"), api.get<StaffUserRow[]>("/admin/users")]);
      setOptions(o);
      setUsers(u);
    } catch {
      setError(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load, attempt]);

  async function run(a: Action) {
    setBusy(true);
    try {
      if (a.kind === "status") {
        const to = a.user.status === "ACTIVE" ? "DEACTIVATED" : "ACTIVE";
        await api.put(`/admin/users/${a.user.id}/status`, { status: to });
        toast.show(to === "ACTIVE" ? `${a.user.fullName} can sign in again.` : `${a.user.fullName} is switched off and signed out everywhere.`);
      } else if (a.kind === "authenticator") {
        await api.post(`/admin/users/${a.user.id}/reset-authenticator`);
        toast.show(`${a.user.fullName} sets up the authenticator app again at their next sign-in.`);
      }
      setAction(null);
      await load();
    } catch (e) {
      toast.show((e instanceof ApiError && ACTION_ERRORS[e.code]) || "Couldn't make that change. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const shown = users?.filter((u) => !type || u.role.code === type) ?? [];
  const count = (code: StaffRoleCode | null) => users?.filter((u) => !code || u.role.code === code).length ?? 0;

  return (
    <>
      <PageHeader
        title="Users"
        description="Everyone who signs in for the hospital and its lab partners. Patients' logins are made when the patient is registered."
        actions={
          <button type="button" className="btn" disabled={!options} onClick={() => setAdding(true)}>
            <PlusIcon size={18} /> Add a user
          </button>
        }
      />

      {revealed && <TemporaryPasswordNotice className="mt-6" temp={revealed.temp} who={revealed.who} />}

      {options && (
        <div role="group" aria-label="Show" className="mt-6 flex flex-wrap gap-2">
          <button type="button" className="chip" aria-pressed={!type} onClick={() => set({ type: null })}>
            All <span className="tabular text-muted">{count(null)}</span>
          </button>
          {options.roles.map((r) => (
            <button key={r.code} type="button" className="chip" aria-pressed={type === r.code} onClick={() => set({ type: r.code })}>
              {r.label} <span className="tabular text-muted">{count(r.code)}</span>
            </button>
          ))}
        </div>
      )}

      <section aria-label="Users" aria-busy={!users && !error} className="mt-5">
        {error ? (
          <ErrorBanner text="We couldn't load the users. Check your connection." onRetry={() => setAttempt((n) => n + 1)} />
        ) : !users ? (
          <RowsSkeleton />
        ) : shown.length === 0 ? (
          <EmptyState icon={<IdCardIcon size={22} />} title="Nobody of this type yet">
            Add a user to give them a way to sign in.
          </EmptyState>
        ) : (
          <ul className="card divide-y divide-line">
            {shown.map((u) => (
              <UserLine key={u.id} user={u} onAction={setAction} />
            ))}
          </ul>
        )}
      </section>

      {options && <TypesGuide options={options} />}

      {adding && options && (
        <AddDialog
          options={options}
          initialType={type}
          onClose={() => setAdding(false)}
          onDone={async (name, temp) => {
            setAdding(false);
            setRevealed(temp ? { temp, who: name } : null);
            toast.show(`${name} is added.${temp ? "" : " They sign in with a WhatsApp code to their mobile."}`);
            await load();
          }}
        />
      )}

      {action?.kind === "temporary" && (
        <TemporaryDialog
          user={action.user}
          onClose={() => setAction(null)}
          onDone={async (temp) => {
            setAction(null);
            setRevealed({ temp, who: action.user.fullName });
            await load();
          }}
        />
      )}
      {action?.kind === "status" && (
        <ConfirmDialog
          title={`${action.user.status === "ACTIVE" ? "Switch off" : "Reactivate"} ${action.user.fullName}?`}
          confirmLabel={action.user.status === "ACTIVE" ? "Switch off" : "Reactivate"}
          destructive={action.user.status === "ACTIVE"}
          busy={busy}
          onConfirm={() => void run(action)}
          onCancel={() => setAction(null)}
        >
          {action.user.status === "ACTIVE"
            ? "They are signed out everywhere at once and can't sign in until reactivated. What they did stays in the audit log."
            : "They can sign in again with their mobile or their password."}
        </ConfirmDialog>
      )}
      {action?.kind === "authenticator" && (
        <ConfirmDialog title={`Reset ${action.user.fullName}'s two-step sign-in?`} confirmLabel="Reset" busy={busy} onConfirm={() => void run(action)} onCancel={() => setAction(null)}>
          For a lost or new phone. They are signed out everywhere, and at their next sign-in they scan a new QR code with their authenticator app.
        </ConfirmDialog>
      )}
      {toast.ui}
    </>
  );
}

function UserLine({ user: u, onAction }: { user: StaffUserRow; onAction: (a: Action) => void }) {
  const active = u.status === "ACTIVE";
  return (
    <li className={`flex flex-col gap-3 px-4 py-4 sm:px-5 md:flex-row md:items-center md:gap-6 ${active ? "" : "opacity-80"}`}>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-semibold">
          <span className="[overflow-wrap:anywhere]">{u.fullName}</span>
          {u.isMe && <span className="badge bg-brand-soft text-brand">You</span>}
          <span className="badge bg-subtle text-ink-soft ring-1 ring-line ring-inset">{u.role.label}</span>
          {u.lab && <span className="text-sm font-normal text-muted">{u.lab.name}</span>}
        </p>
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          {u.mobile && (
            <span className="inline-flex items-center gap-1.5 tabular"><PhoneIcon size={14} /> {formatMobile(u.mobile)}</span>
          )}
          {u.email && (
            <span className="inline-flex items-center gap-1.5 [overflow-wrap:anywhere]"><MailIcon size={14} className="shrink-0" /> {u.email}</span>
          )}
          <span>{u.lastLoginAt ? `Last signed in ${formatDateTime(u.lastLoginAt)}` : "Never signed in"}</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={u.status} />
        {u.passwordMustChange && (
          <span className="badge bg-warn-soft text-warn">
            <KeyIcon size={13} /> Temporary password{u.passwordExpiresAt ? ` until ${formatDateTime(u.passwordExpiresAt)}` : ""}
          </span>
        )}
        {u.authenticator === "NOT_SET_UP" && (
          <span className="badge bg-subtle text-ink-soft ring-1 ring-line ring-inset">
            <ShieldIcon size={13} /> Two-step not set up
          </span>
        )}
      </div>

      {!u.isMe && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 md:justify-end">
          {active && (
            <button type="button" className="inline-flex min-h-9 items-center text-sm font-semibold text-brand hover:underline" onClick={() => onAction({ kind: "temporary", user: u })}>
              Temporary password
            </button>
          )}
          {active && u.authenticator === "ON" && (
            <button type="button" className="inline-flex min-h-9 items-center text-sm font-semibold text-brand hover:underline" onClick={() => onAction({ kind: "authenticator", user: u })}>
              Reset two-step
            </button>
          )}
          <button
            type="button"
            className={`inline-flex min-h-9 items-center text-sm font-semibold hover:underline ${active ? "text-bad" : "text-brand"}`}
            onClick={() => onAction({ kind: "status", user: u })}
          >
            {active ? "Switch off" : "Reactivate"}
          </button>
        </div>
      )}
    </li>
  );
}

/** What each type may do, straight from the permission table, so nobody has to guess what they are granting. */
function TypesGuide({ options }: { options: UserOptions }) {
  return (
    <section aria-labelledby="types-title" className="mt-8">
      <h2 id="types-title" className="text-base font-bold">What each type can do</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-3">
        {options.roles.map((r) => (
          <div key={r.code} className="card p-5">
            <p className="font-semibold">{r.label}</p>
            {r.description && <p className="mt-1 text-sm text-muted">{r.description}</p>}
            <ul className="mt-3 space-y-1.5 text-sm">
              {r.permissions.map((p) => (
                <li key={p.code} className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                  {p.label}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

type AddErrors = Partial<Record<"fullName" | "role" | "lab" | "mobile" | "email" | "form", string>>;

function AddDialog({
  options,
  initialType,
  onClose,
  onDone,
}: {
  options: UserOptions;
  initialType: StaffRoleCode | null;
  onClose: () => void;
  onDone: (name: string, temp: TemporaryPassword | null) => Promise<void>;
}) {
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<string>(initialType ?? "");
  const [lab, setLab] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [temporary, setTemporary] = useState(false);
  const [errors, setErrors] = useState<AddErrors>({});
  const [busy, setBusy] = useState(false);
  const type = options.roles.find((r) => r.code === role);

  async function submit() {
    const digits = mobile.replace(/\D/g, "");
    const local: AddErrors = {
      ...(fullName.trim().length < 2 && { fullName: "Enter their full name." }),
      ...(!type && { role: "Choose a type." }),
      ...(type?.needsLab && !lab && { lab: "Choose the lab they work for." }),
      ...(!digits && !email.trim() && { mobile: "Give a mobile number, an email, or both." }),
      ...(digits && digits.length < 10 && { mobile: "Enter a 10-digit mobile number." }),
      ...(email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim()) && { email: "Enter a valid email address." }),
      ...(temporary && !email.trim() && { email: "A temporary password needs an email to sign in with." }),
    };
    if (Object.keys(local).length) return setErrors(local);
    setBusy(true);
    setErrors({});
    try {
      const r = await api.post<{ id: number; temporaryPassword: TemporaryPassword | null }>("/admin/users", {
        fullName: fullName.trim(),
        role,
        ...(type?.needsLab ? { labPartnerId: Number(lab) } : {}),
        ...(digits ? { mobile: digits } : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
        temporaryPassword: temporary,
      });
      await onDone(fullName.trim(), r.temporaryPassword);
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "";
      if (code === "EMAIL_IN_USE") setErrors({ email: "Someone already signs in with this email." });
      else if (code === "MOBILE_OR_EMAIL_IN_USE") setErrors({ mobile: "This mobile number or email already belongs to a user." });
      else if (code === "LAB_REQUIRED") setErrors({ lab: "Choose an active lab." });
      else if (code === "VALIDATION") setErrors({ form: "Check the mobile number and email." });
      else setErrors({ form: "Couldn't add this user. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormDialog title="Add a user" submitLabel="Add user" busy={busy} error={errors.form} onSubmit={() => void submit()} onClose={onClose}>
      <TextField label="Full name" value={fullName} onChange={setFullName} error={errors.fullName} maxLength={150} autoComplete="off" />
      <SelectField
        label="Type"
        value={role}
        onChange={setRole}
        options={options.roles.map((r) => [r.code, r.label])}
        placeholder="Choose…"
        error={errors.role}
        hint={type?.description ?? undefined}
      />
      {type?.needsLab && (
        <SelectField
          label="Lab"
          value={lab}
          onChange={setLab}
          options={options.labs.map((l) => [String(l.id), l.name])}
          placeholder={options.labs.length ? "Choose…" : "No active labs: add one under Lab partners"}
          error={errors.lab}
        />
      )}
      <TextField
        label="Mobile number"
        value={mobile}
        onChange={setMobile}
        error={errors.mobile}
        optional
        inputMode="numeric"
        maxLength={14}
        placeholder="98765 43210"
        hint="Signs in with a WhatsApp code to this number."
      />
      <TextField label="Email" type="email" value={email} onChange={setEmail} error={errors.email} optional maxLength={255} autoComplete="off" />
      <label className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border border-line p-4">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--color-brand)]" checked={temporary} onChange={(e) => setTemporary(e.target.checked)} />
        <span>
          <span className="block text-sm font-semibold">Give a temporary password</span>
          <span className="block text-sm text-muted">
            Shown once, to pass on. They sign in with the email and choose their own password before anything else.
            {type?.needsAuthenticator ? " Then they set up the authenticator app." : ""}
          </span>
        </span>
      </label>
    </FormDialog>
  );
}

function TemporaryDialog({ user, onClose, onDone }: { user: StaffUserRow; onClose: () => void; onDone: (t: TemporaryPassword) => Promise<void> }) {
  const [email, setEmail] = useState(user.email ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email address.");
    setBusy(true);
    setError(null);
    try {
      await onDone(await api.post<TemporaryPassword>(`/admin/users/${user.id}/temporary-password`, { email: email.trim() }));
    } catch (e) {
      setError((e instanceof ApiError && ACTION_ERRORS[e.code]) || "Couldn't make a temporary password. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormDialog
      title={`Temporary password for ${user.fullName}`}
      description={user.hasPassword ? "Their current password stops working and they're signed out everywhere." : "They can still sign in with a WhatsApp code too, if they have a mobile."}
      submitLabel="Make temporary password"
      busy={busy}
      onSubmit={() => void submit()}
      onClose={onClose}
    >
      <TextField label="Email they'll sign in with" type="email" value={email} onChange={setEmail} error={error} maxLength={255} autoComplete="off" />
    </FormDialog>
  );
}
