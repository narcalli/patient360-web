"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ImportStatusBadge, ImportUploadDialog } from "@/components/import-ui";
import { AlertIcon, CheckIcon, ChevronLeft, ClockIcon, DownloadIcon, FileIcon, ReplaceIcon, TrashIcon, UndoIcon, UploadIcon } from "@/components/icons";
import { EmptyState, ErrorBanner, PageHeader, RowsSkeleton, useToast, useUrlState } from "@/components/staff-ui";
import { api, ApiError, type ImportIssue, type ImportIssuePage, type ImportLogView, type ImportTypeRow, type ImportView } from "@/lib/api";
import { formatDateTime, formatSize } from "@/lib/format";
import { hasRun, importError, ISSUE_KIND, plural, runProgress, timeLeft } from "@/lib/imports";

/** One import: its sheet (replace, download, delete), what the check found, the run, and what is wrong row by row. */
export default function ImportViewPage() {
  return (
    <Suspense>
      <ImportDetail />
    </Suspense>
  );
}

type Dialog = "replace" | "run" | "deleteSheet" | "delete" | null;
type Severity = "" | "ERROR" | "SKIPPED";
const POLL_MS = 2000;

function ImportDetail() {
  const router = useRouter();
  const { params } = useUrlState();
  const id = Number(params.get("id"));
  const [view, setView] = useState<ImportView | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing" | "error">("loading");
  const [types, setTypes] = useState<ImportTypeRow[]>([]);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [logs, setLogs] = useState<ImportLogView[] | null>(null);
  const [rollingBack, setRollingBack] = useState<ImportLogView | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    if (!Number.isInteger(id) || id < 1) return setState("missing");
    try {
      setView(await api.get<ImportView>(`/admin/imports/${id}`));
      setState("ok");
    } catch (e) {
      // A refresh that fails while the page is showing an import (a dropped connection mid-run) leaves it as it is;
      // the next refresh puts it right.
      setState((now) => (e instanceof ApiError && e.status === 404 ? "missing" : now === "ok" ? now : "error"));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load, attempt]);

  useEffect(() => {
    api.get<ImportTypeRow[]>("/admin/imports/types").then(setTypes, () => undefined);
  }, []);

  // The run log is read once the import has run, and again whenever a run starts or finishes.
  const ranBefore = view !== null && view.startedAt !== null;
  const runMark = `${view?.status}-${view?.finishedAt ?? ""}`;
  useEffect(() => {
    if (!ranBefore) return;
    api.get<ImportLogView[]>(`/admin/imports/${id}/logs`).then(setLogs, () => undefined);
  }, [id, ranBefore, runMark]);

  // While it runs the page follows it.
  const importing = view?.status === "IMPORTING";
  useEffect(() => {
    if (!importing) return;
    const t = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(t);
  }, [importing, load]);

  /** Runs a change, keeps the answer, and says what happened. */
  async function act(work: () => Promise<ImportView | null>, done: (v: ImportView | null) => string | null) {
    setBusy(true);
    setProblem(null);
    try {
      const next = await work();
      if (next) setView(next);
      setDialog(null);
      const message = done(next);
      if (message) toast.show(message);
    } catch (e) {
      setDialog(null);
      setProblem(e instanceof ApiError ? importError(e.code, e.body.message) : importError("UNKNOWN"));
      void load();
    } finally {
      setBusy(false);
    }
  }

  /** Rolls one run back. The page then shows the import as it is now, and the log with that run marked done. */
  async function rollBack(log: ImportLogView) {
    setBusy(true);
    setProblem(null);
    try {
      const r = await api.post<{ import: ImportView; log: ImportLogView }>(`/admin/imports/${id}/logs/${log.id}/rollback`);
      setView(r.import);
      setLogs((all) => all?.map((l) => (l.id === r.log.id ? r.log : l)) ?? null);
      toast.show(`Rolled back: ${plural(r.log.rollback.removed?.patients ?? 0, "patient")} removed.`);
    } catch (e) {
      setProblem(e instanceof ApiError ? importError(e.code, e.body.message) : importError("UNKNOWN"));
      void load();
      api.get<ImportLogView[]>(`/admin/imports/${id}/logs`).then(setLogs, () => undefined);
    } finally {
      setRollingBack(null);
      setBusy(false);
    }
  }

  async function download() {
    setProblem(null);
    try {
      const r = await api.get<{ url: string }>(`/admin/imports/${id}/sheet`);
      window.location.assign(r.url);
    } catch (e) {
      setProblem(e instanceof ApiError ? importError(e.code, e.body.message) : importError("UNKNOWN"));
    }
  }

  if (state === "loading") return <div className="mt-6"><RowsSkeleton rows={3} /></div>;
  if (state === "error") return <div className="mt-6"><ErrorBanner text="We couldn't load this import. Check your connection." onRetry={() => setAttempt((n) => n + 1)} /></div>;
  if (state === "missing" || !view) {
    return (
      <>
        <Back />
        <div className="mt-6">
          <EmptyState icon={<FileIcon size={22} />} title="This import doesn’t exist">It may have been deleted. Go back to the list to see the others.</EmptyState>
        </div>
      </>
    );
  }

  const ran = hasRun(view);
  const c = view.counts;
  return (
    <>
      <Back />
      <PageHeader
        title={view.label}
        description={
          <>
            {view.type.label} · started by {view.createdBy}, {formatDateTime(view.createdAt)}
          </>
        }
        actions={<ImportStatusBadge status={view.status} />}
      />

      {problem && <div className="mt-5"><ErrorBanner text={problem} /></div>}

      <StatusPanel view={view} onRun={() => setDialog("run")} onUpload={() => setDialog("replace")} />

      <section aria-label="Summary" className="mt-6">
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {ran ? (
            <>
              <Stat label="Added" value={c.created} tone="ok" help="New patient records." />
              <Stat label="Left out" value={c.skipped} help="Already registered, or repeated in the sheet." />
              <Stat label="Failed" value={c.failed} tone={c.failed ? "bad" : undefined} help="Couldn’t be saved. Run again to retry." />
              <Stat label="To fix" value={c.errors} tone={c.errors ? "bad" : undefined} help="Wrong in the sheet. Not imported." />
            </>
          ) : (
            <>
              <Stat label="Rows in the sheet" value={c.total} />
              <Stat label="Ready to import" value={c.ready} tone={c.ready ? "ok" : undefined} help="Will become patients." />
              <Stat label="To fix" value={c.errors} tone={c.errors ? "bad" : undefined} help="Fix them in the sheet, then replace it." />
              <Stat label="Will be left out" value={c.existing} help="Already registered, or repeated." />
            </>
          )}
        </dl>
      </section>

      <SheetCard
        view={view}
        onReplace={() => setDialog("replace")}
        onDownload={() => void download()}
        onDelete={() => setDialog("deleteSheet")}
      />

      {view.startedAt && logs && <RunHistory logs={logs} busy={busy} onRollBack={setRollingBack} />}

      <Problems key={`${view.id}-${view.sheet?.revision ?? 0}-${view.finishedAt ?? ""}`} view={view} />

      {view.can.delete && (
        <section aria-labelledby="danger" className="mt-10 rounded-[var(--radius-card)] border border-bad/40 p-5">
          <h2 id="danger" className="text-base font-bold">Delete this import</h2>
          <p className="mt-1 text-sm text-muted">It hasn’t run, so nothing was added. The sheet and the list of problems are removed. This can’t be undone.</p>
          <button type="button" className="btn-secondary mt-4 border-bad text-bad hover:bg-bad-soft" onClick={() => setDialog("delete")}>
            <TrashIcon size={18} /> Delete import
          </button>
        </section>
      )}

      {dialog === "replace" && (
        <ImportUploadDialog
          types={types.filter((t) => t.code === view.type.code)}
          replacing={view}
          onClose={() => setDialog(null)}
          onChecked={(next) => {
            setView(next);
            setDialog(null);
            toast.show(next.status === "READY" ? `Sheet replaced: ${plural(next.counts.ready, "patient")} ready to import.` : "Sheet replaced. It still needs fixing.");
          }}
        />
      )}
      {dialog === "run" && (
        <ConfirmDialog
          title={`Import ${plural(c.ready, "patient")}?`}
          confirmLabel={`Import ${c.ready.toLocaleString("en-IN")}`}
          destructive={false}
          busy={busy}
          onCancel={() => setDialog(null)}
          onConfirm={() => void act(() => api.post<ImportView>(`/admin/imports/${id}/run`), () => "Import started.")}
        >
          <p>Each patient gets a record and can sign in with their mobile number: a code is sent on WhatsApp. Patients who are already registered are left out, and rows with problems are not imported.</p>
          <p className="mt-2">You can leave this page. The import carries on.</p>
        </ConfirmDialog>
      )}
      {dialog === "deleteSheet" && (
        <ConfirmDialog
          title="Delete the sheet?"
          confirmLabel="Delete sheet"
          busy={busy}
          onCancel={() => setDialog(null)}
          onConfirm={() => void act(() => api.delete<ImportView>(`/admin/imports/${id}/sheet`), () => "Sheet deleted.")}
        >
          {ran ? (
            <p>The file <span className="font-semibold [overflow-wrap:anywhere]">{view.sheet?.name}</span> is removed from storage. The results, and the patients this import added, are kept.</p>
          ) : (
            <p>The file <span className="font-semibold [overflow-wrap:anywhere]">{view.sheet?.name}</span> and the list of its problems are removed. The import stays, and you can upload another sheet to it.</p>
          )}
        </ConfirmDialog>
      )}
      {dialog === "delete" && (
        <ConfirmDialog
          title="Delete this import?"
          confirmLabel="Delete import"
          busy={busy}
          onCancel={() => setDialog(null)}
          onConfirm={() =>
            void act(
              async () => {
                await api.delete(`/admin/imports/${id}`);
                router.replace("/admin/actions/imports");
                return null;
              },
              () => null,
            )
          }
        >
          <p><span className="font-semibold [overflow-wrap:anywhere]">{view.label}</span> is removed along with its sheet. Nothing was imported, so no patients are affected.</p>
        </ConfirmDialog>
      )}
      {rollingBack && (
        <ConfirmDialog
          title={`Roll back run ${rollingBack.runNumber}?`}
          confirmLabel={`Delete ${rollingBack.counts.created.toLocaleString("en-IN")} ${rollingBack.counts.created === 1 ? "patient" : "patients"}`}
          busy={busy}
          onCancel={() => setRollingBack(null)}
          onConfirm={() => void rollBack(rollingBack)}
        >
          <p>
            This permanently deletes the <span className="font-semibold">{plural(rollingBack.counts.created, "patient")}</span> this run added, and the sign-ins it made for them. Patients who were already registered are not touched. It can&rsquo;t be undone.
          </p>
          <p className="mt-2">If any of these patients already has a report or has signed in, nothing is deleted and you are told which.</p>
        </ConfirmDialog>
      )}
      {toast.ui}
    </>
  );
}

