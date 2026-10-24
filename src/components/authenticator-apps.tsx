"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { formatDate, formatDateTime } from "@/lib/format";
import { PlusIcon, ShieldIcon } from "./icons";
import { minutes, RATE_LIMITED } from "./otp-sign-in";
import { QrCode, SetupKey } from "./sign-in-steps";
import { FormDialog, TextField, useToast } from "./staff-ui";

/** GET /api/session/authenticators: the admin's own confirmed apps. Secrets never come back. */
interface App {
  id: number;
  name: string;
  addedAt: string;
  lastUsedAt: string | null;
}
interface AppList {
  authenticators: App[];
  max: number;
}
/** POST /api/session/authenticators: a new app waiting for its first code. */
interface Setup {
  id: number;
  secret: string;
  otpauthUri: string;
  qr: boolean[][];
  expiresInSeconds: number;
}

const NAME_MAX = 40;

function errorText(e: unknown): string {
  if (!(e instanceof ApiError)) return "Something went wrong. Please try again.";
  const left = Number(e.body.attemptsLeft);
  if (e.code === "CODE_INVALID") return `That code is not right. ${left} ${left === 1 ? "try" : "tries"} left. Codes change every 30 seconds.`;
  if (e.code === "LOCKED") return `Too many wrong codes. Try again in ${minutes(Number(e.body.retryAfterSeconds))}.`;
  if (e.code === "EXPIRED") return "This QR code has expired. Close this and add the app again.";
  if (e.code === "NAME_IN_USE") return "You already have an app with this name. Use a different one.";
  if (e.code === "LIMIT_REACHED") return "You have the most apps allowed. Remove one before adding another.";
  if (e.code === "LAST_AUTHENTICATOR") return "This is your only app. Add another before removing it.";
  if (e.code === "NOT_FOUND") return "This app was already removed. Refresh the page.";
  if (e.code === "VALIDATION") return "Check the name and the 6-digit code.";
  if (e.code === "RATE_LIMITED") return RATE_LIMITED;
  if (e.code === "NETWORK") return "You seem to be offline. Check your connection and try again.";
  return "Something went wrong. Please try again.";
}

/**
 * The admin's authenticator apps, like several MFA devices on one account: a code from any of them signs in, so a
 * second phone means a lost one doesn't lock them out. Adding or removing one asks for a code from an app they
 * already have; the last app can't be removed.
 */
