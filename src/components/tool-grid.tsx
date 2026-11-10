"use client";

import Link from "next/link";
import { ChevronRight } from "./icons";

export type Tool = { href: string; label: string; description: string; icon: React.ReactNode };

/** Small tiles, one per tool, each opening its page; what a tool is for shows on hover and keyboard focus. Used by Admin and Data. */
export function ToolGrid({ tools }: { tools: Tool[] }) {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))] gap-3">
      {tools.map((t, i) => (
        <li key={t.href} className="relative">
          <Link
            href={t.href}
            aria-describedby={`tool-hint-${i}`}
            className="card group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-subtle"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand" aria-hidden="true">
              {t.icon}
            </span>
            <span className="min-w-0 flex-1 font-bold">{t.label}</span>
            <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden="true" />
            <span
              id={`tool-hint-${i}`}
              role="tooltip"
              className="pointer-events-none absolute top-full left-3 z-20 mt-1.5 w-64 max-w-[calc(100%-1.5rem)] rounded-md bg-ink px-3 py-2 text-xs font-medium text-canvas opacity-0 shadow-[var(--shadow-pop)] transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
            >
              {t.description}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
