"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

/**
 * A button that shows and hides a panel (WAI disclosure pattern): Escape and a click outside close it and return
 * focus to the button, and opening moves focus to the first control in the panel.
 */
export function useDisclosure() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>("button:not([tabindex='-1']), a[href], [tabindex='0']")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !buttonRef.current?.contains(t)) close(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, close]);

  return {
    open,
    close,
    buttonProps: {
      ref: buttonRef,
      type: "button" as const,
      "aria-expanded": open,
      "aria-controls": id,
      onClick: () => setOpen((o) => !o),
    },
    panelProps: { ref: panelRef, id, hidden: !open },
  };
}
