"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { CheckIcon, CopyIcon, KeyIcon, PlugIcon, PlusIcon } from "@/components/icons";
import { EmptyState, ErrorBanner, FormDialog, RowsSkeleton, SelectField, StatusBadge, TextField, useToast } from "@/components/staff-ui";
import { api, ApiError, type Connection, type ConnectionCredential, type ConnectionEndpoint, type ConnectionEvent, type CredentialKind, type EndpointPurpose, type HttpMethod } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

const KIND_LABEL: Record<CredentialKind, string> = { SIGNING_SECRET: "Webhook secret (they send it to us)", API_KEY: "API key (we send it to them)", BEARER_TOKEN: "Bearer token (we send it to them)", BASIC_AUTH: "Basic auth (user:password)", CLIENT_CREDENTIALS: "Client id and secret (we log in for a token)" };
const AUTH_LABEL: Record<Exclude<CredentialKind, "SIGNING_SECRET">, string> = { BEARER_TOKEN: "Bearer token", API_KEY: "API key", BASIC_AUTH: "Basic auth (user:password)", CLIENT_CREDENTIALS: "Client id and secret" };
const PURPOSE_LABEL: Record<EndpointPurpose, string> = { FETCH_RECORD: "Fetch one record", FETCH_CHANGES: "Fetch what changed", SEND: "Send data", OTHER: "Other" };
const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const DIRECTION_LABEL = { INBOUND_WEBHOOK: "Receives webhooks", OUTBOUND_API: "Portal calls their API", BOTH: "Receives webhooks and calls their API" } as const;
const EVENT_TONE: Record<ConnectionEvent["status"], string> = { RECEIVED: "bg-subtle text-ink-soft", QUEUED: "bg-subtle text-ink-soft", PROCESSED: "bg-ok-soft text-ok", SKIPPED: "bg-warn-soft text-warn", FAILED: "bg-bad-soft text-bad" };
const ERRORS: Record<string, string> = {
  NO_SIGNING_SECRET: "Add a webhook secret first: a webhook can't be checked without one.",
  LAST_SIGNING_SECRET: "This is the only webhook secret and the connection is on. Add a second one first, or switch the connection off.",
  VALUE_REQUIRED: "Enter the value.",
  INVALID_URL: "Use a public address that starts with https, with no login in it and no internal host. Write a changing part as {name}, such as /records/{id}.",
  INVALID_PATH: "The path must start with /api/webhooks/ and use only letters, numbers, - and _, such as /api/webhooks/neuroncx.",
  PATH_TAKEN: "Another connection already uses that path.",
  NOT_A_WEBHOOK: "This connection doesn't take webhooks.",
  INVALID_DOMAIN: "Use the domain only, starting with https and with no path, such as portal.example.com.",
};
const errorText = (e: unknown) => (e instanceof ApiError && ERRORS[e.code]) || "That didn't work. Please try again.";

type Reveal = { connectionId: number; secret: string };

/**
 * Data > Connectors: the systems the portal exchanges data with. A connection takes webhooks only while it is on, and a
 * signed one can't be switched on before it has a signing secret. Secrets are stored encrypted and never shown again:
 * a generated signing secret appears once, here, to be given to the sender.
 */
export function ConnectorsPanel() {
  const [list, setList] = useState<Connection[] | null>(null);
  const [error, setError] = useState(false);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const toast = useToast();

  const load = useCallback(
    () =>
      api
        .get<Connection[]>("/admin/connections")
        .then((l) => {
          setList(l);
          setError(false);
        })
        .catch(() => setError(true)),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div aria-busy={!list && !error}>
      {error ? (
        <ErrorBanner text="We couldn't load the connectors. Check your connection." onRetry={() => void load()} />
      ) : !list ? (
        <RowsSkeleton rows={2} />
      ) : list.length === 0 ? (
        <EmptyState icon={<PlugIcon size={22} />} title="No connectors yet">
          Systems connected to the portal will be listed here.
        </EmptyState>
      ) : (
        <div className="space-y-5">
          {list.map((c) => (
            <ConnectorCard key={c.id} c={c} reveal={reveal?.connectionId === c.id ? reveal.secret : null} onDismissReveal={() => setReveal(null)} onReveal={(secret) => setReveal({ connectionId: c.id, secret })} onChanged={load} toast={toast.show} />
          ))}
        </div>
      )}
      {toast.ui}
    </div>
  );
}

