"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth-layout";
import { CheckIcon, ChevronLeft, ClockIcon, InfoIcon } from "@/components/icons";
import { ErrorNote, minutes, OTP_LENGTH, RATE_LIMITED } from "@/components/otp-sign-in";
import { PasswordField, rememberMethod } from "@/components/sign-in-steps";
import { api, ApiError } from "@/lib/api";

type Sent = { ok: true; resendAfterSeconds: number; expiresInSeconds: number; passwordMin: number };

function sendError(e: unknown): string {
  if (!(e instanceof ApiError)) return "Something went wrong. Please try again.";
  if (e.code === "VALIDATION") return "Enter a valid email address.";
  if (e.code === "TOO_SOON") return `Please wait ${e.body.retryAfterSeconds} seconds before asking for another code.`;
  if (e.code === "LOCKED") return `Too many wrong codes. Try again in ${minutes(Number(e.body.retryAfterSeconds))}.`;
  if (e.code === "RATE_LIMITED") return RATE_LIMITED;
  if (e.code === "NETWORK") return "You seem to be offline. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}

/**
 * Forgot password: the email, then a code sent on WhatsApp to the mobile number on that login, and a new password.
 * The reply never says whether the email is registered. Admins reset theirs through the technical team instead.
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "reset" | "done">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordMin, setPasswordMin] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    if (step === "reset") codeRef.current?.focus();
  }, [step]);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<Sent>("/auth/password/reset/send", { email: email.trim() });
      setResendIn(r.resendAfterSeconds);
      setPasswordMin(r.passwordMin);
      setStep("reset");
    } catch (e) {
      if (e instanceof ApiError && e.code === "TOO_SOON") setResendIn(Number(e.body.retryAfterSeconds));
      setError(sendError(e));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (password.length < passwordMin) return setPasswordError(`Use at least ${passwordMin} characters.`);
    setBusy(true);
    setError(null);
    setPasswordError(null);
    try {
      await api.post("/auth/password/reset", { email: email.trim(), code, newPassword: password });
      setPassword("");
      setStep("done");
    } catch (e) {
      setCode("");
      if (e instanceof ApiError && e.code === "OTP_INVALID") {
        const left = Number(e.body.attemptsLeft);
        setError(`That code is not right. ${left} ${left === 1 ? "try" : "tries"} left.`);
      } else if (e instanceof ApiError && e.code === "EXPIRED") setError("This code has expired. Ask for a new one.");
      else if (e instanceof ApiError && e.code === "VALIDATION") setPasswordError(`Use at least ${passwordMin} characters.`);
      else setError(sendError(e));
      codeRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  if (step === "done") {
    return (
      <AuthLayout>
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ok-soft text-ok" aria-hidden="true">
          <CheckIcon size={24} />
        </span>
        <h1 className="mt-5 text-[28px] leading-tight font-extrabold">Password changed</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          Sign in with your email and new password. For your safety, you&apos;ve been signed out on every device.
        </p>
        <button
          type="button"
          className="btn mt-8 w-full"
          onClick={() => {
            rememberMethod("email");
            router.replace("/login");
          }}
        >
          Sign in
        </button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <Link href="/login" className="mb-6 inline-flex min-h-[40px] items-center gap-1 text-sm font-semibold text-brand">
        <ChevronLeft size={16} /> Back to sign in
      </Link>

      {step === "email" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) void send();
          }}
        >
          <h1 className="text-[28px] leading-tight font-extrabold">Forgot password</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            Enter the email you sign in with. We&apos;ll send a code on WhatsApp to the mobile number on your account.
          </p>
          <label htmlFor="email" className="mt-8 block text-sm font-semibold">Email</label>
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
          {error && <ErrorNote text={error} />}
          <button className="btn mt-6 w-full" disabled={busy || !email.trim()}>
            {busy ? "Sending…" : "Send code"}
          </button>
          <p className="mt-6 flex items-start gap-2 text-sm text-muted">
            <InfoIcon size={16} className="mt-0.5 shrink-0" />
            Hospital admins: ask the portal&apos;s technical team to reset your password.
          </p>
        </form>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length === OTP_LENGTH && password) void reset();
          }}
        >
          <h1 className="text-[28px] leading-tight font-extrabold">Set a new password</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            If <span className="font-semibold text-ink [overflow-wrap:anywhere]">{email.trim()}</span> is registered with us, we have sent a{" "}
            {OTP_LENGTH}-digit code on WhatsApp to the mobile number on that account.
          </p>

          <label htmlFor="code" className="mt-8 block text-sm font-semibold">Code from WhatsApp</label>
          <input
            id="code"
            ref={codeRef}
            className="field mt-2 text-center text-2xl tracking-[0.6em]"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="••••"
            maxLength={OTP_LENGTH}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />

          <PasswordField
            id="new-password"
            label="New password"
            value={password}
            onChange={(v) => {
              setPassword(v);
              setPasswordError(null);
            }}
            autoComplete="new-password"
            hint={`At least ${passwordMin} characters. A few words you'll remember works well.`}
            error={passwordError}
          />

          {error && <ErrorNote text={error} />}

          <button className="btn mt-6 w-full" disabled={busy || code.length !== OTP_LENGTH || !password}>
            {busy ? "Saving…" : "Save new password"}
          </button>
          <button type="button" className="btn-secondary mt-3 w-full" disabled={busy || resendIn > 0} onClick={() => void send()}>
            <ClockIcon size={18} />
            {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
