"use client";

import { useEffect, useId, useRef, useState } from "react";
import { api, ApiError, downloadFile, postToS3, type ImportStatus, type ImportTypeRow, type ImportView, type UploadTarget } from "@/lib/api";
import { formatSize } from "@/lib/format";
import { WORKING, importError, IMPORT_STATUS, sheetFileProblem, type Tone } from "@/lib/imports";
import { SelectField } from "./staff-ui";
import { AlertIcon, CheckIcon, ClockIcon, CloseIcon, DownloadIcon, FileIcon, UploadIcon } from "./icons";

// The parts the Import pages share: the status badge, the file picker, and the dialog that uploads a sheet (a new
// import, or a replacement for one's sheet). A sheet is checked by the API after it is uploaded, so the person sees
// what is wrong with it straight away.

const TONES: Record<Tone, string> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  info: "bg-brand-soft text-brand",
  neutral: "bg-subtle text-ink-soft ring-1 ring-line ring-inset",
};
const ICONS: Record<Tone, React.ComponentType<{ size?: number; className?: string }> | null> = { ok: CheckIcon, warn: ClockIcon, bad: AlertIcon, info: CheckIcon, neutral: null };

/** The status in words, with a colour and an icon to support it. */
export function ImportStatusBadge({ status, working = null }: { status: ImportStatus; working?: ImportView["working"] }) {
  const s = working ? WORKING[working] : IMPORT_STATUS[status];
  const Icon = ICONS[s.tone];
  return (
    <span className={`badge ${TONES[s.tone]}`}>
      {Icon && <Icon size={13} className={status === "IMPORTING" || working ? "motion-safe:animate-pulse" : undefined} />}
      {s.label}
    </span>
  );
}

// ─── Choosing a file ─────────────────────────────────────────────────────────

const XLSX_ACCEPT = ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Drop a sheet on the area, or use the button (the only way for keyboard and screen reader users). */
export function SheetPicker({ file, error, hint, onChoose }: { file: File | null; error?: string | null; hint: string; onChoose: (f: File | null) => void }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [over, setOver] = useState(false);

  // The button that had focus (Choose file, Change) is replaced when a file is chosen: focus the new one.
  useEffect(() => button.current?.focus(), [file]);

  return (
    <div>
      <p id={`${id}-label`} className="block text-sm font-semibold">Excel sheet</p>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files[0];
          if (f) onChoose(f);
        }}
        className={`mt-1.5 rounded-[var(--radius-control)] border-2 border-dashed transition-colors duration-150 ${over ? "border-brand bg-brand-soft" : error ? "border-bad" : "border-field-line"}`}
      >
        {file ? (
          <div className="flex items-center gap-3 p-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand" aria-hidden="true">
              <FileIcon size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold [overflow-wrap:anywhere]">{file.name}</p>
              <p className="text-sm text-muted tabular">{formatSize(file.size)}</p>
            </div>
            <button ref={button} type="button" className="btn-ghost" aria-describedby={`${id}-label`} onClick={() => input.current?.click()}>
              Change
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center px-4 py-6 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand" aria-hidden="true">
              <UploadIcon size={20} />
            </span>
            <p className="mt-3 text-sm text-muted">Drag the sheet here, or</p>
            <button ref={button} type="button" className="btn-secondary mt-2" aria-describedby={`${id}-note`} onClick={() => input.current?.click()}>
              Choose file
            </button>
          </div>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept={XLSX_ACCEPT}
        className="hidden"
        aria-labelledby={`${id}-label`}
        onChange={(e) => {
          onChoose(e.target.files?.[0] ?? null);
          // The same file can be chosen again after it was fixed in Excel.
          e.target.value = "";
        }}
      />
      <p id={`${id}-note`} role={error ? "alert" : undefined} className={`mt-1.5 flex items-start gap-1.5 text-sm ${error ? "font-semibold text-bad" : "text-muted"}`}>
        {error && <AlertIcon size={16} className="mt-px shrink-0" />}
        {error ?? hint}
      </p>
    </div>
  );
}

// ─── Uploading ───────────────────────────────────────────────────────────────

export type UploadStep = { kind: "idle" } | { kind: "sending"; progress: number } | { kind: "checking" };
export type UploadOutcome = { id: number | null; view: ImportView | null; error: string | null };

/**
 * Sends a sheet: asks the API for a place for it (a new import, or a new sheet for one), sends the file straight to
 * S3, then asks the API to check it. Never throws; the outcome says what happened, and `id` is the import's id once
 * it exists, so a retry after a rejected sheet goes to the same import.
 */
