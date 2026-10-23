"use client";

import { useEffect, useId, useRef, useState } from "react";
import { api, type PatientDocument } from "@/lib/api";
import { safeHttpsUrl } from "@/lib/branding";
import { dayParts, documentDay, formatDate, formatSize, relativeDay } from "@/lib/format";
import { AlertIcon, CloseIcon, DocTypeIcon, DownloadIcon, EyeIcon } from "./icons";

type LinkResponse = { url: string; expiresInSeconds: number };

/** What the viewer and the download need; patient documents and the admin's document rows both have it. */
export interface ViewableDocument {
  id: number;
  title: string;
  canView: boolean;
  mimeType: string;
  type: { icon: string; label: string };
  documentDate: string | null;
  uploadedAt: string;
  source: string;
  isNew?: boolean;
}

/** A short-lived https link from the API. Anything else (javascript:, data:, http:) is refused before use. */
async function documentLink(base: string, id: number, mode: "view" | "download") {
  const { url } = await api.get<LinkResponse>(`${base}/${id}/url?mode=${mode}`);
  const safe = safeHttpsUrl(url);
  if (!safe) throw new Error("the API returned a link that isn't https");
  return safe;
}

/** Starts a download through a short-lived link; the browser saves the file (Content-Disposition: attachment). */
async function download(base: string, doc: ViewableDocument) {
  const url = await documentLink(base, doc.id, "download");
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * View and download actions for documents, with the viewer, an error toast with retry, and the New badges.
 * `linkBase` is where the short-lived links come from: the patient's own documents, or the admin's view of any.
 */
export function useDocumentActions<T extends ViewableDocument = PatientDocument>(linkBase = "/patient/documents") {
  const [viewing, setViewing] = useState<{ doc: T; url: string } | null>(null);
  const [failed, setFailed] = useState<{ doc: T; mode: "view" | "download" } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  // Opened in this visit: the badge goes at once, without reloading the list (the API agrees on the next load).
  const [opened, setOpened] = useState<ReadonlySet<number>>(new Set());

  // The button that opened the viewer. It is disabled while the link loads, which drops its focus, so focus is put
  // back by hand when the viewer closes.
  const trigger = useRef<HTMLElement | null>(null);

  async function run(doc: T, mode: "view" | "download") {
    if (mode === "view" && document.activeElement instanceof HTMLElement) trigger.current = document.activeElement;
    setFailed(null);
    setBusyId(doc.id);
    try {
      if (mode === "view") setViewing({ doc, url: await documentLink(linkBase, doc.id, "view") });
      else await download(linkBase, doc);
      setOpened((s) => new Set(s).add(doc.id));
    } catch {
      setFailed({ doc, mode });
    } finally {
      setBusyId(null);
    }
  }

  const ui = (
    <>
      {failed && (
        <div role="alert" className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-canvas shadow-[var(--shadow-pop)] lg:bottom-8">
          <AlertIcon size={18} className="shrink-0" />
          <span className="min-w-0 flex-1">Couldn&apos;t {failed.mode === "view" ? "open" : "download"} {failed.doc.title}. Check your connection.</span>
          <button className="min-h-10 px-1 font-bold underline underline-offset-2" onClick={() => void run(failed.doc, failed.mode)}>Retry</button>
          <button className="inline-flex h-10 w-10 items-center justify-center rounded-full" aria-label="Dismiss" onClick={() => setFailed(null)}><CloseIcon size={16} /></button>
        </div>
      )}
      {viewing && <Viewer doc={viewing.doc} url={viewing.url} onClose={() => {
            setViewing(null);
            trigger.current?.focus();
          }} onDownload={() => void run(viewing.doc, "download")} />}
    </>
  );

  return {
    view: (d: T) => void run(d, "view"),
    download: (d: T) => void run(d, "download"),
    isNew: (d: T) => Boolean(d.isNew) && !opened.has(d.id),
    busyId,
    ui,
  };
}

export type DocumentActions = ReturnType<typeof useDocumentActions<PatientDocument>>;

/**
 * The inline viewer: a native modal dialog, so focus is trapped inside, Escape closes it, the page behind is inert,
 * and focus goes back to the button that opened it.
 */
function Viewer({ doc, url, onClose, onDownload }: { doc: ViewableDocument; url: string; onClose: () => void; onDownload: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const d = ref.current;
    // Guarded: React's dev remount runs this twice. No cleanup: removing the element closes it.
    if (d && !d.open) d.showModal();
    closeRef.current?.focus();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      className="m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-overlay/75 sm:p-6"
    >
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden bg-surface text-ink shadow-[var(--shadow-pop)] sm:rounded-[var(--radius-card)] sm:border sm:border-line">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-brand-soft text-brand sm:flex">
            <DocTypeIcon name={doc.type.icon} size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate text-base font-bold">{doc.title}</h2>
            <p className="truncate text-sm text-muted">
              {doc.type.label} · {formatDate(documentDay(doc))} · {doc.source}
            </p>
          </div>
          <button className="btn-secondary min-h-10 px-3 text-sm" onClick={onDownload}>
            <DownloadIcon size={16} /> <span className="sr-only sm:not-sr-only">Download</span>
          </button>
          <button ref={closeRef} className="icon-btn" aria-label="Close" onClick={() => ref.current?.close()}>
            <CloseIcon size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 bg-subtle">
          {doc.mimeType.startsWith("image/") ? (
            <img src={url} alt={doc.title} referrerPolicy="no-referrer" className="h-full w-full object-contain" />
          ) : (
            <iframe src={url} title={doc.title} referrerPolicy="no-referrer" className="h-full w-full bg-surface" />
          )}
        </div>
      </div>
    </dialog>
  );
}

/** Day, month and weekday stacked, for the records timeline. */
function DateBlock({ day }: { day: string }) {
  const p = dayParts(day);
  return (
    <time dateTime={day} className="flex w-12 shrink-0 flex-col items-center rounded-[var(--radius-control)] border border-line bg-subtle py-1.5 leading-none tabular">
      <span className="text-[11px] font-semibold text-muted uppercase">{p.month}</span>
      <span className="mt-1 font-display text-lg font-bold">{p.day}</span>
      <span className="mt-1 text-[11px] text-muted">{p.weekday}</span>
    </time>
  );
}

/**
 * One document (US-03, US-04): the title opens it (or downloads it when there is no preview), with View and
 * Download alongside. `timeline` shows a date block (records page); otherwise the type icon and a relative date.
 */
export function DocumentRow({ doc, actions, timeline = false }: { doc: PatientDocument; actions: DocumentActions; timeline?: boolean }) {
  const busy = actions.busyId === doc.id;
  const isNew = actions.isNew(doc);
  const day = documentDay(doc);
  return (
    <li className="flex items-center gap-3 py-3 sm:gap-4" aria-busy={busy || undefined}>
      {timeline ? (
        <DateBlock day={day} />
      ) : (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-brand-soft text-brand">
          <DocTypeIcon name={doc.type.icon} size={20} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => (doc.canView ? actions.view(doc) : actions.download(doc))}
            className="min-w-0 truncate rounded-sm text-left font-semibold text-ink decoration-brand underline-offset-2 hover:text-brand hover:underline"
          >
            {doc.title}
          </button>
          {isNew && <span className="badge-new">New</span>}
        </div>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-muted">
          {timeline ? (
            <span className="inline-flex items-center gap-1">
              <DocTypeIcon name={doc.type.icon} size={14} /> {doc.type.label}
            </span>
          ) : (
            <>
              <span>{doc.type.label}</span>
              <span aria-hidden="true">·</span>
              <time dateTime={day}>{relativeDay(day)}</time>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span className="truncate">{doc.source}</span>
          <span aria-hidden="true" className="hidden sm:inline">·</span>
          <span className="hidden tabular sm:inline">{formatSize(doc.sizeBytes)}</span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {doc.canView && (
          <button className="icon-btn sm:w-auto sm:gap-1.5 sm:rounded-[var(--radius-control)] sm:px-3 sm:text-sm sm:font-semibold" aria-label={`View ${doc.title}`} disabled={busy} onClick={() => actions.view(doc)}>
            <EyeIcon size={18} /> <span className="hidden sm:inline">View</span>
          </button>
        )}
        <button className="icon-btn" aria-label={`Download ${doc.title}`} title="Download" disabled={busy} onClick={() => actions.download(doc)}>
          <DownloadIcon size={18} />
        </button>
      </div>
    </li>
  );
}

/** Placeholder rows while documents load: same height as real ones, so nothing jumps. */
export function DocumentRowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <ul aria-hidden="true" className="divide-y divide-line">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-4 py-3">
          <span className="skeleton h-11 w-11 shrink-0 rounded-[var(--radius-control)]" />
          <span className="flex-1 space-y-2">
            <span className="skeleton block h-4 w-2/3" />
            <span className="skeleton block h-3 w-1/2" />
          </span>
          <span className="skeleton h-10 w-10 rounded-full" />
        </li>
      ))}
    </ul>
  );
}
