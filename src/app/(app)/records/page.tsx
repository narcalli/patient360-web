"use client";

import { useEffect, useMemo, useState } from "react";
import { DocumentRow, useDocumentActions } from "@/components/documents";
import { CalendarIcon, CloseIcon, FileIcon } from "@/components/icons";
import { api, type DocumentType, type PatientDocument } from "@/lib/api";
import { formatDate } from "@/lib/format";

/** US-03 list, US-04 view/download, US-05 filter by type and date range. */
export default function RecordsPage() {
  const [types, setTypes] = useState<DocumentType[]>([]);
  const [typeId, setTypeId] = useState<number | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [docs, setDocs] = useState<PatientDocument[] | null>(null);
  const [error, setError] = useState(false);
  const actions = useDocumentActions();

  useEffect(() => {
    api.get<DocumentType[]>("/document-types").then(setTypes).catch(() => setTypes([]));
  }, []);

  useEffect(() => {
    const q = new URLSearchParams();
    if (typeId) q.set("typeId", String(typeId));
    if (from) q.set("from", from);
    if (to) q.set("to", to);
    setDocs(null);
    setError(false);
    api
      .get<PatientDocument[]>(`/patient/documents${q.size ? `?${q}` : ""}`)
      .then(setDocs)
      .catch(() => setError(true));
  }, [typeId, from, to]);

  // Group by report date, newest first, like the visit groups in the design.
  const groups = useMemo(() => {
    const m = new Map<string, PatientDocument[]>();
    for (const d of docs ?? []) {
      const key = d.documentDate ?? d.uploadedAt.slice(0, 10);
      m.set(key, [...(m.get(key) ?? []), d]);
    }
    return [...m.entries()];
  }, [docs]);

  const filtered = typeId !== null || from !== "" || to !== "";
  const clear = () => {
    setTypeId(null);
    setFrom("");
    setTo("");
  };

  return (
    <>
      <h1 className="text-[30px] leading-tight font-extrabold text-ink-strong">My records</h1>
      <p className="mt-1 text-muted">Lab reports, scans and prescriptions added by the hospital and its labs.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        <button className={`chip ${typeId === null ? "chip-on" : ""}`} onClick={() => setTypeId(null)}>All</button>
        {types.map((t) => (
          <button key={t.id} className={`chip ${typeId === t.id ? "chip-on" : ""}`} onClick={() => setTypeId(t.id)}>{t.label}</button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <DateInput label="From" value={from} max={to || undefined} onChange={setFrom} />
        <DateInput label="To" value={to} min={from || undefined} onChange={setTo} />
        {filtered && (
          <button className="inline-flex min-h-[42px] items-center gap-1 text-sm font-semibold text-brand" onClick={clear}>
            <CloseIcon size={16} /> Clear filters
          </button>
        )}
      </div>

      <div className="mt-6 space-y-4">
        {error ? (
          <p className="card p-6 text-bad">We couldn&apos;t load your records. Please refresh to try again.</p>
        ) : docs === null ? (
          <p className="card p-6 text-muted">Loading…</p>
        ) : docs.length === 0 ? (
          <div className="card flex flex-col items-center px-6 py-14 text-center">
            <FileIcon size={32} className="text-muted" />
            <p className="mt-3 font-semibold">{filtered ? "No documents match these filters" : "No documents yet"}</p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              {filtered ? "Try another type or a wider date range." : "Reports and prescriptions appear here as soon as the hospital or its lab adds them."}
            </p>
            {filtered && <button className="btn-secondary mt-5" onClick={clear}>Clear filters</button>}
          </div>
        ) : (
          groups.map(([date, items]) => (
            <section key={date} className="card flex flex-col gap-2 p-5 sm:flex-row sm:gap-6">
              <p className="w-32 shrink-0 pt-3 text-sm font-bold text-brand">{formatDate(date)}</p>
              <div className="min-w-0 flex-1 divide-y divide-line">
                {items.map((d) => <DocumentRow key={d.id} doc={d} actions={actions} />)}
              </div>
            </section>
          ))
        )}
      </div>
      {actions.ui}
    </>
  );
}

function DateInput({ label, value, min, max, onChange }: { label: string; value: string; min?: string; max?: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
      {label}
      <span className="flex min-h-[42px] items-center gap-2 rounded-[var(--radius-control)] border border-line bg-white px-3 focus-within:border-brand">
        <CalendarIcon size={16} />
        <input type="date" className="bg-transparent text-sm text-ink outline-none" value={value} min={min} max={max} onChange={(e) => onChange(e.target.value)} />
      </span>
    </label>
  );
}