export function useSheetUpload() {
  const [step, setStep] = useState<UploadStep>({ kind: "idle" });
  const abort = useRef<AbortController | null>(null);

  async function upload(file: File, to: { existingId: number | null; typeCode: string; label: string; ruleId: number | null }): Promise<UploadOutcome> {
    const ac = new AbortController();
    abort.current = ac;
    let id = to.existingId;
    try {
      setStep({ kind: "sending", progress: 0 });
      const meta = { fileName: file.name, sizeBytes: file.size };
      const target = id
        ? await api.post<UploadTarget>(`/admin/imports/${id}/sheet`, meta)
        : await api.post<UploadTarget>("/admin/imports", { ...meta, typeCode: to.typeCode, label: to.label.trim() || undefined, ruleId: to.ruleId });
      id = target.id;
      const sent = await postToS3(target.upload, file, (f) => setStep({ kind: "sending", progress: f }), ac.signal);
      if (!sent) return { id, view: null, error: ac.signal.aborted ? "The upload was stopped." : "The upload didn't finish. Check your connection and try again." };
      setStep({ kind: "checking" });
      return { id, view: await api.post<ImportView>(`/admin/imports/${id}/complete`), error: null };
    } catch (e) {
      return { id, view: null, error: e instanceof ApiError ? importError(e.code, e.body.message) : importError("UNKNOWN") };
    } finally {
      setStep({ kind: "idle" });
      abort.current = null;
    }
  }

  return { step, busy: step.kind !== "idle", upload, stop: () => abort.current?.abort() };
}

function UploadProgress({ file, step, onStop }: { file: File; step: Exclude<UploadStep, { kind: "idle" }>; onStop: () => void }) {
  const pct = step.kind === "sending" ? Math.round(step.progress * 100) : 100;
  return (
    <div className="mt-5 rounded-[var(--radius-control)] border border-line p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand" aria-hidden="true">
          <FileIcon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold [overflow-wrap:anywhere]">{file.name}</p>
          <p className="text-sm text-muted" role="status" aria-live="polite">
            {step.kind === "sending" ? `Uploading… ${pct}%` : "Checking every row…"}
          </p>
        </div>
        {step.kind === "sending" && (
          <button type="button" className="btn-ghost" onClick={onStop}>
            Stop
          </button>
        )}
      </div>
      <div role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="mt-3 h-2 overflow-hidden rounded-full bg-subtle">
        <div
          className={`h-full origin-left rounded-full bg-brand transition-transform duration-200 ease-out ${step.kind === "checking" ? "motion-safe:animate-pulse" : ""}`}
          style={{ transform: `scaleX(${pct / 100})` }}
        />
      </div>
      <p className="mt-3 text-sm text-muted">Keep this open until it finishes.</p>
    </div>
  );
}

// ─── The dialog ──────────────────────────────────────────────────────────────

const HOW_IT_WORKS = ["Download the template", "Fill it in with Excel", "Upload it here"];

/**
 * New import (no `replacing`): pick the import type, get the template, name it, upload the sheet. Replace sheet
 * (`replacing` given): upload another sheet for that import; the current one stays until the new one passes the check.
 * A sheet the API rejects is explained and nothing is lost: choose another and try again.
 */
