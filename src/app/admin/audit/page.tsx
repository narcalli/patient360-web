"use client";

import { Suspense, useEffect, useId, useState } from "react";
import { ShieldIcon } from "@/components/icons";
import { EmptyState, ErrorBanner, PageHeader, RowsSkeleton, useUrlState } from "@/components/staff-ui";
import { formatDateTime, humanize } from "@/lib/format";
import { api, type AuditItem, type AuditPage } from "@/lib/api";

const FILTERS = ["action", "actorType", "patientCode", "from", "to"] as const;
type Filters = Record<(typeof FILTERS)[number], string>;

/** US-16: who did what, to which patient, when. Newest first, filtered from the address so a view can be shared. */
export default function AuditPageRoute() {
  return (
    <Suspense>
      <Audit />
    </Suspense>
  );
}

function Audit() {
  const { params, set } = useUrlState();
  const filters = Object.fromEntries(FILTERS.map((k) => [k, params.get(k) ?? ""])) as Filters;
  const key = FILTERS.map((k) => filters[k]).join("|");
  const [page, setPage] = useState<AuditPage | null>(null);
  const [items, setItems] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  async function fetchPage(before: number | null) {
    const q = new URLSearchParams();
    for (const k of FILTERS) if (filters[k]) q.set(k, filters[k]);
    if (before) q.set("before", String(before));
    return api.get<AuditPage>(`/admin/audit?${q}`);
  }

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(false);
    fetchPage(null)
      .then((p) => {
        if (!live) return;
        setPage(p);
        setItems(p.items);
      })
      .catch(() => live && setError(true))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [key, attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  async function more() {
    if (!page?.nextBefore) return;
    setLoading(true);
    try {
      const p = await fetchPage(page.nextBefore);
      setPage(p);
      setItems((list) => [...list, ...p.items]);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  const active = FILTERS.some((k) => filters[k]);

  return (
    <>
      <PageHeader title="Audit log" description="Every sign-in, view, download and change, newest first. Times are India Standard Time." />

      <FilterBar
        filters={filters}
        actions={page?.actions ?? []}
        actorTypes={page?.actorTypes ?? []}
        onApply={(f) => set(f)}
        onClear={active ? () => set(Object.fromEntries(FILTERS.map((k) => [k, null]))) : undefined}
      />

      <section aria-label="Audit entries" aria-busy={loading} className="mt-6">
        {error ? (
          <ErrorBanner text="We couldn't load the audit log. Check your connection." onRetry={() => setAttempt((n) => n + 1)} />
        ) : loading && items.length === 0 ? (
          <RowsSkeleton rows={6} />
        ) : items.length === 0 ? (
          <EmptyState icon={<ShieldIcon size={22} />} title={active ? "Nothing matches these filters" : "Nothing recorded yet"}>
            {active && "Try a wider date range or fewer filters."}
          </EmptyState>
        ) : (
          <>
            <Entries items={items} />
            <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted">
              <span role="status">{items.length} entries shown</span>
              {page?.nextBefore && (
                <button className="btn-secondary" disabled={loading} onClick={() => void more()}>
                  {loading ? "Loading…" : "Show older entries"}
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </>
  );
}

function FilterBar({
  filters,
  actions,
  actorTypes,
  onApply,
  onClear,
}: {
  filters: Filters;
  actions: string[];
  actorTypes: string[];
  onApply: (f: Record<string, string | null>) => void;
  onClear?: () => void;
}) {
  const [draft, setDraft] = useState(filters);
  const id = useId();
  const key = Object.values(filters).join("|");
  useEffect(() => setDraft(filters), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const bind = (k: keyof Filters) => ({
    id: `${id}-${k}`,
    value: draft[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setDraft((d) => ({ ...d, [k]: e.target.value })),
  });
  const label = (k: keyof Filters, text: string) => (
    <label htmlFor={`${id}-${k}`} className="block text-sm font-semibold">{text}</label>
  );

  return (
    <form
      className="card mt-6 grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-[repeat(5,minmax(0,1fr))]"
      onSubmit={(e) => {
        e.preventDefault();
        onApply(Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v.trim() || null])));
      }}
    >
      <div>
        {label("action", "Action")}
        <select className="field mt-1.5" {...bind("action")}>
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{humanize(a)}</option>
          ))}
        </select>
      </div>
      <div>
        {label("actorType", "Who")}
        <select className="field mt-1.5" {...bind("actorType")}>
          <option value="">Everyone</option>
          {actorTypes.map((a) => (
            <option key={a} value={a}>{humanize(a)}</option>
          ))}
        </select>
      </div>
      <div>
        {label("patientCode", "Patient ID")}
        <input className="field mt-1.5 tabular" autoComplete="off" spellCheck={false} maxLength={20} {...bind("patientCode")} />
      </div>
      <div>
        {label("from", "From")}
        <input type="date" className="field mt-1.5" max={draft.to || undefined} {...bind("from")} />
      </div>
      <div>
        {label("to", "To")}
        <input type="date" className="field mt-1.5" min={draft.from || undefined} {...bind("to")} />
      </div>
      <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-5 lg:justify-end">
        {onClear && (
          <button type="button" className="btn-ghost" onClick={onClear}>
            Clear filters
          </button>
        )}
        <button className="btn">Apply filters</button>
      </div>
    </form>
  );
}

/** "channel: WHATSAPP · results: 3": details as plain text, never as markup. */
function detailText(d: Record<string, unknown> | null) {
  if (!d) return null;
  const parts = Object.entries(d)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v)}`);
  return parts.length ? parts.join(" · ") : null;
}

function Who({ item }: { item: AuditItem }) {
  return (
    <>
      <span className="badge bg-subtle text-ink-soft ring-1 ring-line ring-inset">{humanize(item.actorType)}</span>
      {item.actor && <span className="ml-2 font-semibold tabular">{item.actor}</span>}
    </>
  );
}

function Entries({ items }: { items: AuditItem[] }) {
  return (
    <>
      <ul className="card divide-y divide-line md:hidden">
        {items.map((r) => (
          <li key={r.id} className="space-y-1.5 px-4 py-3.5">
            <p className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">{humanize(r.action)}</span>
              <time dateTime={r.at} className="text-sm text-muted tabular">{formatDateTime(r.at)}</time>
            </p>
            <p className="text-sm"><Who item={r} /></p>
            {r.patient && <p className="text-sm text-muted">{r.patient.fullName} · <span className="tabular">{r.patient.patientCode}</span></p>}
            {detailText(r.details) && <p className="text-sm text-muted [overflow-wrap:anywhere]">{detailText(r.details)}</p>}
          </li>
        ))}
      </ul>

      <div className="card hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-subtle text-xs font-semibold tracking-wide text-muted uppercase">
            <tr>
              <th scope="col" className="px-4 py-3 whitespace-nowrap">When</th>
              <th scope="col" className="px-4 py-3">Who</th>
              <th scope="col" className="px-4 py-3">Action</th>
              <th scope="col" className="px-4 py-3">Patient</th>
              <th scope="col" className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.map((r) => (
              <tr key={r.id} className="align-top transition-colors duration-150 hover:bg-subtle">
                <td className="px-4 py-3 whitespace-nowrap text-muted tabular">
                  <time dateTime={r.at}>{formatDateTime(r.at)}</time>
                </td>
                <td className="px-4 py-3 whitespace-nowrap"><Who item={r} /></td>
                <td className="px-4 py-3 font-semibold">{humanize(r.action)}</td>
                <td className="px-4 py-3">
                  {r.patient ? (
                    <>
                      <span className="block">{r.patient.fullName}</span>
                      <span className="text-muted tabular">{r.patient.patientCode}</span>
                    </>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="max-w-xs px-4 py-3 text-muted [overflow-wrap:anywhere]">
                  {detailText(r.details) ?? "—"}
                  {r.documentId && <span className="block">document {r.documentId}</span>}
                  {r.ip && <span className="block text-xs tabular">IP {r.ip}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
