"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { formatMobile } from "@/lib/format";
import { AlertIcon, ChevronLeft, ClockIcon } from "./icons";

type SendOk = { ok: true; resendAfterSeconds: number; expiresInSeconds: number };

export const OTP_LENGTH = 4;

export const RATE_LIMITED = "Too many sign-in attempts from this network. Wait a minute and try again.";

export function minutes(seconds: number) {
  const m = Math.ceil(seconds / 60);
  return `${m} minute${m === 1 ? "" : "s"}`;
}

/** Turns API error codes into the words a person sees (US-01 branches). */
function sendError(e: unknown): string {
  if (!(e instanceof ApiError)) return "Something went wrong. Please try again.";
  if (e.code === "VALIDATION") return "Enter a valid 10-digit mobile number.";
  if (e.code === "TOO_SOON") return `Please wait ${e.body.retryAfterSeconds} seconds before asking for another code.`;
  if (e.code === "LOCKED") return `Too many wrong codes. Try again in ${minutes(Number(e.body.retryAfterSeconds))}.`;
  if (e.code === "NETWORK") return "You seem to be offline. Check your connection and try again.";
  if (e.code === "RATE_LIMITED") return RATE_LIMITED;
  return "Something went wrong. Please try again.";
}

function verifyError(e: unknown): string {
  if (!(e instanceof ApiError)) return "Something went wrong. Please try again.";
  if (e.code === "OTP_INVALID") {
    const left = Number(e.body.attemptsLeft);
    return `That code is not right. ${left} ${left === 1 ? "try" : "tries"} left.`;
  }
  if (e.code === "OTP_EXPIRED" || e.code === "EXPIRED") return "This code has expired. Ask for a new one.";
  if (e.code === "LOCKED") return `Too many wrong codes. Try again in ${minutes(Number(e.body.retryAfterSeconds))}.`;
  if (e.code === "NETWORK") return "You seem to be offline. Check your connection and try again.";
  if (e.code === "RATE_LIMITED") return RATE_LIMITED;
  return "Something went wrong. Please try again.";
}

/**
 * Mobile number, then a one-time code on WhatsApp, for every role (/login). The reply never says whether the number
 * is registered. `top` sits under the heading on the number step (the sign-in method switch).
 */
export function OtpSignIn<T>({
  sendPath,
  verifyPath,
  intro,
  onVerified,
  heading = "Sign in",
  top,
}: {
  sendPath: string;
  verifyPath: string;
  intro: React.ReactNode;
  onVerified: (result: T) => void;
  heading?: string;
  top?: React.ReactNode;
}) {
  const [step, setStep] = useState<"mobile" | "code">("mobile");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  const mobileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
    // Back on the number step: keep what was typed and select it, so a wrong number is quick to fix.
    else mobileRef.current?.select();
  }, [step]);

  // The code step is its own browser history entry, so the phone's or browser's Back button returns to
  // the number step instead of leaving the page.
  useEffect(() => {
    const onPop = () => {
      setStep("mobile");
      setCode("");
      setError(null);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const digits = mobile.replace(/\D/g, "");

  function changeNumber() {
    if (window.history.state?.p360Step === "code") window.history.back();
    else {
      setStep("mobile");
      setCode("");
      setError(null);
    }
  }

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      const r = await api.post<SendOk>(sendPath, { mobile: digits });
      setResendIn(r.resendAfterSeconds);
      setCode("");
      if (step === "mobile") {
        window.history.pushState({ ...window.history.state, p360Step: "code" }, "");
        setStep("code");
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === "TOO_SOON" && step === "code") setResendIn(Number(e.body.retryAfterSeconds));
      setError(sendError(e));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      onVerified(await api.post<T>(verifyPath, { mobile: digits, code }));
    } catch (e) {
      setError(verifyError(e));
      setCode("");
      codeRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return step === "mobile" ? (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (digits.length === 10) void sendCode();
      }}
    >
      <h1 className="text-[28px] leading-tight font-extrabold">{heading}</h1>
      {top}
      <p className="mt-5 text-[15px] leading-relaxed text-muted">{intro}</p>

      <label htmlFor="mobile" className="mt-6 block text-sm font-semibold">Mobile number</label>
      <div className="mt-2 flex items-center rounded-[var(--radius-control)] border border-field-line bg-surface focus-within:border-brand">
        <span className="border-r border-line px-4 text-base font-semibold">+91</span>
        <input
          id="mobile"
          ref={mobileRef}
          className="min-h-[50px] flex-1 rounded-r-[var(--radius-control)] bg-transparent px-4 text-base outline-none placeholder:text-placeholder focus-visible:outline-none"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="98765 43210"
          maxLength={11}
          value={mobile}
          onChange={(e) => setMobile(e.target.value.replace(/[^\d ]/g, ""))}
          autoFocus
        />
      </div>

      {error && <ErrorNote text={error} />}

      <button className="btn mt-6 w-full" disabled={busy || digits.length !== 10}>
        {busy ? "Sending…" : "Send code"}
      </button>
    </form>
  ) : (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (code.length === OTP_LENGTH) void verify();
      }}
    >
      <button type="button" className="mb-6 inline-flex min-h-[40px] items-center gap-1 text-sm font-semibold text-brand" onClick={changeNumber}>
        <ChevronLeft size={16} /> Back
      </button>
      <h1 className="text-[28px] leading-tight font-extrabold">Enter the code</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        If this number is registered with us, we have sent a {OTP_LENGTH}-digit code on WhatsApp to:
      </p>
      {/* The number, with a clear way to fix it if it was typed wrong. */}
      <div className="mt-3 flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-line bg-surface px-4 py-3">
        <span className="text-base font-bold">{formatMobile(`+91${digits}`)}</span>
        <button type="button" className="text-sm font-semibold text-brand hover:underline" onClick={changeNumber}>
          Change number
        </button>
      </div>

      <label htmlFor="code" className="mt-8 block text-sm font-semibold">One-time code</label>
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

      {error && <ErrorNote text={error} />}

      <button className="btn mt-6 w-full" disabled={busy || code.length !== OTP_LENGTH}>
        {busy ? "Checking…" : "Verify and sign in"}
      </button>
      <button type="button" className="btn-secondary mt-3 w-full" disabled={busy || resendIn > 0} onClick={() => void sendCode()}>
        <ClockIcon size={18} />
        {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
      </button>
      <p className="mt-6 text-center text-sm text-muted">
        Wrong number?{" "}
        <button type="button" className="font-semibold text-brand hover:underline" onClick={changeNumber}>
          Enter a different one
        </button>
      </p>
    </form>
  );
}

export function ErrorNote({ text }: { text: string }) {
  return (
    <p role="alert" className="mt-4 flex items-start gap-2 rounded-[var(--radius-control)] bg-bad-soft px-4 py-3 text-sm text-bad">
      <AlertIcon size={18} className="mt-px shrink-0" /> {text}
    </p>
  );
}
