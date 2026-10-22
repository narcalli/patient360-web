"use client";

import { useEffect, useState } from "react";
import { api, type PatientDocument } from "@/lib/api";
import { formatDate, formatSize } from "@/lib/format";
import { AlertIcon, CloseIcon, DocTypeIcon, DownloadIcon, EyeIcon } from "./icons";

type LinkResponse = { url: string; expiresInSeconds: number };

const documentLink = (id: number, mode: "view" | "download") =>
  api.get<LinkResponse>(`/patient/documents/${id}/url?mode=${mode}`).then((r) => r.url);

/** Starts a download through a short-lived link; the browser saves the file (Content-Disposition: attachment). */
async function download(doc: PatientDocument) {
  const url = await documentLink(doc.id, "download");
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** View and download actions for documents, with the inline viewer and an error banner with retry. */
export function useDocumentActions() {
  const [viewing, setViewing] = useState<{ doc: PatientDocument; url: string } | null>(null);
  const [failed, setFailed] = useState<{ doc: PatientDocument; mode: "view" | "download" } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function run(doc: PatientDocument, mode: "view" | "download") {
    setFailed(null);
    setBusyId(doc.id);
    try {
      if (mode === "view") setViewing({ doc, url: await documentLink(doc.id, "view") });
      else await download(doc);
    } catch {
      setFailed({ doc, mode });
    } finally {
      setBusyId(null);
    }
  }

  const ui = (
    <>
      {failed && (
        <div role="alert" className="fixed inset-x-4 bottom-24 z-30 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-lg lg:bottom-8">
          <AlertIcon size={18} className="shrink-0" />
          <span className="flex-1">Couldn&apos;t {failed.mode === "view" ? "open" : "download"} {failed.doc.filename}.</span>
          <button className="font-bold underline" onClick={() => void run(failed.doc, failed.mode)}>Retry</button>
          <button aria-label="Dismiss" onClick={() => setFailed(null)}><CloseIcon size={16} /></button>
        </div>
      )}
      {viewing && <Viewer doc={viewing.doc} url={viewing.url} onClose={() => setViewing(null)} onDownload={() => void run(viewing.doc, "download")} />}
    </>
  );

  return { view: (d: PatientDocument) => void run(d, "view"), download: (d: PatientDocument) => void run(d, "download"), busyId, ui };
}

function Viewer({ doc, url, onClose, onDownload }: { doc: PatientDocument; url: string; onClose: () => void; onDownload: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-[#0b1a22]/80 p-0 sm:p-6" role="dialog" aria-modal="true" aria-label={doc.filename}>
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden bg-white sm:rounded-[var(--radius-card)]">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{doc.filename}</p>
            <p className="text-xs text-muted">{doc.type.label} · {doc.source}</p>
          </div>
          <button className="btn-secondary min-h-[40px] text-sm" onClick={onDownload}><DownloadIcon size={16} /> Download</button>
          <button className="icon-btn" aria-label="Close" onClick={onClose}><CloseIcon size={18} /></button>
        </div>
        <div className="flex-1 bg-canvas">
          {doc.mimeType.startsWith("image/") ? (
            <img src={url} alt={doc.filename} className="h-full w-full object-contain" />
          ) : (
            <iframe src={url} title={doc.filename} className="h-full w-full" />
          )}
        </div>
      </div>
    </div>
  );
}

/** One document line: type icon, name, source, date and the actions (US-03, US-04). */
export function DocumentRow({ doc, actions }: { doc: PatientDocument; actions: ReturnType<typeof useDocumentActions> }) {
  const busy = actions.busyId === doc.id;
  return (
    <div className="flex items-center gap-4 py-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-brand-soft text-brand">
        <DocTypeIcon code={doc.type.code} size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{doc.filename.replace(/\.[a-z0-9]+$/i, "")}</p>
        <p className="truncate text-sm text-muted">
          {doc.type.label} · {doc.source} · {formatDate(doc.documentDate ?? doc.uploadedAt)} · {formatSize(doc.sizeBytes)}
        </p>
      </div>
      {doc.canView ? (
        <button className="icon-btn" aria-label={`View ${doc.filename}`} disabled={busy} onClick={() => actions.view(doc)}><EyeIcon size={18} /></button>
      ) : (
        <span className="hidden text-xs text-muted sm:block">No preview</span>
      )}
      <button className="icon-btn" aria-label={`Download ${doc.filename}`} disabled={busy} onClick={() => actions.download(doc)}><DownloadIcon size={18} /></button>
    </div>
  );
}