function Back() {
  return (
    <Link href="/admin/actions/imports" className="btn-ghost -ml-3 mb-4">
      <ChevronLeft size={16} /> Import
    </Link>
  );
}

// ─── What state it is in, and the one thing to do next ───────────────────────

function StatusPanel({ view, onRun, onUpload }: { view: ImportView; onRun: () => void; onUpload: () => void }) {
  const c = view.counts;
  if (view.status === "IMPORTING") {
    const pct = Math.round(runProgress(c) * 100);
    const done = c.created + c.skipped + c.failed;
    return (
      <section aria-label="Progress" className="card mt-6 p-5">
        <div className="flex items-center gap-3">
          <ClockIcon size={20} className="shrink-0 text-warn motion-safe:animate-pulse" />
          <div className="min-w-0 flex-1">
            <p className="font-bold">Importing patients…</p>
            <p className="text-sm text-muted" role="status" aria-live="polite">
              {done.toLocaleString("en-IN")} of {c.ready.toLocaleString("en-IN")} done. You can leave this page; the import carries on.
            </p>
          </div>
        </div>
        <div role="progressbar" aria-label="Import progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="mt-3 h-2 overflow-hidden rounded-full bg-subtle">
          <div className="h-full origin-left rounded-full bg-brand transition-transform duration-300 ease-out" style={{ transform: `scaleX(${pct / 100})` }} />
        </div>
      </section>
    );
  }
  if (view.status === "READY") {
    return (
      <section aria-label="Next step" className="card mt-6 flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-bold"><CheckIcon size={18} className="text-ok" /> {plural(c.ready, "patient")} ready to import</p>
          <p className="mt-1 text-sm text-muted">
            {view.startedAt && view.statusNote ? view.statusNote : c.errors ? `${plural(c.errors, "row")} can’t be imported until the sheet is fixed. You can import the ready rows now, or replace the sheet first.` : "Nothing is added until you import."}
          </p>
        </div>
        <button type="button" className="btn" onClick={onRun}>Import {c.ready.toLocaleString("en-IN")}</button>
      </section>
    );
  }
  if (view.status === "FAILED") {
    return (
      <section aria-label="Next step" className="mt-6 rounded-[var(--radius-card)] bg-bad-soft p-5 text-bad" role="alert">
        <p className="flex items-center gap-2 font-bold"><AlertIcon size={18} /> The import didn’t finish</p>
        <p className="mt-1 text-sm">{view.statusNote ?? "It stopped before it could finish."}</p>
        {view.can.run ? (
          <button type="button" className="btn mt-4" onClick={onRun}>Run again</button>
        ) : (
          view.can.replace && (
            <button type="button" className="btn mt-4" onClick={onUpload}>
              <UploadIcon size={18} /> Upload a sheet
            </button>
          )
        )}
      </section>
    );
  }
  if (view.status === "NEEDS_FIX" || view.status === "UPLOADING") {
    return (
      <section aria-label="Next step" className="card mt-6 flex flex-wrap items-center justify-between gap-4 border-warn/50 p-5">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-bold"><AlertIcon size={18} className="text-warn" /> {view.sheet ? "This sheet needs fixing" : "This import needs a sheet"}</p>
          <p className="mt-1 text-sm text-muted">{view.statusNote ?? "Upload a sheet to continue."}</p>
        </div>
        {view.can.replace && (
          <button type="button" className="btn" onClick={onUpload}>
            <UploadIcon size={18} /> {view.sheet ? "Replace sheet" : "Upload a sheet"}
          </button>
        )}
      </section>
    );
  }
  const issues = view.status === "COMPLETED_WITH_ISSUES";
  return (
    <section aria-label="Result" role="status" className={`mt-6 rounded-[var(--radius-card)] p-5 ${issues ? "bg-warn-soft text-warn" : "bg-ok-soft text-ok"}`}>
      <p className="flex items-center gap-2 font-bold">
        {issues ? <AlertIcon size={18} /> : <CheckIcon size={18} />} {plural(c.created, "patient")} added{view.finishedAt ? ` · ${formatDateTime(view.finishedAt)}` : ""}
      </p>
      <p className="mt-1 text-sm">
        {issues ? "Some rows were not imported. They are listed below with what to fix." : c.skipped ? `${c.skipped.toLocaleString("en-IN")} were left out because they were already registered or repeated.` : "Every row was imported."}
      </p>
    </section>
  );
}

