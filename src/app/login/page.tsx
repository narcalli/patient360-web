"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth-layout";
import { AlertIcon, ChevronLeft, ClockIcon } from "@/components/icons";
import { api, ApiError } from "@/lib/api";
import { formatMobile } from "@/lib/format";

type SendOk = { ok: true; resendAfterSeconds: number; expiresInSeconds: number };
type VerifyOk = { patientCount: number; activePatientId: number | null; needsPatientPicker: boolean };

const OTP_LENGTH = 4;

function minutes(seconds: number) {
  const m = Math.ceil(seconds / 60);
  return `${m} minute${m === 1 ? "" : "s"}`;
}

/** Turns API error codes into the words a patient sees (US-01 branches). */
function sendError(e: unknown): string {
  if (!(e instanceof ApiError)) return "Something went wrong. Please try again.";
  if (e.code === "VALIDATION") return "Enter a valid 10-digit mobile number.";
  if (e.code === "TOO_SOON") return `Please wait ${e.body.retryAfterSeconds} seconds before asking for another code.`;
  if (e.code === "LOCKED") return `Too many wrong codes. Try again in ${minutes(Number(e.body.retryAfterSeconds))}.`;
  if (e.code === "NETWORK") return "You seem to be offline. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}

function verifyError(e: unknown): string {
  if (!(e instanceof ApiError)) return "Something went wrong. Please try again.";
  if (e.code === "OTP_INVALID") {
    const left = Number(e.body.attemptsLeft);
    return `That code is not right. ${left} ${left === 1 ? "try" : "tries"} left.`;
  }
  if (e.code === "OTP_EXPIRED") return "This code has expired. Ask for a new one.";
  if (e.code === "LOCKED") return `Too many wrong codes. Try again in ${minutes(Number(e.body.retryAfterSeconds))}.`;
  if (e.code === "NETWORK") return "You seem to be offline. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}

export default function LoginPage() {
  const router = useRouter();
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
      const r = await api.post<SendOk>("/auth/patient/otp/send", { mobile: digits });
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
      const r = await api.post<VerifyOk>("/auth/patient/otp/verify", { mobile: digits, code });
      router.replace(r.needsPatientPicker ? "/choose" : "/consent");
    } catch (e) {
      setError(verifyError(e));
      setCode("");
      codeRef.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout footer={<>By continuing you agree to the hospital&apos;s terms and privacy policy.</>}>
      {step === "mobile" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (digits.length === 10) void sendCode();
          }}
        >
          <h2 className="text-[30px] leading-tight font-extrabold text-ink-strong">Sign in</h2>
          <p className="mt-2 text-[15px] text-muted">
            Enter the mobile number you registered with at the hospital. We&apos;ll send you a one-time code on WhatsApp.
          </p>

          <label htmlFor="mobile" className="mt-8 block text-sm font-semibold">Mobile number</label>
          <div className="mt-2 flex items-center rounded-[var(--radius-control)] border border-line-strong bg-white focus-within:border-brand">
            <span className="border-r border-line px-4 text-base font-semibold">+91</span>
            <input
              id="mobile"
              ref={mobileRef}
              className="min-h-[50px] flex-1 rounded-r-[var(--radius-control)] bg-transparent px-4 text-base outline-none placeholder:text-[#9aabb2] focus-visible:outline-none"
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
          <h2 className="text-[30px] leading-tight font-extrabold text-ink-strong">Enter the code</h2>
          <p className="mt-2 text-[15px] text-muted">
            If this number is registered with us, we have sent a {OTP_LENGTH}-digit code on WhatsApp to:
          </p>
          {/* The number, with a clear way to fix it if it was typed wrong. */}
          <div className="mt-3 flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-line bg-white px-4 py-3">
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
      )}
    </AuthLayout>
  );
}

function ErrorNote({ text }: { text: string }) {
  return (
    <p role="alert" className="mt-4 flex items-start gap-2 rounded-[var(--radius-control)] bg-bad-soft px-4 py-3 text-sm text-bad">
      <AlertIcon size={18} className="mt-px shrink-0" /> {text}
    </p>
  );
}
