"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { CheckIcon, ChevronLeft, ChevronRight, CopyIcon, EyeIcon, KeyIcon } from "./icons";
import { ErrorNote, minutes, RATE_LIMITED } from "./otp-sign-in";

/**
 * What the API says comes after a mobile code or a password (POST /auth/otp/verify, /auth/password). The portal
 * never decides the role: "done" means signed in, and the entry page asks /session where this person's home is.
 */
export type Outcome =
  | { next: "done" }
  | { next: "code"; ticket: string }
  | { next: "enrol"; ticket: string; secret: string; otpauthUri: string; qr: boolean[][] }
  | { next: "choose"; ticket: string; options: { as: "patient" | "staff"; label: string }[] }
  | { next: "change"; ticket: string; passwordMin: number };

export function signInError(e: unknown): string {
  if (!(e instanceof ApiError)) return "Something went wrong. Please try again.";
  const left = Number(e.body.attemptsLeft);
  const tries = `${left} ${left === 1 ? "try" : "tries"} left.`;
  if (e.code === "WRONG_CREDENTIALS") return `That email and password don't match. ${tries}`;
  if (e.code === "TEMP_PASSWORD_EXPIRED") return "This temporary password has expired. Ask the hospital for a new one.";
  if (e.code === "CODE_INVALID") return `That code is not right. ${tries} Codes change every 30 seconds.`;
  if (e.code === "LOCKED") return `Too many wrong attempts. Try again in ${minutes(Number(e.body.retryAfterSeconds))}.`;
  if (e.code === "VALIDATION") return "Enter your email address and password.";
  if (e.code === "RATE_LIMITED") return RATE_LIMITED;
  if (e.code === "NETWORK") return "You seem to be offline. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}

/** The steps after the first one: the authenticator code (admins) or picking a role. Back returns to the form. */
export function NextStep({ outcome, onBack, onExpired }: { outcome: Outcome; onBack: () => void; onExpired: () => void }) {
  const router = useRouter();
  const [current, setCurrent] = useState(outcome);

  useEffect(() => {
    if (current.next === "done") router.replace("/");
  }, [current, router]);

  if (current.next === "choose") return <ChooseStep step={current} onBack={onBack} onExpired={onExpired} onNext={setCurrent} />;
  if (current.next === "change") return <ChangeStep step={current} onBack={onBack} onExpired={onExpired} onNext={setCurrent} />;
  if (current.next === "code" || current.next === "enrol") return <CodeStep step={current} onBack={onBack} onExpired={onExpired} onNext={setCurrent} />;
  return <p role="status" className="text-center text-muted">Signing you in…</p>;
}

type StepProps<S> = { step: S; onBack: () => void; onExpired: () => void; onNext: (o: Outcome) => void };

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="mb-6 inline-flex min-h-[40px] items-center gap-1 text-sm font-semibold text-brand" onClick={onClick}>
      <ChevronLeft size={16} /> Back
    </button>
  );
}

