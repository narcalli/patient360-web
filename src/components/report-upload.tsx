"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { api, ApiError, postToS3, type PartnerSearchRow, type UploadOptions, type UploadResult, type UploadTarget } from "@/lib/api";
import { DatePicker } from "@/components/date-picker";
import { firstName, formatDate, formatSize, initials, todayIst } from "@/lib/format";
import { AlertIcon, CheckIcon, CloseIcon, FileIcon, ImageIcon, UploadIcon } from "./icons";
import { ErrorBanner, SelectField, TextField } from "./staff-ui";

const TITLE_MAX = 200;
const NOTES_MAX = 1000;

type Step =
  | { kind: "form" }
  | { kind: "sending"; progress: number }
  | { kind: "checking" }
  // The API couldn't be asked whether the file arrived (offline at that moment).
  | { kind: "unconfirmed"; id: number }
  | { kind: "done" }
  | { kind: "failed"; reason: UploadResult["reason"] };

type FieldErrors = Partial<Record<"file" | "type" | "date", string>>;

/** "PDF, JPG or PNG", from the types hospital_config allows. */
function typesText(o: UploadOptions): string {
  const names = o.types.map((t) => (t.extensions[0] ?? t.mimeType.split("/")[1] ?? t.mimeType).toUpperCase());
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} or ${names.at(-1)}` : (names[0] ?? "");
}

const endingOf = (name: string) => (name.includes(".") ? name.split(".").pop()!.toLowerCase() : "");

/** The allowed type this file is, by what the browser says it is (or, when it can't tell, by its ending). */
const typeOf = (file: File, o: UploadOptions) =>
  file.type ? o.types.find((t) => t.mimeType === file.type) : o.types.find((t) => t.extensions.includes(endingOf(file.name)));

/** Why this file can't be sent, in words a lab person can act on; null when it can. The API checks the same again. */
function fileError(file: File, o: UploadOptions): string | null {
  const type = typeOf(file, o);
  if (!type) return `This kind of file can't be uploaded. Use a ${typesText(o)} file.`;
  const ending = endingOf(file.name);
  if (type.extensions.length && !type.extensions.includes(ending)) {
    return `The file name ends in ${ending ? `.${ending}` : "nothing"}, which doesn't match its type. Save it again as a ${typesText(o)} file.`;
  }
  if (file.size === 0) return "This file is empty. Choose the report file again.";
  if (file.size > o.maxBytes) return `This file is ${formatSize(file.size)}; the limit is ${formatSize(o.maxBytes)}. Save a smaller copy (for example a lower scan resolution).`;
  return null;
}

const FAILED_GENERIC = "This upload didn't go through. Try again.";
const FAILED_TEXT: Record<NonNullable<UploadResult["reason"]>, string> = {
  NOT_RECEIVED: "The file didn't reach us. Check your internet connection and try again.",
  SIZE_MISMATCH: "The file changed while it was being sent. Try again.",
  TYPE_MISMATCH: "The file changed while it was being sent. Try again.",
  NOT_THIS_FORMAT: "The file isn't what its name says (it may have been renamed). Save or export the report again from your lab system, then upload that file.",
};

/**
 * Upload one result for a patient the lab partner has just found (US-10). The patient is shown at the top so the
 * person can check it's the right one. The file goes from the browser straight to S3; the API then checks it and
 * puts it in the patient's documents.
 */
