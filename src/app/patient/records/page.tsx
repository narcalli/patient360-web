"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { DocumentRow, DocumentRowsSkeleton, useDocumentActions } from "@/components/documents";
import { CloseIcon, FileIcon, SearchIcon } from "@/components/icons";
import { api, type DocumentType, type PatientDocument } from "@/lib/api";
import { documentDay, monthLabel } from "@/lib/format";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

// useSearchParams needs a Suspense boundary in a static export; the fallback has the same shape as the page.
export default function RecordsPage() {
  return (
    <Suspense fallback={<RecordsHeader count={null} />}>
      <Records />
    </Suspense>
  );
}

/**
 * US-03 list, US-04 view/download, US-05 filter by type and date range, plus search and "new only". Every filter
 * lives in the URL, so a filtered view can be bookmarked, linked from the Overview tiles, and survives Back.
 */
function Records() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [types, setTypes] = useState<DocumentType[]>([]);
  const [docs, setDocs] = useState<PatientDocument[] | null>(null);
  const [error, setError] = useState(false);
  const actions = useDocumentActions();

  const typeId = Number(params.get("type")) || null;
  const newOnly = params.get("new") === "1";
  const from = ISO_DAY.test(params.get("from") ?? "") ? params.get("from")! : "";
  const to = ISO_DAY.test(params.get("to") ?? "") ? params.get("to")! : "";
  const q = params.get("q") ?? "";
  const [search, setSearch] = useState(q);

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false });
  }

  // Search waits for a pause in typing before it touches the URL.
  useEffect(() => {
    if (search.trim() === q) return;
    const t = setTimeout(() => update({ q: search.trim() || null }), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    api.get<DocumentType[]>("/document-types").then(setTypes).catch(() => setTypes([]));
    // All of this patient's documents once; filtering is instant on the device (Phase 1 volumes are small).
    api.get<PatientDocument[]>("/patient/documents").then(setDocs).catch(() => setError(true));
  }, []);

  const counts = useMemo(() => {
    const m = new Map<number, number>();
    for (const d of docs ?? []) m.set(d.type.id, (m.get(d.type.id) ?? 0) + 1);
    return m;
  }, [docs]);

  const { isNew } = actions;
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (docs ?? []).filter((d) => {
      const day = documentDay(d);
      if (typeId && d.type.id !== typeId) return false;
      if (newOnly && !isNew(d)) return false;
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (needle && !`${d.title} ${d.type.label} ${d.source}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [docs, typeId, newOnly, from, to, q, isNew]);

  // Grouped by month, newest first (the API already sorts newest first).
  const months = useMemo(() => {
    const m = new Map<string, PatientDocument[]>();
    for (const d of visible) {
      const key = documentDay(d).slice(0, 7);
      m.set(key, [...(m.get(key) ?? []), d]);
    }
    return [...m.entries()];
  }, [visible]);

  const filtered = typeId !== null || newOnly || from !== "" || to !== "" || q !== "";
  const clear = () => {
    setSearch("");
    router.replace(pathname, { scroll: false });
  };
  const shown = types.filter((t) => counts.has(t.id) || t.id === typeId);

  return (
    <>
      <RecordsHeader count={docs?.length ?? null} />

      <section aria-label="Filter records" className="card mt-6 p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor="record-search" className="mb-1.5 block text-sm font-semibold">Search</label>
            <div className="relative">
              <SearchIcon size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
              <input
                id="record-search"
                type="search"
                className="field min-h-11 pl-10"
                placeholder="Report name, type or lab"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:flex lg:items-end">
            <DateInput label="From" value={from} max={to || undefined} onChange={(v) => update({ from: v || null })} />
            <DateInput label="To" value={to} min={from || undefined} onChange={(v) => update({ to: v || null })} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Record type">
          <button className="chip group" aria-pressed={typeId === null && !newOnly} onClick={() => update({ type: null, new: null })}>
            All <Count n={docs?.length} />
          </button>
          {shown.map((t) => (
            <button key={t.id} className="chip group" aria-pressed={typeId === t.id} onClick={() => update({ type: typeId === t.id ? null : String(t.id) })}>
              {t.label} <Count n={counts.get(t.id) ?? 0} />
            </button>
          ))}
          <button className="chip group" aria-pressed={newOnly} onClick={() => update({ new: newOnly ? null : "1" })}>
            New only
          </button>
        </div>
      </section>

      <div className="mt-4 flex min-h-10 items-center justify-between gap-3">
        <p className="text-sm text-muted" role="status" aria-live="polite">
          {docs === null ? "Loading records…" : filtered ? `${visible.length} of ${docs.length} shown` : ""}
        </p>
        {filtered && (
          <button className="btn-ghost" onClick={clear}>
            <CloseIcon size={16} /> Clear filters
          </button>
        )}
      </div>

      <div className="mt-2 space-y-5" aria-busy={docs === null}>
        {error ? (
          <p role="alert" className="card p-6 text-bad">We couldn&apos;t load your records. Please refresh to try again.</p>
        ) : docs === null ? (
          <div className="card px-5 py-2"><DocumentRowsSkeleton rows={5} /></div>
        ) : visible.length === 0 ? (
          <div className="card flex flex-col items-center px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-subtle text-muted"><FileIcon size={24} /></span>
            <p className="mt-3 font-semibold">{filtered ? "No records match these filters" : "No records yet"}</p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              {filtered ? "Try another type, a wider date range, or a different search." : "Lab reports, scans and prescriptions appear here as soon as the hospital or its lab adds them."}
            </p>
            {filtered && <button className="btn-secondary mt-5" onClick={clear}>Clear filters</button>}
          </div>
        ) : (
          months.map(([month, items]) => (
            <section key={month} aria-labelledby={`m-${month}`} className="card px-4 py-2 sm:px-5">
              <h2 id={`m-${month}`} className="flex items-baseline justify-between border-b border-line pt-2 pb-2.5 text-sm font-bold">
                {monthLabel(`${month}-01`)}
                <span className="text-xs font-semibold text-muted">{items.length} {items.length === 1 ? "record" : "records"}</span>
              </h2>
              <ul className="divide-y divide-line">
                {items.map((d) => <DocumentRow key={d.id} doc={d} actions={actions} timeline />)}
              </ul>
            </section>
          ))
        )}
      </div>
      {actions.ui}
    </>
  );
}

function RecordsHeader({ count }: { count: number | null }) {
  return (
    <div>
      <h1 className="text-[28px] leading-tight font-extrabold sm:text-[30px]">Records</h1>
      <p className="mt-1 text-muted">
        Lab reports, scans and prescriptions added by the hospital and its labs{count ? ` · ${count} in total` : ""}.
      </p>
    </div>
  );
}

function Count({ n }: { n?: number }) {
  if (n === undefined) return null;
  return <span className="tabular rounded-full bg-subtle px-1.5 text-xs leading-5 text-muted group-aria-pressed:bg-on-brand/20 group-aria-pressed:text-on-brand">{n}</span>;
}

function DateInput({ label, value, min, max, onChange }: { label: string; value: string; min?: string; max?: string; onChange: (v: string) => void }) {
  const id = `date-${label.toLowerCase()}`;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <span className="flex min-h-11 items-center rounded-[var(--radius-control)] border border-field-line bg-surface px-3 focus-within:border-brand">
        <input id={id} type="date" className="tabular w-full min-w-0 bg-transparent text-sm text-ink outline-none" value={value} min={min} max={max} onChange={(e) => onChange(e.target.value)} />
      </span>
    </div>
  );
}