function Stat({ label, value, help, tone }: { label: string; value: number; help?: string; tone?: "ok" | "bad" }) {
  return (
    <div className="card p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className={`tabular mt-1 text-2xl font-extrabold ${tone === "ok" ? "text-ok" : tone === "bad" ? "text-bad" : ""}`}>{value.toLocaleString("en-IN")}</dd>
      {help && <dd className="mt-1 text-xs text-muted">{help}</dd>}
    </div>
  );
}

// ─── The sheet ───────────────────────────────────────────────────────────────

function SheetCard({ view, onReplace, onDownload, onDelete }: { view: ImportView; onReplace: () => void; onDownload: () => void; onDelete: () => void }) {
  return (
    <section aria-labelledby="sheet" className="card mt-6 p-5">
      <h2 id="sheet" className="text-base font-bold">Sheet</h2>
      {view.sheet ? (
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand" aria-hidden="true">
            <FileIcon size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold [overflow-wrap:anywhere]">{view.sheet.name}</p>
            <p className="text-sm text-muted">
              {view.sheetDeleted
                ? "The file was deleted. The results above are kept."
                : `${view.sheet.sizeBytes !== null ? `${formatSize(view.sheet.sizeBytes)} · ` : ""}${view.sheet.uploadedAt ? `uploaded ${formatDateTime(view.sheet.uploadedAt)}` : ""}${view.sheet.revision > 1 ? ` · sheet ${view.sheet.revision}` : ""}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {view.can.replace && !view.sheetDeleted && (
              <button type="button" className="btn-secondary" onClick={onReplace}>
                <ReplaceIcon size={18} /> Replace
              </button>
            )}
            {view.can.download && (
              <button type="button" className="btn-secondary" onClick={onDownload}>
                <DownloadIcon size={18} /> Download
              </button>
            )}
            {view.can.deleteSheet && (
              <button type="button" className="btn-secondary border-bad text-bad hover:bg-bad-soft" onClick={onDelete}>
                <TrashIcon size={18} /> Delete sheet
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">{view.sheetDeleted ? "The sheet was deleted." : "There is no sheet on this import."}</p>
      )}
    </section>
  );
}

// ─── Every run, and rolling one back ─────────────────────────────────────────

const RUN_STATUS: Record<ImportLogView["status"], string> = { RUNNING: "Running", COMPLETED: "Completed", COMPLETED_WITH_ISSUES: "Completed with issues", FAILED: "Failed" };

function RunHistory({ logs, busy, onRollBack }: { logs: ImportLogView[]; busy: boolean; onRollBack: (log: ImportLogView) => void }) {
  // Time left in a rollback window is shown to the minute, so the page keeps its own clock.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (logs.length === 0) return null;
  return (
    <section aria-labelledby="runs" className="mt-6">
      <h2 id="runs" className="text-base font-bold">Run history</h2>
      <p className="mt-1 text-sm text-muted">Every run is logged with what it created. A run can be rolled back for 24 hours after it finishes, once.</p>
      <ol className="mt-3 space-y-3">
        {logs.map((l) => {
          const r = l.rollback;
          const open = r.state === "AVAILABLE" && r.until ? timeLeft(r.until, now) !== "none" : false;
          return (
            <li key={l.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    Run {l.runNumber} <span className="font-normal text-muted">· {RUN_STATUS[l.status]}</span>
                  </p>
                  <p className="mt-0.5 text-sm text-muted">
                    Started by {l.startedBy}, {formatDateTime(l.startedAt)}
                    {l.finishedAt ? ` · finished ${formatDateTime(l.finishedAt)}` : ""}
                  </p>
                  <p className="mt-1 text-sm text-ink-soft">
                    {plural(l.counts.created, "patient")} added
                    {l.counts.skipped ? `, ${l.counts.skipped.toLocaleString("en-IN")} left out` : ""}
                    {l.counts.failed ? `, ${l.counts.failed.toLocaleString("en-IN")} failed` : ""}.
                  </p>
                  {l.note && <p className="mt-1 text-sm text-bad">{l.note}</p>}
                </div>
                {open && (
                  <button type="button" className="btn-secondary border-bad text-bad hover:bg-bad-soft" disabled={busy} onClick={() => onRollBack(l)}>
                    <UndoIcon size={18} /> Roll back
                  </button>
                )}
              </div>
              <p className="mt-3 text-sm text-muted" role={r.state === "DONE" ? "status" : undefined}>
                {r.state === "DONE" && r.removed
                  ? `Rolled back by ${r.rolledBackBy ?? "an admin"}, ${formatDateTime(r.rolledBackAt!)}: ${plural(r.removed.patients, "patient")} and ${plural(r.removed.accounts, "sign-in")} removed.`
                  : r.state === "AVAILABLE" && r.until
                    ? open
                      ? `Can be rolled back until ${formatDateTime(r.until)} (${timeLeft(r.until, now)} left).`
                      : "The 24 hours to roll this run back are over."
                    : r.state === "EXPIRED"
                      ? `The 24 hours to roll this run back ended${r.until ? ` ${formatDateTime(r.until)}` : ""}. It can no longer be undone.`
                      : r.state === "RUNNING"
                        ? "Still running."
                        : "This run didn’t add anyone, so there is nothing to roll back."}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ─── What is wrong, row by row ───────────────────────────────────────────────

function Problems({ view }: { view: ImportView }) {
  const [severity, setSeverity] = useState<Severity>("");
  const [rows, setRows] = useState<ImportIssue[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [failed, setFailed] = useState(false);
  const [more, setMore] = useState(false);
  const running = view.status === "IMPORTING";

  const fetchPage = useCallback(
    async (p: number, replace: boolean) => {
      try {
        const q = new URLSearchParams({ page: String(p), ...(severity ? { severity } : {}) });
        const r = await api.get<ImportIssuePage>(`/admin/imports/${view.id}/issues?${q}`);
        setRows((prev) => (replace ? r.items : [...prev, ...r.items]));
        setTotal(r.total);
        setPage(p);
        setFailed(false);
      } catch {
        setFailed(true);
      }
    },
    [view.id, severity],
  );

  useEffect(() => {
    if (!running) void fetchPage(0, true);
  }, [fetchPage, running]);

  if (running) return null;
  const nothing = total === 0 && !severity;
  return (
    <section aria-labelledby="problems" className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="problems" className="text-base font-bold">Rows that need attention</h2>
        {!nothing && (
          <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
            <button type="button" className="chip" aria-pressed={severity === ""} onClick={() => setSeverity("")}>All</button>
            <button type="button" className="chip" aria-pressed={severity === "ERROR"} onClick={() => setSeverity("ERROR")}>{ISSUE_KIND.ERROR.label}</button>
            <button type="button" className="chip" aria-pressed={severity === "SKIPPED"} onClick={() => setSeverity("SKIPPED")}>{ISSUE_KIND.SKIPPED.label}</button>
          </div>
        )}
      </div>

      <div className="mt-3">
        {failed ? (
          <ErrorBanner text="We couldn’t load the list of problems." onRetry={() => void fetchPage(0, true)} />
        ) : total === null ? (
          <RowsSkeleton rows={3} />
        ) : nothing ? (
          <EmptyState icon={<CheckIcon size={22} />} title="No problems found">
            {view.sheet ? "Every row in the sheet looks fine." : "There is no sheet to check yet."}
          </EmptyState>
        ) : total === 0 ? (
          <EmptyState icon={<CheckIcon size={22} />} title="Nothing in this view">Try another filter.</EmptyState>
        ) : (
          <>
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <caption className="sr-only">Rows of the sheet with a problem, in sheet order</caption>
                <thead className="border-b border-line text-muted">
                  <tr>
                    <th scope="col" className="w-20 px-4 py-3 font-semibold">Row</th>
                    <th scope="col" className="w-44 px-4 py-3 font-semibold">Column</th>
                    <th scope="col" className="px-4 py-3 font-semibold">What to do</th>
                    <th scope="col" className="w-36 px-4 py-3 font-semibold">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((i) => (
                    <tr key={i.id}>
                      <th scope="row" className="tabular px-4 py-3 align-top font-semibold">{i.rowNumber}</th>
                      <td className="px-4 py-3 align-top text-ink-soft">{i.field ?? "—"}</td>
                      <td className="px-4 py-3 align-top [overflow-wrap:anywhere]">
                        {i.message}
                        {i.phase === "RUN" && <span className="block text-xs text-muted">Found while importing</span>}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className={`badge ${i.severity === "ERROR" ? "bg-bad-soft text-bad" : "bg-subtle text-ink-soft ring-1 ring-line ring-inset"}`} title={ISSUE_KIND[i.severity].help}>
                          {i.severity === "ERROR" && <AlertIcon size={13} />}
                          {ISSUE_KIND[i.severity].label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted" role="status" aria-live="polite">Showing {rows.length.toLocaleString("en-IN")} of {total.toLocaleString("en-IN")}.</p>
              {rows.length < total && (
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={more}
                  onClick={async () => {
                    setMore(true);
                    await fetchPage(page + 1, false);
                    setMore(false);
                  }}
                >
                  {more ? "Loading…" : "Show more"}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