export function ReportUploadDialog({ patient, onClose, onUploaded }: { patient: PartnerSearchRow; onClose: () => void; onUploaded?: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [options, setOptions] = useState<UploadOptions | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [typeId, setTypeId] = useState("");
  const [date, setDate] = useState(todayIst());
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>({ kind: "form" });
  const abort = useRef<AbortController | null>(null);

  const working = step.kind === "sending" || step.kind === "checking";

  useEffect(() => {
    // Focus goes back to the button that opened this, once it closes.
    const opener = document.activeElement as HTMLElement | null;
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => opener?.focus();
  }, []);

  function loadOptions() {
    setLoadFailed(false);
    api.get<UploadOptions>("/partner/upload-options").then(setOptions).catch(() => setLoadFailed(true));
  }
  useEffect(loadOptions, []);

  // A file still being sent is stopped if the dialog goes away.
  useEffect(() => () => abort.current?.abort(), []);

  function choose(f: File | null) {
    setFormError(null);
    setFile(f);
    setErrors((e) => ({ ...e, file: f && options ? (fileError(f, options) ?? undefined) : undefined }));
  }

  function resetForAnother() {
    setFile(null);
    setTitle("");
    setNotes("");
    setErrors({});
    setFormError(null);
    setStep({ kind: "form" });
  }

  /**
   * Asks the API to settle the upload from what reached S3, and shows the outcome. A stopped upload that arrived
   * anyway is reported as sent, because it is in the record.
   */
  async function finish(id: number, stopped = false) {
    setStep({ kind: "checking" });
    let result: UploadResult;
    try {
      result = await api.post<UploadResult>(`/partner/uploads/${id}/complete`);
    } catch (e) {
      setStep(e instanceof ApiError && e.code === "NETWORK" ? { kind: "unconfirmed", id } : { kind: "failed", reason: undefined });
      return;
    }
    if (result.status === "AVAILABLE") {
      setStep({ kind: "done" });
      onUploaded?.();
    } else if (stopped) {
      setStep({ kind: "form" });
      setFormError("Upload stopped. Nothing was added to the patient's record.");
    } else {
      setStep({ kind: "failed", reason: result.reason });
    }
  }

  async function submit() {
    if (!options || !file) return;
    const next: FieldErrors = {
      file: fileError(file, options) ?? undefined,
      type: typeId ? undefined : "Choose the type of report.",
      date: !date ? "Enter the date on the report." : date > todayIst() ? "The report date can't be in the future." : undefined,
    };
    setErrors(next);
    setFormError(null);
    if (next.file || next.type || next.date) return;

    // Stop works from here on, also while the upload is being set up.
    const controller = new AbortController();
    abort.current = controller;
    setStep({ kind: "sending", progress: 0 });
    let target: UploadTarget;
    try {
      target = await api.post<UploadTarget>("/partner/uploads", {
        patientPass: patient.uploadPass,
        documentTypeId: Number(typeId),
        documentDate: date,
        title: title.trim() || undefined,
        notes: notes.trim() || undefined,
        filename: file.name,
        mimeType: typeOf(file, options)!.mimeType,
        sizeBytes: file.size,
      });
    } catch (e) {
      abort.current = null;
      setStep({ kind: "form" });
      const code = e instanceof ApiError ? e.code : "";
      if (code === "TOO_LARGE" || code === "TYPE_NOT_ALLOWED" || code === "EXTENSION_MISMATCH" || code === "EMPTY") {
        // The rules changed since this dialog opened: reload them so the message matches.
        setErrors({ file: "This file can't be uploaded with the current limits. Check the file type and size." });
        loadOptions();
      } else if (code === "TYPE_NOT_FOUND") setErrors({ type: "This type of report is no longer used. Choose another." });
      else if (code === "DATE_IN_FUTURE") setErrors({ date: "The report date can't be in the future." });
      else if (code === "SEARCH_AGAIN") setFormError("This search is too old to upload from. Close this, search for the patient again, then upload.");
      else if (code === "TOO_MANY_OPEN") setFormError("You have several uploads still going. Let them finish (or close their windows), then try again.");
      else if (code === "NETWORK") setFormError("You seem to be offline. Check your connection and try again.");
      else setFormError("Something went wrong. Please try again.");
      return;
    }

    if (!controller.signal.aborted) {
      await postToS3(target.upload, file, (p) => setStep({ kind: "sending", progress: p }), controller.signal);
    }
    abort.current = null;
    // Sent, refused, dropped or stopped: the API settles the upload from what S3 holds, so it never stays
    // "Uploading" in My uploads.
    await finish(target.id, controller.signal.aborted);
  }

  const typeLabel = options?.documentTypes.find((t) => String(t.id) === typeId)?.label ?? "";
  const shownTitle = title.trim() || (file ? file.name.replace(/\.[a-z0-9]+$/i, "") : "");

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!working) onClose();
      }}
      // Some browsers close the dialog on a second Escape without a cancel event: keep it open while working.
      onClose={() => (working ? ref.current?.showModal() : onClose())}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[min(36rem,calc(100vw-2rem))] overflow-y-auto rounded-[var(--radius-card)] border border-line bg-surface p-0 text-ink shadow-[var(--shadow-pop)] backdrop:bg-overlay/60"
    >
      <form
        className="p-6"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-bold">Upload a result</h2>
            <p className="mt-1 text-sm text-muted">Check this is the patient named on the report.</p>
          </div>
          <button type="button" className="icon-btn" aria-label="Close" disabled={working} onClick={onClose}>
            <CloseIcon size={16} />
          </button>
        </div>

        <PatientCard patient={patient} />

        {step.kind === "done" ? (
          <Outcome tone="ok" title={`Sent to ${patient.fullName}'s record`}>
            <span className="font-semibold text-ink [overflow-wrap:anywhere]">{shownTitle}</span>
            {typeLabel && ` (${typeLabel})`} is in their documents now, from {formatDate(date)}.
          </Outcome>
        ) : step.kind === "failed" ? (
          <Outcome tone="bad" title="This result wasn't sent">{step.reason ? FAILED_TEXT[step.reason] : FAILED_GENERIC}</Outcome>
        ) : step.kind === "unconfirmed" ? (
          <Outcome tone="bad" title="We couldn't confirm the upload">
            The connection dropped before we could check whether the file reached the record. Check again when you&apos;re back online; My uploads
            also shows the result.
          </Outcome>
        ) : working ? (
          <Progress file={file!} step={step} />
        ) : loadFailed ? (
          <div className="mt-5">
            <ErrorBanner text="We couldn't load the upload settings. Check your connection." onRetry={loadOptions} />
          </div>
        ) : !options ? (
          <div className="mt-5 space-y-3" aria-hidden="true">
            <span className="skeleton block h-28 w-full" />
            <span className="skeleton block h-12 w-full" />
            <span className="skeleton block h-12 w-full" />
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <FilePicker options={options} file={file} error={errors.file} onChoose={choose} />
            <SelectField
              label="Type of report"
              value={typeId}
              onChange={(v) => {
                setTypeId(v);
                setErrors((e) => ({ ...e, type: undefined }));
              }}
              placeholder="Choose a type"
              options={options.documentTypes.map((t) => [String(t.id), t.label])}
              error={errors.type}
            />
            <DatePicker
              label="Report date"
              required
              value={date}
              max={todayIst()}
              today={todayIst()}
              onChange={(v) => {
                setDate(v);
                setErrors((e) => ({ ...e, date: undefined }));
              }}
              hint="The date printed on the report."
              error={errors.date}
            />
            <TextField
              label="Title"
              optional
              value={title}
              onChange={setTitle}
              maxLength={TITLE_MAX}
              placeholder={file ? file.name.replace(/\.[a-z0-9]+$/i, "") : "e.g. Thyroid profile"}
              hint="What the patient sees. Left empty, the file name is used."
              autoComplete="off"
            />
            <NotesField value={notes} onChange={setNotes} />
          </div>
        )}

        {formError && step.kind === "form" && (
          <p role="alert" className="mt-4 flex items-start gap-2 rounded-[var(--radius-control)] bg-bad-soft px-4 py-3 text-sm text-bad">
            <AlertIcon size={18} className="mt-px shrink-0" /> {formError}
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          {step.kind === "done" ? (
            <>
              <Link href="/partner/uploads" className="btn-ghost">See My uploads</Link>
              <button type="button" className="btn-secondary" onClick={resetForAnother}>Upload another for {firstName(patient.fullName)}</button>
              <button type="button" className="btn" onClick={onClose}>Done</button>
            </>
          ) : step.kind === "failed" ? (
            <>
              <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
              <button type="button" className="btn" onClick={() => setStep({ kind: "form" })}>Try again</button>
            </>
          ) : step.kind === "unconfirmed" ? (
            <>
              <button type="button" className="btn-secondary" onClick={onClose}>Close</button>
              <button type="button" className="btn" onClick={() => void finish(step.id)}>Check again</button>
            </>
          ) : working ? (
            <button type="button" className="btn-secondary" disabled={step.kind === "checking"} onClick={() => abort.current?.abort()}>
              Stop upload
            </button>
          ) : (
            <>
              <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn" disabled={!options || !file || !!errors.file}>
                <UploadIcon size={18} aria-hidden="true" /> Upload result
              </button>
            </>
          )}
        </div>
      </form>
    </dialog>
  );
}