/** One mobile number, two logins (a patient account and a staff member): the person picks which to open. */
function ChooseStep({ step, onBack, onExpired, onNext }: StepProps<Extract<Outcome, { next: "choose" }>>) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(as: "patient" | "staff") {
    setBusy(as);
    setError(null);
    try {
      onNext(await api.post<Outcome>("/auth/choose", { ticket: step.ticket, as }));
    } catch (e) {
      if (e instanceof ApiError && e.code === "EXPIRED") return onExpired();
      setError(signInError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <BackButton onClick={onBack} />
      <h1 className="text-[28px] leading-tight font-extrabold">Continue as</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">This mobile number is registered more than once. Choose which one to open.</p>
      <div className="mt-6 space-y-3">
        {step.options.map((o) => (
          <button
            key={o.as}
            type="button"
            className="flex min-h-14 w-full items-center justify-between gap-3 rounded-[var(--radius-control)] border border-line bg-surface px-4 text-left font-semibold transition-colors duration-150 hover:border-brand hover:bg-subtle disabled:opacity-60"
            disabled={busy !== null}
            onClick={() => void pick(o.as)}
          >
            {busy === o.as ? "Opening…" : o.label}
            <ChevronRight size={18} className="shrink-0 text-muted" />
          </button>
        ))}
      </div>
      {error && <ErrorNote text={error} />}
    </div>
  );
}

/**
 * A temporary password from the hospital: the person chooses their own before anything else. There is no session
 * yet, so nothing in the portal opens until this is done.
 */
function ChangeStep({ step, onBack, onExpired, onNext }: StepProps<Extract<Outcome, { next: "change" }>>) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (password.length < step.passwordMin) return setFieldError(`Use at least ${step.passwordMin} characters.`);
    setBusy(true);
    setError(null);
    setFieldError(null);
    try {
      onNext(await api.post<Outcome>("/auth/password/change", { ticket: step.ticket, newPassword: password }));
    } catch (e) {
      if (e instanceof ApiError && e.code === "EXPIRED") return onExpired();
      if (e instanceof ApiError && e.code === "SAME_AS_TEMPORARY") setFieldError("Choose a new password, not the temporary one.");
      else if (e instanceof ApiError && e.code === "VALIDATION") setFieldError(`Use at least ${step.passwordMin} characters.`);
      else setError(signInError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (password) void submit();
      }}
    >
      <BackButton onClick={onBack} />
      <h1 className="text-[28px] leading-tight font-extrabold">Choose your own password</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        You signed in with a temporary password from the hospital. Set your own to continue; the temporary one stops working.
      </p>
      <PasswordField
        id="own-password"
        label="New password"
        value={password}
        onChange={(v) => {
          setPassword(v);
          setFieldError(null);
        }}
        autoComplete="new-password"
        hint={`At least ${step.passwordMin} characters. A few words you'll remember works well.`}
        error={fieldError}
      />
      {error && <ErrorNote text={error} />}
      <button className="btn mt-6 w-full" disabled={busy || !password}>
        {busy ? "Saving…" : "Save and continue"}
      </button>
    </form>
  );
}

/** Admins: the authenticator code. The first time, set up the app first (QR code or key). */
function CodeStep({ step, onBack, onExpired, onNext }: StepProps<Extract<Outcome, { next: "code" | "enrol" }>>) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const enrol = step.next === "enrol" ? step : null;

  useEffect(() => {
    if (!enrol) codeRef.current?.focus();
  }, [enrol]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      onNext(await api.post<Outcome>("/auth/totp", { ticket: step.ticket, code }));
    } catch (e) {
      if (e instanceof ApiError && e.code === "EXPIRED") return onExpired();
      setError(signInError(e));
      setCode("");
      codeRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length === 6) void submit();
      }}
    >
      <BackButton onClick={onBack} />

      {enrol ? (
        <>
          <h1 className="text-[28px] leading-tight font-extrabold">Set up two-step sign-in</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            Admins can see every patient, so signing in needs a code from your phone as well. You set this up once.
          </p>
          <ol className="mt-6 space-y-5 text-[15px]">
            <Step n={1}>Open an authenticator app on your phone, such as Google Authenticator or Microsoft Authenticator.</Step>
            <Step n={2}>
              Scan this code with the app.
              <QrCode matrix={enrol.qr} label="QR code to add this account to your authenticator app" />
              <SetupKey secret={enrol.secret} />
            </Step>
            <Step n={3}>Type the 6-digit code the app shows. You can add a second phone later, under Account.</Step>
          </ol>
        </>
      ) : (
        <>
          <h1 className="text-[28px] leading-tight font-extrabold">Enter your code</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">Open your authenticator app and type the 6-digit code it shows for this portal.</p>
        </>
      )}

      <label htmlFor="totp" className="mt-6 block text-sm font-semibold">6-digit code</label>
      <input
        id="totp"
        ref={codeRef}
        className="field mt-2 text-center text-2xl tracking-[0.5em] tabular"
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="••••••"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
      />

      {error && <ErrorNote text={error} />}

      <button className="btn mt-6 w-full" disabled={busy || code.length !== 6}>
        {busy ? "Checking…" : enrol ? "Confirm and sign in" : "Sign in"}
      </button>
      {!enrol && (
        <p className="mt-6 flex items-start gap-2 text-sm text-muted">
          <KeyIcon size={16} className="mt-0.5 shrink-0" /> Lost your phone? Use a code from another authenticator app you added, or ask the portal&apos;s technical team to reset your two-step sign-in.
        </p>
      )}
    </form>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-on-brand" aria-hidden="true">{n}</span>
      <div className="min-w-0 flex-1 pt-0.5">{children}</div>
    </li>
  );
}