export function AuthenticatorApps({ className = "" }: { className?: string }) {
  const [data, setData] = useState<AppList | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [dialog, setDialog] = useState<{ kind: "add" } | { kind: "rename" | "remove"; app: App } | null>(null);
  const toast = useToast();

  function load() {
    setLoadFailed(false);
    api.get<AppList>("/session/authenticators").then(setData).catch(() => setLoadFailed(true));
  }
  useEffect(load, []);

  const apps = data?.authenticators ?? [];
  const full = data ? apps.length >= data.max : false;
  const only = apps.length === 1;

  function done(next: AppList, message: string) {
    setData(next);
    setDialog(null);
    toast.show(message);
  }

  return (
    <section aria-labelledby="authenticators-heading" className={`card p-5 sm:p-6 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-xl">
          <h2 id="authenticators-heading" className="text-base font-bold">Authenticator apps</h2>
          <p className="mt-0.5 text-sm text-muted">
            Signing in needs a 6-digit code from any one of these. Add a second phone so losing one doesn&apos;t lock you out.
          </p>
        </div>
        {data && (
          <button
            type="button"
            className="btn-secondary"
            disabled={full}
            aria-describedby={full ? "authenticators-note" : undefined}
            onClick={() => setDialog({ kind: "add" })}
          >
            <PlusIcon size={16} aria-hidden="true" /> Add app
          </button>
        )}
      </div>

      {loadFailed ? (
        <p role="alert" className="mt-4 text-bad">
          We couldn&apos;t load your authenticator apps.{" "}
          <button type="button" className="font-semibold underline underline-offset-2" onClick={load}>Try again</button>
        </p>
      ) : !data ? (
        <div className="mt-4 space-y-3" aria-hidden="true">
          <span className="skeleton block h-4 w-56" />
          <span className="skeleton block h-4 w-44" />
        </div>
      ) : (
        <>
          <ul className="mt-4 divide-y divide-line rounded-[var(--radius-control)] border border-line">
            {apps.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand" aria-hidden="true">
                  <ShieldIcon size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold [overflow-wrap:anywhere]">{a.name}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    Added {formatDate(a.addedAt)} · {a.lastUsedAt ? `Last used ${formatDateTime(a.lastUsedAt)}` : "Not used yet"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn-secondary" aria-label={`Rename ${a.name}`} onClick={() => setDialog({ kind: "rename", app: a })}>
                    Rename
                  </button>
                  {!only && (
                    <button type="button" className="btn-secondary text-bad" aria-label={`Remove ${a.name}`} onClick={() => setDialog({ kind: "remove", app: a })}>
                      Remove
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <p id="authenticators-note" className="mt-3 text-sm text-muted">
            {full
              ? `You have ${data.max} apps, the most allowed. Remove one to add another.`
              : only
                ? "You need at least one app, so this one can't be removed until you add another."
                : `${apps.length} of ${data.max} apps.`}
          </p>
        </>
      )}

      {dialog?.kind === "add" && (
        <AddDialog onClose={() => setDialog(null)} onAdded={(next, name) => done(next, `${name} is added. A code from any of your apps signs you in.`)} />
      )}
      {dialog?.kind === "rename" && <RenameDialog app={dialog.app} onClose={() => setDialog(null)} onRenamed={(next) => done(next, "Name saved.")} />}
      {dialog?.kind === "remove" && (
        <RemoveDialog app={dialog.app} onClose={() => setDialog(null)} onRemoved={(next) => done(next, `${dialog.app.name} is removed. Other devices were signed out.`)} />
      )}
      {toast.ui}
    </section>
  );
}

/** A 6-digit code field: numbers only, the phone's number pad, and one-time-code autofill. */
function CodeField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: React.ReactNode }) {
  return (
    <TextField
      label={label}
      value={value}
      onChange={(v) => onChange(v.replace(/\D/g, "").slice(0, 6))}
      hint={hint}
      inputMode="numeric"
      autoComplete="one-time-code"
      placeholder="••••••"
      maxLength={6}
      className="field mt-1.5 max-w-[12rem] text-center text-xl tracking-[0.4em] tabular"
    />
  );
}

/**
 * Two steps: a name and a code from an app they already have, then the new app's QR code and its first code.
 * The QR code is fetched only after the first step, so an open session alone never sees a new secret.
 */
function AddDialog({ onClose, onAdded }: { onClose: () => void; onAdded: (next: AppList, name: string) => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setNameError(null);
    setBusy(true);
    try {
      if (!setup) {
        setSetup(await api.post<Setup>("/session/authenticators", { name: name.trim(), code }));
        setCode("");
      } else {
        onAdded(await api.post<AppList>(`/session/authenticators/${setup.id}/confirm`, { code }), name.trim());
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === "NAME_IN_USE") setNameError(errorText(e));
      else setError(errorText(e));
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormDialog
      title={setup ? `Scan with ${name.trim()}` : "Add an authenticator app"}
      description={setup ? `This QR code works for ${Math.round(setup.expiresInSeconds / 60)} minutes.` : "First, confirm it's you with a code from an app you already use."}
      submitLabel={setup ? "Add app" : "Continue"}
      busy={busy}
      busyLabel="Checking…"
      canSubmit={(setup !== null || name.trim().length > 0) && code.length === 6}
      error={error}
      onSubmit={() => void submit()}
      onClose={onClose}
    >
      {!setup ? (
        <>
          <TextField
            label="Name"
            value={name}
            onChange={setName}
            maxLength={NAME_MAX}
            hint="So you can tell your apps apart, e.g. Work phone."
            error={nameError}
            autoComplete="off"
          />
          <CodeField label="Code from an app you already use" value={code} onChange={setCode} />
        </>
      ) : (
        <>
          <ol className="space-y-4 text-sm">
            <li>
              <span className="font-semibold">1.</span> On the new phone, open an authenticator app such as Google Authenticator or Microsoft Authenticator.
            </li>
            <li>
              <span className="font-semibold">2.</span> Scan this code with it.
              <QrCode matrix={setup.qr} label="QR code to add this account to your new authenticator app" />
              <SetupKey secret={setup.secret} />
            </li>
          </ol>
          <CodeField label="3. Code the new app shows" value={code} onChange={setCode} />
        </>
      )}
    </FormDialog>
  );
}

function RenameDialog({ app, onClose, onRenamed }: { app: App; onClose: () => void; onRenamed: (next: AppList) => void }) {
  const [name, setName] = useState(app.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      onRenamed(await api.patch<AppList>(`/session/authenticators/${app.id}`, { name: name.trim() }));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormDialog
      title="Rename app"
      submitLabel="Save"
      busy={busy}
      canSubmit={name.trim().length > 0 && name.trim() !== app.name}
      onSubmit={() => void submit()}
      onClose={onClose}
    >
      <TextField label="Name" value={name} onChange={setName} maxLength={NAME_MAX} error={error} autoComplete="off" />
    </FormDialog>
  );
}

function RemoveDialog({ app, onClose, onRemoved }: { app: App; onClose: () => void; onRemoved: (next: AppList) => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      onRemoved(await api.post<AppList>(`/session/authenticators/${app.id}/remove`, { code }));
    } catch (e) {
      setError(errorText(e));
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormDialog
      title={`Remove ${app.name}?`}
      description="Its codes stop working straight away, and you're signed out on your other devices."
      submitLabel="Remove app"
      busyLabel="Removing…"
      destructive
      busy={busy}
      canSubmit={code.length === 6}
      error={error}
      onSubmit={() => void submit()}
      onClose={onClose}
    >
      <CodeField label="Code from any of your apps" value={code} onChange={setCode} hint="This one too, if you still have it." />
    </FormDialog>
  );
}
