"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { formatMobile } from "@/lib/format";
import { CheckIcon, KeyIcon, MailIcon, PhoneIcon } from "./icons";
import { ErrorNote, minutes, RATE_LIMITED } from "./otp-sign-in";
import { PasswordField } from "./sign-in-steps";

/** GET/PUT /api/session/sign-in: the signed-in person's own ways in. */
interface Settings {
  /** Null for staff added with an email only (admins usually are). */
  mobile: string | null;
  email: string | null;
  hasPassword: boolean;
  /** Admins: the email is fixed (it names them in the authenticator app too). */
  emailLocked: boolean;
  passwordMin: number;
}

type Errors = { email?: string; current?: string; next?: string; form?: string };

function saveErrors(e: unknown, min: number): Errors {
  if (!(e instanceof ApiError)) return { form: "Couldn't save. Please try again." };
  const issues = (e.body.issues as string[] | undefined) ?? [];
  if (e.code === "EMAIL_IN_USE") return { email: "This email is already used by another account. Use a different one." };
  if (e.code === "CURRENT_PASSWORD_REQUIRED") return { current: "Enter your current password." };
  if (e.code === "WRONG_PASSWORD") {
    const left = Number(e.body.attemptsLeft);
    return { current: `That password is not right. ${left} ${left === 1 ? "try" : "tries"} left.` };
  }
  if (e.code === "LOCKED") return { form: `Too many wrong passwords. Try again in ${minutes(Number(e.body.retryAfterSeconds))}.` };
  if (e.code === "VALIDATION") {
    return {
      ...(issues.some((i) => i.includes("email")) && { email: "Enter a valid email address." }),
      ...(issues.some((i) => i.includes("newPassword")) && { next: `Use at least ${min} characters.` }),
    };
  }
  if (e.code === "RATE_LIMITED") return { form: RATE_LIMITED };
  if (e.code === "NETWORK") return { form: "You seem to be offline. Check your connection and try again." };
  return { form: "Couldn't save. Please try again." };
}

/**
 * How this person signs in: their mobile and a WhatsApp code if they have a mobile; an email and password once they add one.
 * Patients see this on Profile, staff on Account. Changing the password signs other devices out.
 */
export function SignInSettings({ className = "" }: { className?: string }) {
  const [s, setS] = useState<Settings | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    api.get<Settings>("/session/sign-in").then(setS).catch(() => setLoadFailed(true));
  }, []);

  function open() {
    setEmail(s?.email ?? "");
    setCurrent("");
    setNext("");
    setErrors({});
    setSaved(null);
    setEditing(true);
  }

  async function save() {
    if (!s) return;
    const local: Errors = {
      ...(!/^\S+@\S+\.\S+$/.test(email.trim()) && { email: "Enter a valid email address." }),
      ...(s.hasPassword && !current && { current: "Enter your current password." }),
      ...(next.length < s.passwordMin && { next: `Use at least ${s.passwordMin} characters.` }),
    };
    if (Object.keys(local).length) return setErrors(local);
    setBusy(true);
    setErrors({});
    try {
      const r = await api.put<Settings>("/session/sign-in", { email: email.trim(), currentPassword: s.hasPassword ? current : undefined, newPassword: next });
      setSaved(
        s.hasPassword
          ? "Password changed. Other devices were signed out."
          : `Saved. You can now sign in with ${r.email} and your password. Other devices were signed out.`,
      );
      setS(r);
      setEditing(false);
    } catch (e) {
      setErrors(saveErrors(e, s.passwordMin));
    } finally {
      setBusy(false);
      setCurrent("");
    }
  }

  return (
    <section aria-labelledby="sign-in-heading" className={`card p-5 sm:p-6 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="sign-in-heading" className="text-base font-bold">Sign-in</h2>
          <p className="mt-0.5 text-sm text-muted">The ways you can sign in to this portal.</p>
        </div>
        {s && !editing && (
          <button type="button" className="btn-secondary" onClick={open}>
            <KeyIcon size={16} aria-hidden="true" />
            {s.hasPassword ? "Change password" : "Add email and password"}
          </button>
        )}
      </div>

      {loadFailed ? (
        <p role="alert" className="mt-4 text-bad">We couldn&apos;t load your sign-in details. Please refresh to try again.</p>
      ) : !s ? (
        <div className="mt-4 space-y-3" aria-hidden="true">
          <span className="skeleton block h-4 w-56" />
          <span className="skeleton block h-4 w-44" />
        </div>
      ) : (
        <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          <Way icon={<PhoneIcon size={18} />} label="Mobile and WhatsApp code" value={s.mobile ? formatMobile(s.mobile) : null} empty="No mobile number" />
          <Way
            icon={<MailIcon size={18} />}
            label="Email and password"
            value={s.hasPassword && s.email ? s.email : null}
            empty="Not set up yet"
          />
        </dl>
      )}

      {saved && (
        <p role="status" className="mt-4 flex items-start gap-2 rounded-[var(--radius-control)] bg-ok-soft px-4 py-3 text-sm text-ok">
          <CheckIcon size={18} className="mt-px shrink-0" /> {saved}
        </p>
      )}

      {s && editing && (
        <form
          className="mt-5 max-w-md border-t border-line pt-1"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label htmlFor="sign-in-email" className="mt-5 block text-sm font-semibold">Email</label>
          <input
            id="sign-in-email"
            type="email"
            className="field mt-2 disabled:opacity-60"
            autoComplete="username"
            spellCheck={false}
            value={email}
            disabled={s.emailLocked}
            aria-describedby={errors.email ? "sign-in-email-error" : s.emailLocked ? "sign-in-email-hint" : undefined}
            aria-invalid={errors.email ? true : undefined}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus={!s.emailLocked}
          />
          {s.emailLocked && <p id="sign-in-email-hint" className="mt-1.5 text-sm text-muted">Admin emails are changed by the portal&apos;s technical team.</p>}
          {errors.email && <p id="sign-in-email-error" className="mt-1.5 text-sm font-semibold text-bad">{errors.email}</p>}

          {s.hasPassword && (
            <PasswordField id="current-password" label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" error={errors.current} />
          )}
          <PasswordField
            id="new-password"
            label={s.hasPassword ? "New password" : "Password"}
            value={next}
            onChange={setNext}
            autoComplete="new-password"
            hint={`At least ${s.passwordMin} characters. A few words you'll remember works well.`}
            error={errors.next}
          />

          {errors.form && <ErrorNote text={errors.form} />}

          <div className="mt-6 flex flex-wrap gap-3">
            <button className="btn" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}

function Way({ icon, label, value, empty }: { icon: React.ReactNode; label: string; value: string | null; empty?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand" aria-hidden="true">{icon}</span>
      <div className="min-w-0">
        <dt className="text-sm text-muted">{label}</dt>
        <dd className="mt-0.5 font-semibold [overflow-wrap:anywhere]">{value ?? <span className="font-normal text-muted italic">{empty}</span>}</dd>
      </div>
    </div>
  );
}
