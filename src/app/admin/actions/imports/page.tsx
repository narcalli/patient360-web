"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImportStatusBadge, ImportUploadDialog } from "@/components/import-ui";
import { ChevronLeft, ChevronRight, FileIcon, PlusIcon, UploadIcon } from "@/components/icons";
import { EmptyState, ErrorBanner, PageHeader, RowsSkeleton, useToast, useUrlState } from "@/components/staff-ui";
import { api, type ImportStatus, type ImportTypeRow, type ImportView } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { plural, summaryLine } from "@/lib/imports";

/**
 * Import: bring people in from an Excel sheet. Pick an import type, upload the sheet, see what is wrong with it row
 * by row, replace the sheet until it is right, then run it. Each import stays on record after it has run.
 */
export default function ImportsPage() {
  return (
    <Suspense>
      <Imports />
    </Suspense>
  );
}

// "Completed" covers both ways of finishing, so nobody has to know the difference to find them.
const FILTERS: { key: string; label: string; match: (s: ImportStatus) => boolean }[] = [
  { key: "", label: "All", match: () => true },
  { key: "ready", label: "Ready", match: (s) => s === "READY" },
  { key: "fix", label: "Needs fixing", match: (s) => s === "NEEDS_FIX" || s === "UPLOADING" },
  { key: "running", label: "Importing", match: (s) => s === "IMPORTING" },
  { key: "done", label: "Completed", match: (s) => s === "COMPLETED" || s === "COMPLETED_WITH_ISSUES" },
  { key: "failed", label: "Failed", match: (s) => s === "FAILED" },
];

const POLL_MS = 3000;

function Imports() {
  const router = useRouter();
  const { params, set } = useUrlState();
  const filter = FILTERS.find((f) => f.key === params.get("show")) ?? FILTERS[0]!;
  const [types, setTypes] = useState<ImportTypeRow[] | null>(null);
  const [items, setItems] = useState<ImportView[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [creating, setCreating] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const [t, list] = await Promise.all([api.get<ImportTypeRow[]>("/admin/imports/types"), api.get<ImportView[]>("/admin/imports")]);
      setTypes(t);
      setItems(list);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, attempt]);

  // While something is importing or being checked the list keeps itself up to date.
  const running = items?.some((i) => i.status === "IMPORTING" || i.working) ?? false;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(t);
  }, [running, load]);

  const shown = items?.filter((i) => filter.match(i.status)) ?? [];
  const count = (f: (typeof FILTERS)[number]) => items?.filter((i) => f.match(i.status)).length ?? 0;

  return (
    <>
      <Link href="/admin/actions" className="btn-ghost -ml-3 mb-2">
        <ChevronLeft size={16} /> Admin Actions
      </Link>
      <PageHeader
        title="Import"
        description="Bring people in from an Excel sheet. Every row is checked before anything is imported, and you can replace the sheet until it is right."
        actions={
          <button type="button" className="btn" disabled={!types?.length} onClick={() => setCreating(true)}>
            <PlusIcon size={18} /> New import
          </button>
        }
      />

      {items && items.length > 0 && (
        <div role="group" aria-label="Show" className="mt-6 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" className="chip" aria-pressed={filter.key === f.key} onClick={() => set({ show: f.key || null })}>
              {f.label} <span className="tabular text-muted">{count(f)}</span>
            </button>
          ))}
        </div>
      )}

      <section aria-label="Imports" aria-busy={!items && !error} className="mt-5">
        {error ? (
          <ErrorBanner text="We couldn't load the imports. Check your connection." onRetry={() => setAttempt((n) => n + 1)} />
        ) : !items ? (
          <RowsSkeleton />
        ) : items.length === 0 ? (
          <EmptyState icon={<UploadIcon size={22} />} title="No imports yet">
            <p>Upload an Excel sheet to bring in patients. You will see what is wrong with it before anything changes.</p>
            <button type="button" className="btn mt-4" disabled={!types?.length} onClick={() => setCreating(true)}>
              <PlusIcon size={18} /> Start your first import
            </button>
          </EmptyState>
        ) : shown.length === 0 ? (
          <EmptyState icon={<FileIcon size={22} />} title="Nothing here">
            No imports are {filter.label.toLowerCase()}.
          </EmptyState>
        ) : (
          <ul className="card divide-y divide-line">
            {shown.map((i) => (
              <ImportLine key={i.id} item={i} />
            ))}
          </ul>
        )}
      </section>

      {creating && types && (
        <ImportUploadDialog
          types={types}
          onClose={(changed) => {
            setCreating(false);
            if (changed) void load();
          }}
          onChecked={(view) => {
            setCreating(false);
            toast.show(view.working ? "Sheet uploaded. It is being checked." : view.status === "READY" ? `Sheet checked: ${plural(view.counts.ready, "patient")} ready to import.` : "Sheet uploaded. It needs fixing before it can be imported.");
            router.push(`/admin/actions/imports/view?id=${view.id}`);
          }}
        />
      )}
      {toast.ui}
    </>
  );
}

function ImportLine({ item }: { item: ImportView }) {
  return (
    <li>
      <Link href={`/admin/actions/imports/view?id=${item.id}`} className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-subtle sm:px-5">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand" aria-hidden="true">
          <FileIcon size={20} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-bold [overflow-wrap:anywhere]">{item.label}</span>
            <ImportStatusBadge status={item.status} working={item.working} />
          </span>
          <span className="mt-0.5 block text-sm text-ink-soft">{item.statusNote && item.status !== "IMPORTING" && !item.sheet ? item.statusNote : summaryLine(item)}</span>
          <span className="mt-0.5 block text-sm text-muted">
            {item.type.label} · {item.sheet?.name ?? "No sheet"} · {item.createdBy}, {formatDateTime(item.createdAt)}
          </span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-muted" />
      </Link>
    </li>
  );
}