function PatientCard({ patient }: { patient: PartnerSearchRow }) {
  return (
    <div className="mt-5 flex items-center gap-3 rounded-[var(--radius-control)] border border-line bg-subtle px-4 py-3">
      <span className="avatar h-10 w-10 text-sm" aria-hidden="true">{initials(patient.fullName)}</span>
      <div className="min-w-0">
        <p className="font-semibold [overflow-wrap:anywhere]">{patient.fullName}</p>
        <p className="text-sm text-muted">
          <span className="tabular">ID {patient.patientCode}</span> · Born <span className="tabular">{formatDate(patient.dob)}</span> ·{" "}
          <span className="tabular">{patient.mobile}</span>
        </p>
      </div>
    </div>
  );
}

/**
 * Drop a file on the area, or use the button (keyboard and screen readers). Images get a small preview so the person
 * can see it's the right page.
 */
function FilePicker({ options, file, error, onChoose }: { options: UploadOptions; file: File | null; error?: string; onChoose: (f: File | null) => void }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [over, setOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const accept = options.types.flatMap((t) => [t.mimeType, ...t.extensions.map((e) => `.${e}`)]).join(",");
  const hint = `${typesText(options)}, up to ${formatSize(options.maxBytes)}.`;

  // Focus the file button when the form opens (rather than Close), and again after a file is chosen, because the
  // button that had focus (Choose file / Change) is replaced.
  useEffect(() => button.current?.focus(), [file]);

  useEffect(() => {
    if (!file?.type.startsWith("image/")) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div>
      <p id={`${id}-label`} className="block text-sm font-semibold">Report file</p>
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
        className={`mt-1.5 rounded-[var(--radius-control)] border-2 border-dashed transition-colors duration-150 ${
          over ? "border-brand bg-brand-soft" : error ? "border-bad" : "border-field-line"
        }`}
      >
        {file ? (
          <div className="flex items-center gap-3 p-3">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- a local blob: preview, never optimised
              <img src={preview} alt={`Preview of ${file.name}`} width={56} height={56} className="h-14 w-14 shrink-0 rounded-md border border-line object-cover" />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand" aria-hidden="true">
                {file.type.startsWith("image/") ? <ImageIcon size={22} /> : <FileIcon size={22} />}
              </span>
            )}
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
            <p className="mt-3 text-sm text-muted">Drag the file here, or</p>
            <button ref={button} type="button" className="btn-secondary mt-2" aria-describedby={`${id}-note`} onClick={() => input.current?.click()}>
              Choose file
            </button>
          </div>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        aria-labelledby={`${id}-label`}
        onChange={(e) => {
          onChoose(e.target.files?.[0] ?? null);
          // The same file can be chosen again after a change elsewhere.
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

function NotesField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold">
        Note for the patient <span className="font-normal text-muted">(optional)</span>
      </label>
      <textarea
        id={id}
        className="field mt-1.5 min-h-24 py-3"
        value={value}
        maxLength={NOTES_MAX}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={`${id}-hint`}
      />
      <p id={`${id}-hint`} className="mt-1.5 text-sm text-muted">Shown with the report, e.g. &ldquo;Fasting sample&rdquo;.</p>
    </div>
  );
}

function Progress({ file, step }: { file: File; step: { kind: "sending"; progress: number } | { kind: "checking" } }) {
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
            {step.kind === "sending" ? `Uploading… ${pct}%` : "Checking the file…"}
          </p>
        </div>
      </div>
      <div
        role="progressbar"
        aria-label="Upload progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="mt-3 h-2 overflow-hidden rounded-full bg-subtle"
      >
        <div
          className={`h-full origin-left rounded-full bg-brand transition-transform duration-200 ease-out ${step.kind === "checking" ? "motion-safe:animate-pulse" : ""}`}
          style={{ transform: `scaleX(${pct / 100})` }}
        />
      </div>
      <p className="mt-3 text-sm text-muted">Keep this open until it finishes.</p>
    </div>
  );
}

function Outcome({ tone, title, children }: { tone: "ok" | "bad"; title: string; children: React.ReactNode }) {
  return (
    <div role={tone === "bad" ? "alert" : "status"} className="mt-5 flex items-start gap-3">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone === "ok" ? "bg-ok-soft text-ok" : "bg-bad-soft text-bad"}`} aria-hidden="true">
        {tone === "ok" ? <CheckIcon size={20} /> : <AlertIcon size={20} />}
      </span>
      <div className="min-w-0">
        <p className="font-bold">{title}</p>
        <p className="mt-1 text-sm text-muted">{children}</p>
      </div>
    </div>
  );
}