/**
 * The QR code drawn from the API's module matrix. Always dark on white with a quiet zone, whatever the theme,
 * because scanners need that contrast.
 */
export function QrCode({ matrix, label }: { matrix: boolean[][]; label: string }) {
  const size = matrix.length;
  const pad = 4;
  let d = "";
  matrix.forEach((row, y) => row.forEach((on, x) => on && (d += `M${x + pad} ${y + pad}h1v1h-1z`)));
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size + pad * 2} ${size + pad * 2}`}
      shapeRendering="crispEdges"
      className="mt-3 h-44 w-44 rounded-[var(--radius-control)] border border-line bg-white text-black"
    >
      <path d={d} fill="currentColor" />
    </svg>
  );
}

/** The same secret as text, for setting the app up by hand; shown in groups of 4 and copyable in one tap. */
export function SetupKey({ secret }: { secret: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3">
      <p className="text-sm text-muted">Can&apos;t scan? Enter this key in the app instead:</p>
      <div className="mt-1.5 flex items-center gap-2">
        <code className="min-w-0 flex-1 rounded-[var(--radius-control)] bg-subtle px-3 py-2 font-mono text-sm tracking-wider [overflow-wrap:anywhere]">
          {secret.match(/.{1,4}/g)?.join(" ")}
        </code>
        <button
          type="button"
          className="icon-btn"
          aria-label={copied ? "Key copied" : "Copy key"}
          title="Copy key"
          onClick={() =>
            void navigator.clipboard?.writeText(secret).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            })
          }
        >
          {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
        </button>
      </div>
    </div>
  );
}

/** A password input with show/hide. Paste and password managers work: nothing here blocks them. */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  hint,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: "current-password" | "new-password";
  hint?: string;
  error?: string | null;
}) {
  const [show, setShow] = useState(false);
  const described = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <>
      <label htmlFor={id} className="mt-5 block text-sm font-semibold">{label}</label>
      <div className="relative mt-2">
        <input
          id={id}
          type={show ? "text" : "password"}
          className="field pr-14"
          autoComplete={autoComplete}
          aria-describedby={described}
          aria-invalid={error ? true : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="absolute top-1/2 right-1.5 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-subtle hover:text-ink"
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          onClick={() => setShow((s) => !s)}
        >
          <EyeIcon size={18} />
        </button>
      </div>
      {hint && <p id={`${id}-hint`} className="mt-1.5 text-sm text-muted">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1.5 text-sm font-semibold text-bad">{error}</p>}
    </>
  );
}

// ─── The sign-in method (mobile or email), remembered on this device ─────────

export type Method = "mobile" | "email";
const METHOD_KEY = "p360.signin.method";

export function storedMethod(): Method {
  try {
    return localStorage.getItem(METHOD_KEY) === "email" ? "email" : "mobile";
  } catch {
    return "mobile";
  }
}

export function rememberMethod(m: Method) {
  try {
    localStorage.setItem(METHOD_KEY, m);
  } catch {
    // Storage blocked: the choice lasts for this visit.
  }
}
