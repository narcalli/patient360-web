"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth-layout";
import { InfoIcon, MailIcon, PhoneIcon } from "@/components/icons";
import { ErrorNote, OtpSignIn } from "@/components/otp-sign-in";
import { NextStep, PasswordField, rememberMethod, signInError, storedMethod, type Method, type Outcome } from "@/components/sign-in-steps";
import { api } from "@/lib/api";

const METHODS: { value: Method; label: string; icon: typeof PhoneIcon }[] = [
  { value: "mobile", label: "Mobile & OTP", icon: PhoneIcon },
  { value: "email", label: "Email & password", icon: MailIcon },
];

/**
 * One sign-in page for everyone: patients, lab partners and admins (US-01, US-07, US-12). Two ways in: mobile number
 * and a WhatsApp code, or email and password. The API works out who it is and what comes next (an admin's
 * authenticator code, or a choice when one number is registered twice); the entry page then opens their home.
 */
export default function LoginPage() {
  const router = useRouter();
  const [method, setMethod] = useState<Method>(storedMethod);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const choose = (m: Method) => {
    setMethod(m);
    rememberMethod(m);
    setNotice(null);
  };
  const proceed = (o: Outcome) => (o.next === "done" ? router.replace("/") : setOutcome(o));

  if (outcome) {
    return (
      <AuthLayout terms>
        <NextStep
          outcome={outcome}
          onBack={() => setOutcome(null)}
          onExpired={() => {
            setOutcome(null);
            setNotice("That took too long. Please sign in again.");
          }}
        />
      </AuthLayout>
    );
  }

  const switcher = <MethodSwitch method={method} onChange={choose} />;
  return (
    <AuthLayout terms>
      {notice && <ErrorNote text={notice} />}
      {method === "mobile" ? (
        <OtpSignIn<Outcome>
          top={switcher}
          sendPath="/auth/otp/send"
          verifyPath="/auth/otp/verify"
          intro="Enter your registered mobile number. We'll send you a one-time code on WhatsApp."
          onVerified={proceed}
        />
      ) : (
        <PasswordSignIn top={switcher} onSignedIn={proceed} />
      )}
    </AuthLayout>
  );
}

/** The two ways in, as a pair of toggle buttons. The choice is remembered on this device. */
function MethodSwitch({ method, onChange }: { method: Method; onChange: (m: Method) => void }) {
  return (
    <div role="group" aria-label="Sign in with" className="mt-5 grid grid-cols-2 gap-1 rounded-full border border-line bg-subtle p-1">
      {METHODS.map((m) => {
        const on = method === m.value;
        return (
          <button
            key={m.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(m.value)}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold transition-colors duration-150 ${
              on ? "bg-surface text-ink shadow-[var(--shadow-card)] ring-1 ring-line" : "text-muted hover:text-ink"
            }`}
          >
            <m.icon size={17} aria-hidden="true" />
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

function PasswordSignIn({ top, onSignedIn }: { top: React.ReactNode; onSignedIn: (o: Outcome) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const o = await api.post<Outcome>("/auth/password", { email: email.trim(), password });
      setPassword("");
      onSignedIn(o);
    } catch (e) {
      setError(signInError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (email.trim() && password) void submit();
      }}
    >
      <h1 className="text-[28px] leading-tight font-extrabold">Sign in</h1>
      {top}
      <p className="mt-5 text-[15px] leading-relaxed text-muted">Use the email and password you set up in this portal.</p>

      <label htmlFor="email" className="mt-6 block text-sm font-semibold">Email</label>
      <input
        id="email"
        type="email"
        className="field mt-2"
        autoComplete="username"
        spellCheck={false}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoFocus
      />

      <PasswordField id="password" label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
      <p className="mt-2 text-right">
        <Link href="/login/forgot" className="text-sm font-semibold text-brand hover:underline">Forgot password?</Link>
      </p>

      {error && <ErrorNote text={error} />}

      <button className="btn mt-6 w-full" disabled={busy || !email.trim() || !password}>
        {busy ? "Checking…" : "Sign in"}
      </button>

      <p className="mt-6 flex items-start gap-2 text-sm text-muted">
        <InfoIcon size={16} className="mt-0.5 shrink-0" />
        No password yet? Sign in with your mobile number, then add an email and password from your profile or account page.
      </p>
    </form>
  );
}