function ConnectorCard({ c, reveal, onReveal, onDismissReveal, onChanged, toast }: { c: Connection; reveal: string | null; onReveal: (s: string) => void; onDismissReveal: () => void; onChanged: () => Promise<unknown>; toast: (t: string) => void }) {
  const titleId = useId();
  const on = c.status === "ACTIVE";
  const [confirm, setConfirm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [endpoint, setEndpoint] = useState<ConnectionEndpoint | "new" | null>(null);
  const [retiring, setRetiring] = useState<ConnectionCredential | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const receives = c.direction === "INBOUND_WEBHOOK" || c.direction === "BOTH";
  const calls = c.direction !== "INBOUND_WEBHOOK";

  async function run(action: () => Promise<unknown>, done: string, close: () => void) {
    setBusy(true);
    setProblem(null);
    try {
      await action();
      close();
      toast(done);
      await onChanged();
    } catch (e) {
      close();
      setProblem(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby={titleId} className="card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-brand-soft text-brand" aria-hidden="true">
            <PlugIcon size={20} />
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="flex flex-wrap items-center gap-2 text-lg font-bold">
              {c.label} <StatusBadge status={c.status} />
            </h2>
            <p className="text-sm text-muted">
              {c.providerName ?? "Other system"}
              {c.direction && ` · ${DIRECTION_LABEL[c.direction]}`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-secondary" disabled={busy} onClick={() => setEditing(true)}>
            Settings
          </button>
          <button className={on ? "btn-secondary" : "btn"} disabled={busy || (!on && c.needsSigningSecret && c.direction === "INBOUND_WEBHOOK")} onClick={() => setConfirm(true)}>
            {on ? "Switch off" : "Switch on"}
          </button>
        </div>
      </div>

      <div className="space-y-5 p-5">
        {problem && (
          <p role="alert" className="rounded-[var(--radius-control)] bg-bad-soft px-4 py-3 text-sm text-bad">
            {problem}
          </p>
        )}
        {c.needsSigningSecret && (
          <p className="rounded-[var(--radius-control)] bg-warn-soft px-4 py-3 text-sm text-ink">
            {c.direction === "INBOUND_WEBHOOK" && !on ? "Add a webhook secret below before this connection can be switched on. Until then it takes nothing." : "Webhooks are refused until a webhook secret is added below."}
          </p>
        )}
        {receives && !c.webhookUrl && <p className="rounded-[var(--radius-control)] bg-warn-soft px-4 py-3 text-sm text-ink">Set our public domain in Settings so there is an address to give the sender.</p>}
        {!on && !c.needsSigningSecret && c.webhookPath && <p className="text-sm text-muted">This connection is off, so any webhook sent to it is refused and not stored.</p>}

        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
          {c.webhookPath && (
            <>
              <dt className="text-muted sm:self-center">Address to share</dt>
              <dd className="min-w-0">
                {c.webhookUrl ? (
                  <span className="flex items-center gap-2">
                    <code className="min-w-0 flex-1 rounded-[var(--radius-control)] bg-subtle px-3 py-2 font-mono text-[13px] [overflow-wrap:anywhere]">{c.webhookUrl}</code>
                    <CopyButton text={c.webhookUrl} label="webhook address" />
                  </span>
                ) : (
                  <span className="block text-muted">
                    Our public domain isn&apos;t set. Open Settings to add it. The path is <code className="font-mono text-[13px]">{c.webhookPath}</code>.
                  </span>
                )}
              </dd>
            </>
          )}
          {c.webhookPath && (
            <>
              <dt className="text-muted">Last webhook</dt>
              <dd>{c.lastEventAt ? formatDateTime(c.lastEventAt) : "None received yet"}</dd>
              <dt className="text-muted">Last 24 hours</dt>
              <dd>
                {c.events24h.processed} processed · {c.events24h.failed} failed · {c.events24h.skipped} skipped · {c.events24h.received + c.events24h.queued} waiting
              </dd>
            </>
          )}
          {calls && (
            <>
              <dt className="text-muted">Checked</dt>
              <dd>
                {c.intervalMinutes != null ? `every ${c.intervalMinutes} minutes` : "Not on a schedule"}
                {c.lastSyncedAt ? `, last on ${formatDateTime(c.lastSyncedAt)}` : ""}
              </dd>
            </>
          )}
        </dl>

        {reveal && (
          <div role="status" className="rounded-[var(--radius-card)] border border-line bg-warn-soft p-4">
            <p className="flex items-center gap-2 font-bold">
              <KeyIcon size={18} className="shrink-0 text-warn" /> New webhook secret
            </p>
            <p className="mt-1 text-sm text-ink-soft">Give it to the sender now: it won&apos;t be shown again. Only an encrypted copy is kept.</p>
            <div className="mt-3 flex items-center gap-2">
              <code className="min-w-0 flex-1 rounded-[var(--radius-control)] bg-surface px-3 py-2 font-mono text-sm ring-1 ring-line [overflow-wrap:anywhere]">{reveal}</code>
              <CopyButton text={reveal} label="webhook secret" />
            </div>
            <button className="btn-ghost mt-3 -ml-3" onClick={onDismissReveal}>
              I&apos;ve saved it
            </button>
          </div>
        )}

        {calls && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-bold">Their APIs</h3>
              <button className="btn-ghost" onClick={() => setEndpoint("new")}>
                <PlusIcon size={16} /> Add API
              </button>
            </div>
            {c.endpoints.length === 0 ? (
              <p className="mt-2 text-sm text-muted">None yet. Add each API the portal calls: its address, method and what it is for.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line rounded-[var(--radius-control)] border border-line">
                {c.endpoints.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">
                        {e.label} <span className="font-normal text-muted">· {PURPOSE_LABEL[e.purpose]}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted [overflow-wrap:anywhere]">
                        <span className="font-mono font-semibold text-ink-soft">{e.method}</span> <span className="font-mono">{e.url}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {e.auth ? (
                          <>
                            <KeyIcon size={12} className="mr-1 inline align-[-1px]" />
                            {AUTH_LABEL[e.auth.kind]} · set {formatDateTime(e.auth.createdAt)}
                          </>
                        ) : c.credentials.some((k) => k.endpointId === null && k.kind !== "SIGNING_SECRET" && k.status === "ACTIVE") ? (
                          "Uses the connection's key or token (see Credentials)"
                        ) : (
                          <span className="font-semibold text-warn">No key or token set: the call goes out unsigned</span>
                        )}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <StatusBadge status={e.status} />
                      <button className="btn-ghost" disabled={busy} onClick={() => setEndpoint(e)}>
                        Edit
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold">Credentials</h3>
            <button className="btn-ghost" onClick={() => setAdding(true)}>
              <PlusIcon size={16} /> Add
            </button>
          </div>
          {c.credentials.length === 0 ? (
            <p className="mt-2 text-sm text-muted">None yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line rounded-[var(--radius-control)] border border-line">
              {c.credentials.map((k) => (
                <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      {KIND_LABEL[k.kind]}
                      {k.label && <span className="font-normal text-muted"> · {k.label}</span>}
                    </span>
                    <span className="block text-xs text-muted">
                      {k.endpointId !== null && <>Sent only to {c.endpoints.find((e) => e.id === k.endpointId)?.label ?? "one API"} · </>}
                      Added {formatDateTime(k.createdAt)}
                      {k.validUntil && ` · retired ${formatDateTime(k.validUntil)}`} · the value is stored encrypted and can&apos;t be viewed
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <StatusBadge status={k.status} />
                    {k.status === "ACTIVE" && (
                      <button className="btn-ghost" disabled={busy} onClick={() => setRetiring(k)}>
                        Retire
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {c.webhookPath && <RecentEvents connectionId={c.id} refreshKey={`${c.lastEventAt}-${c.events24h.processed}-${c.events24h.failed}`} />}
      </div>

      {confirm && (
        <ConfirmDialog
          title={`${on ? "Switch off" : "Switch on"} ${c.label}?`}
          confirmLabel={on ? "Switch off" : "Switch on"}
          destructive={on}
          busy={busy}
          onConfirm={() => void run(() => api.put(`/admin/connections/${c.id}/status`, { status: on ? "DEACTIVATED" : "ACTIVE" }), `${c.label} ${on ? "switched off" : "switched on"}.`, () => setConfirm(false))}
          onCancel={() => setConfirm(false)}
        >
          {on
            ? "Webhooks sent to it are refused and not stored until it is switched on again. Events that arrive in the meantime are caught up by the next check."
            : "It starts taking webhooks signed with its secret. Every change is recorded in the audit log."}
        </ConfirmDialog>
      )}

      {retiring && (
        <ConfirmDialog
          title="Retire this credential?"
          confirmLabel="Retire"
          busy={busy}
          onConfirm={() => void run(() => api.post(`/admin/connections/${c.id}/credentials/${retiring.id}/retire`), "Credential retired.", () => setRetiring(null))}
          onCancel={() => setRetiring(null)}
        >
          The {KIND_LABEL[retiring.kind].toLowerCase()} stops working straight away. This can&apos;t be undone; add a new one instead.
        </ConfirmDialog>
      )}

      {endpoint && (
        <EndpointDialog
          connection={c}
          endpoint={endpoint === "new" ? null : endpoint}
          onClose={() => setEndpoint(null)}
          onDone={async (text) => {
            setEndpoint(null);
            toast(text);
            await onChanged();
          }}
        />
      )}

      {editing && (
        <SettingsDialog
          connection={c}
          onClose={() => setEditing(false)}
          onDone={async () => {
            setEditing(false);
            toast("Settings saved.");
            await onChanged();
          }}
        />
      )}

      {adding && (
        <AddCredentialDialog
          connection={c}
          onClose={() => setAdding(false)}
          onDone={async (secret) => {
            setAdding(false);
            if (secret) onReveal(secret);
            toast("Credential added.");
            await onChanged();
          }}
        />
      )}
    </section>
  );
}

function EndpointDialog({ connection, endpoint, onClose, onDone }: { connection: Connection; endpoint: ConnectionEndpoint | null; onClose: () => void; onDone: (text: string) => Promise<void> }) {
  const [label, setLabel] = useState(endpoint?.label ?? "");
  const [purpose, setPurpose] = useState<EndpointPurpose>(endpoint?.purpose ?? "FETCH_RECORD");
  const [method, setMethod] = useState<HttpMethod>(endpoint?.method ?? "GET");
  const [url, setUrl] = useState(endpoint?.url ?? "");
  const [on, setOn] = useState(endpoint ? endpoint.status === "ACTIVE" : true);
  // How the API is called: leave what it has (only when it has one), no key or token, or a new one.
  const [authKind, setAuthKind] = useState<"KEEP" | "NONE" | keyof typeof AUTH_LABEL>(endpoint?.auth ? "KEEP" : "NONE");
  const [authValue, setAuthValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const newAuth = authKind !== "KEEP" && authKind !== "NONE";
  const ready = label.trim().length >= 2 && url.trim().length > 0 && (!newAuth || authValue.length >= 8);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      // Left out, the API keeps what it has; null takes it off; an object sets a new one (the old is retired).
      const auth = newAuth ? { kind: authKind, value: authValue } : authKind === "NONE" && endpoint?.auth ? null : undefined;
      const body = { label: label.trim(), purpose, method, url: url.trim(), auth };
      if (endpoint) await api.put(`/admin/connections/${connection.id}/endpoints/${endpoint.id}`, { ...body, status: on ? "ACTIVE" : "DEACTIVATED" });
      else await api.post(`/admin/connections/${connection.id}/endpoints`, body);
      await onDone(endpoint ? "API saved." : "API added.");
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <FormDialog
      title={endpoint ? `Edit ${endpoint.label}` : `Add an API of ${connection.label}`}
      description="An API of the other system that the portal calls. Its key or token is set here, never in the address."
      submitLabel="Save"
      busy={busy}
      canSubmit={ready}
      error={error}
      onSubmit={() => void submit()}
      onClose={onClose}
    >
      <TextField label="Name" value={label} onChange={setLabel} maxLength={100} placeholder="Fetch episode" hint="For you, to tell the APIs apart." />
      <SelectField label="What it is for" value={purpose} onChange={(v) => setPurpose(v as EndpointPurpose)} options={(Object.keys(PURPOSE_LABEL) as EndpointPurpose[]).map((k) => [k, PURPOSE_LABEL[k]])} />
      <SelectField label="Method" value={method} onChange={(v) => setMethod(v as HttpMethod)} options={METHODS.map((m) => [m, m])} />
      <TextField
        label="Address"
        value={url}
        onChange={setUrl}
        type="url"
        inputMode="url"
        autoComplete="off"
        maxLength={500}
        placeholder="The address, starting with https, with {id} where it changes"
        hint="The full https address. Write a part that changes per call as {name}, such as {id}."
      />
      <SelectField
        label="Called with"
        value={authKind}
        onChange={(v) => {
          setAuthKind(v as typeof authKind);
          setAuthValue("");
        }}
        options={[
          ...(endpoint?.auth ? ([["KEEP", `Keep the current ${AUTH_LABEL[endpoint.auth.kind].toLowerCase()}`]] as [string, string][]) : []),
          ["NONE", "No key or token"],
          ...(Object.keys(AUTH_LABEL) as (keyof typeof AUTH_LABEL)[]).map((k): [string, string] => [k, endpoint?.auth ? `Replace with a new ${AUTH_LABEL[k].toLowerCase()}` : AUTH_LABEL[k]]),
        ]}
      />
      {newAuth && (
        <TextField
          label={authKind === "BASIC_AUTH" ? "User and password" : authKind === "API_KEY" ? "API key" : "Token"}
          value={authValue}
          onChange={setAuthValue}
          type="password"
          // "off" is ignored for password fields: "new-password" keeps the browser from filling in a saved login here.
          name="endpoint-secret"
          autoComplete="new-password"
          data-1p-ignore
          data-lpignore="true"
          hint={`${authKind === "BASIC_AUTH" ? "Written as user:password." : authKind === "BEARER_TOKEN" ? "Sent as Authorization: Bearer <token>." : "Sent in the X-API-Key header."} At least 8 characters. It is encrypted before it is stored and can't be viewed again.`}
        />
      )}
      {endpoint && (
        <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
          <input type="checkbox" className="h-5 w-5" checked={on} onChange={(e) => setOn(e.target.checked)} /> In use
        </label>
      )}
    </FormDialog>
  );
}

function SettingsDialog({ connection, onClose, onDone }: { connection: Connection; onClose: () => void; onDone: () => Promise<void> }) {
  const receives = connection.direction === "INBOUND_WEBHOOK" || connection.direction === "BOTH";
  const calls = connection.direction !== "INBOUND_WEBHOOK";
  const [domain, setDomain] = useState(connection.publicBaseUrl ?? "");
  const [path, setPath] = useState(connection.webhookPath ?? "");
  const [minutes, setMinutes] = useState(connection.intervalMinutes != null ? String(connection.intervalMinutes) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const n = minutes.trim() === "" ? null : Number(minutes);
  const minutesOk = !calls || n === null || (Number.isInteger(n) && n >= 1 && n <= 1440);
  const preview = domain.trim() && path.trim() ? `${domain.trim().replace(/\/+$/, "")}${path.trim().replace(/\/+$/, "")}` : null;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.put(`/admin/connections/${connection.id}/settings`, {
        ...(receives ? { publicBaseUrl: domain.trim() || null, webhookPath: path.trim() || null } : {}),
        ...(calls ? { intervalMinutes: n } : {}),
      });
      await onDone();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <FormDialog
      title={`Settings for ${connection.label}`}
      description={
        receives
          ? "The address the other system sends its webhooks to: our domain and the path. Change it only before it is shared, or tell them the new one. The webhook secret is added under Credentials."
          : "How often the portal checks this system. Its APIs are listed on the card, and keys and secrets are added under Credentials."
      }
      submitLabel="Save"
      busy={busy}
      canSubmit={minutesOk}
      error={error}
      onSubmit={() => void submit()}
      onClose={onClose}
    >
      {receives && (
        <>
          <TextField
            label="Our public domain"
            optional
            value={domain}
            onChange={setDomain}
            type="url"
            inputMode="url"
            autoComplete="off"
            maxLength={300}
            placeholder="The domain, starting with https, no path"
            hint="The domain people reach this portal on, https only, no path."
          />
          <TextField
            label="Path they call"
            value={path}
            onChange={setPath}
            autoComplete="off"
            maxLength={250}
            placeholder={`/api/webhooks/${connection.code}`}
            hint={
              <>
                Starts with <code className="font-mono">/api/webhooks/</code>. Clear it to go back to <code className="font-mono">/api/webhooks/{connection.code}</code>.
                {preview && (
                  <>
                    {" "}
                    Address to share: <code className="font-mono [overflow-wrap:anywhere]">{preview}</code>
                  </>
                )}
              </>
            }
          />
        </>
      )}
      {calls && (
        <>
          <TextField label="Check every (minutes)" optional value={minutes} onChange={setMinutes} inputMode="numeric" error={minutesOk ? null : "Enter a whole number from 1 to 1440, or leave it empty."} hint="Catches anything a webhook missed. Empty: no schedule." />
        </>
      )}
    </FormDialog>
  );
}

function AddCredentialDialog({ connection, onClose, onDone }: { connection: Connection; onClose: () => void; onDone: (generatedSecret?: string) => Promise<void> }) {
  const [kind, setKind] = useState<CredentialKind>((connection.authType === "HMAC_SIGNATURE" || connection.authType === "BEARER") && connection.direction !== "OUTBOUND_API" ? "SIGNING_SECRET" : "API_KEY");
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generates = kind === "SIGNING_SECRET" && value === "";

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ secret?: string }>(`/admin/connections/${connection.id}/credentials`, { kind, label: label.trim() || undefined, value: value || undefined });
      await onDone(res.secret);
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <FormDialog
      title={`Add a credential to ${connection.label}`}
      description="It is encrypted before it is stored, and can't be viewed again."
      submitLabel={generates ? "Generate secret" : "Save"}
      busy={busy}
      canSubmit={generates || value.length >= 8}
      error={error}
      onSubmit={() => void submit()}
      onClose={onClose}
    >
      <SelectField label="Kind" value={kind} onChange={(v) => setKind(v as CredentialKind)} options={(Object.keys(KIND_LABEL) as CredentialKind[]).map((k) => [k, KIND_LABEL[k]])} />
      <TextField label="Name" optional value={label} onChange={setLabel} maxLength={60} name="credential-name" autoComplete="off" data-1p-ignore data-lpignore="true" hint="For you, to tell credentials apart, such as the month it was issued." />
      <TextField
        label={kind === "SIGNING_SECRET" ? "Secret" : "Value"}
        value={value}
        onChange={setValue}
        type="password"
        // "off" is ignored for password fields: "new-password" keeps the browser from filling in a saved login here.
        name="credential-secret"
        autoComplete="new-password"
        data-1p-ignore
        data-lpignore="true"
        optional={kind === "SIGNING_SECRET"}
        hint={kind === "SIGNING_SECRET" ? "Leave empty and the portal makes a strong one and shows it once. Give it to the sender: they send it with every webhook. Or paste the one the sender gave you." : kind === "CLIENT_CREDENTIALS" ? "Written as client_id:client_secret. Needs an API coded \"token\" on this connection, which we log in at for a token that lasts an hour. At least 8 characters." : "At least 8 characters."}
      />
    </FormDialog>
  );
}

function RecentEvents({ connectionId, refreshKey }: { connectionId: number; refreshKey: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ConnectionEvent[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!open) return;
    let live = true;
    api
      .get<ConnectionEvent[]>(`/admin/connections/${connectionId}/events`)
      .then((r) => live && (setRows(r), setFailed(false)))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [open, connectionId, refreshKey]);
  return (
    <div>
      <button className="btn-ghost -ml-3" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Hide recent webhooks" : "Show recent webhooks"}
      </button>
      {open &&
        (failed ? (
          <p className="text-sm text-bad">We couldn&apos;t load them.</p>
        ) : !rows ? (
          <RowsSkeleton rows={2} />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted">Nothing received yet.</p>
        ) : (
          <div className="mt-2 overflow-x-auto rounded-[var(--radius-control)] border border-line">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">The last webhooks received. Only ids and states are kept, never the content.</caption>
              <thead className="bg-subtle text-xs text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">Received</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Type</th>
                  <th scope="col" className="px-3 py-2 font-semibold">Event id</th>
                  <th scope="col" className="px-3 py-2 font-semibold">State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDateTime(e.receivedAt)}</td>
                    <td className="px-3 py-2">{e.eventType ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-xs [overflow-wrap:anywhere]">{e.sourceEventId}</td>
                    <td className="px-3 py-2">
                      <span className={`badge ${EVENT_TONE[e.status]}`}>{e.status.toLowerCase()}</span>
                      {e.errorCode && <span className="ml-2 text-xs text-muted">{e.errorCode}</span>}
                      {e.attempts > 1 && <span className="ml-2 text-xs text-muted">{e.attempts} tries</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="icon-btn"
      aria-label={copied ? `Copied the ${label}` : `Copy the ${label}`}
      title={`Copy the ${label}`}
      onClick={() =>
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
      }
    >
      {copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
    </button>
  );
}
