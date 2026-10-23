"use client";

import { useEffect, useId, useRef } from "react";

/**
 * Asks before a destructive action. A native modal dialog: focus moves in and is trapped, Escape cancels, and focus
 * goes back to the button that opened it. Cancel is focused first, so Enter never confirms by accident.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  busy = false,
  destructive = true,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  busy?: boolean;
  /** False for a confirmation that undoes nothing (e.g. reactivate): the confirm button is the normal one. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    cancelRef.current?.focus();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-[var(--radius-card)] border border-line bg-surface p-0 text-ink shadow-[var(--shadow-pop)] backdrop:bg-overlay/60"
    >
      <div className="p-6">
        <h2 id={titleId} className="text-lg font-bold">{title}</h2>
        <div className="mt-2 text-sm leading-relaxed text-ink-soft">{children}</div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button ref={cancelRef} className="btn-secondary" disabled={busy} onClick={onCancel}>Cancel</button>
          <button className={destructive ? "btn bg-bad text-surface hover:bg-bad/90 disabled:hover:bg-bad" : "btn"} disabled={busy} onClick={onConfirm}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