export function ImportUploadDialog({
  types,
  replacing,
  onClose,
  onChecked,
}: {
  types: ImportTypeRow[];
  replacing?: ImportView;
  /** Closed; `changed` is true when an import was made (even one still waiting for a good sheet). */
  onClose: (changed: boolean) => void;
  /** The sheet was uploaded and checked (it may still have problems in its rows). */
  onChecked: (view: ImportView) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const errorRef = useRef<HTMLDivElement>(null);
  const [typeCode, setTypeCode] = useState(replacing?.type.code ?? "");
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [helpError, setHelpError] = useState<string | null>(null);
  const [startedId, setStartedId] = useState<number | null>(replacing?.id ?? null);
  const sheet = useSheetUpload();
  const type = types.find((t) => t.code === typeCode);
  // The first rule until someone chooses; "none" is a choice too. A started import keeps its rule.
  const [chosenRule, setChosenRule] = useState<string | null>(null);
  const ruleId = replacing ? (replacing.rule?.id ?? null) : chosenRule === "none" ? null : chosenRule ? Number(chosenRule) : (type?.rules[0]?.id ?? null);
  const rule = type?.rules.find((r) => r.id === ruleId);

  // Focus goes back to the button that opened this when it closes (a native dialog that is simply removed doesn't).
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  useEffect(() => {
    if (failure) errorRef.current?.focus();
  }, [failure]);

  const close = () => onClose(startedId !== null && !replacing);

  function choose(f: File | null) {
    setFile(f);
    setFailure(null);
    setFileError(f ? sheetFileProblem(f) : null);
  }

  async function submit() {
    if (!file || fileError || !type) return;
    setFailure(null);
    const out = await sheet.upload(file, { existingId: startedId, typeCode: type.code, label, ruleId });
    if (out.id) setStartedId(out.id);
    if (out.view) return onChecked(out.view);
    setFailure(out.error);
    setFile(null);
  }

  async function template() {
    setHelpError(null);
    try {
      await downloadFile(ruleId ? `/admin/imports/rules/${ruleId}/template` : `/admin/imports/types/${typeCode}/template`, `${typeCode.replace(/_/g, "-")}-template.xlsx`);
    } catch (e) {
      setHelpError(e instanceof ApiError ? importError(e.code) : importError("UNKNOWN"));
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!sheet.busy) close();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(36rem,calc(100vw-2rem))] overflow-y-auto rounded-[var(--radius-card)] border border-line bg-surface p-0 text-ink shadow-[var(--shadow-pop)] backdrop:bg-overlay/60"
    >
      <form
        className="p-6"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold">{replacing ? "Replace sheet" : "New import"}</h2>
            <p className="mt-1 text-sm text-muted">
              {replacing ? <>The sheet now in use stays until the new one passes the check. It is then removed.</> : "Upload an Excel sheet. Every row is checked before anything is imported."}
            </p>
          </div>
          <button type="button" className="-m-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-subtle" aria-label="Close" disabled={sheet.busy} onClick={close}>
            <CloseIcon size={18} />
          </button>
        </div>

        {!replacing && (
          <div className="mt-5">
            <SelectField
              label="Import type"
              value={typeCode}
              onChange={(code) => {
                setTypeCode(code);
                setChosenRule(null);
              }}
              options={types.map((t): [string, string] => [t.code, t.label])}
              placeholder="Choose what to import"
              hint={startedId ? "This import has started, so its type can't change." : undefined}
              disabled={Boolean(startedId) || sheet.busy}
            />
          </div>
        )}

        {type && !replacing && (
          <div className="mt-5">
            <SelectField
              label="Import rule"
              value={ruleId ? String(ruleId) : "none"}
              onChange={setChosenRule}
              options={[...type.rules.map((r): [string, string] => [String(r.id), r.name]), ["none", "No rule: only the standard columns"]]}
              hint={startedId ? "This import has started. You can change its rule on the import's page." : "Says which columns of your sheet to read. Choose the one made for this sheet."}
              disabled={Boolean(startedId) || sheet.busy}
            />
          </div>
        )}
        {replacing && <p className="mt-5 text-sm text-ink-soft">Rule: <span className="font-semibold">{replacing.rule?.name ?? "No rule, only the standard columns"}</span></p>}

        {type && (
          <div className="mt-5 rounded-[var(--radius-control)] bg-subtle p-4">
            {!replacing && <p className="text-sm text-ink-soft">{type.description}</p>}
            <ol className="mt-3 grid gap-2 text-sm sm:grid-cols-3" aria-label="How it works">
              {HOW_IT_WORKS.map((t, i) => (
                <li key={t} className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-on-brand" aria-hidden="true">{i + 1}</span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" className="btn-secondary" onClick={() => void template()}>
                <DownloadIcon size={18} /> Download template
              </button>
            </div>
            {helpError && <p role="alert" className="mt-2 text-sm font-semibold text-bad">{helpError}</p>}
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-semibold text-brand">What goes in each column</summary>
              <ul className="mt-2 space-y-1.5">
                {[...type.columns, ...(rule?.columns ?? [])].map((c) => (
                  <li key={c.header}>
                    <span className="font-semibold">{c.header}</span>{" "}
                    <span className={c.required ? "font-semibold text-bad" : "text-muted"}>{c.required ? "(required)" : "(optional)"}</span>
                    <span className="block text-muted">{c.hint}</span>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        )}

        {!replacing && type && (
          <div className="mt-5">
            <label htmlFor="import-label" className="block text-sm font-semibold">
              Name <span className="font-normal text-muted">(optional)</span>
            </label>
            <input id="import-label" className="field mt-1.5" value={label} maxLength={150} disabled={sheet.busy || Boolean(startedId)} onChange={(e) => setLabel(e.target.value)} placeholder="Left empty, the file name is used" autoComplete="off" />
          </div>
        )}

        {failure && (
          <div ref={errorRef} tabIndex={-1} role="alert" className="mt-5 flex items-start gap-3 rounded-[var(--radius-control)] bg-bad-soft p-4 text-bad outline-none">
            <AlertIcon size={20} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="font-bold">That sheet couldn&rsquo;t be used</p>
              <p className="mt-1 text-sm">{failure}</p>
              <p className="mt-1 text-sm">Fix it in Excel and choose it again.{replacing ? " Your current sheet is unchanged." : ""}</p>
            </div>
          </div>
        )}

        {type && (
          <div className="mt-5">
            <SheetPicker file={file} error={fileError} hint="Excel (.xlsx) sheet." onChoose={choose} />
          </div>
        )}

        {sheet.step.kind !== "idle" && file && <UploadProgress file={file} step={sheet.step} onStop={sheet.stop} />}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" disabled={sheet.busy} onClick={close}>
            Cancel
          </button>
          <button className="btn" disabled={!file || Boolean(fileError) || sheet.busy || !type}>
            {sheet.busy ? "Working…" : replacing ? "Replace and check" : "Upload and check"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
