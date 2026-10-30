"use client";

import { createContext, useContext } from "react";
import type { LinkedPatient, Me } from "@/lib/api";

export interface ShellState {
  me: Me;
  patient: LinkedPatient;
  /** Opens another patient linked to this login (US-06). */
  switchTo: (patientId: string) => Promise<void>;
  switching: boolean;
  /** Reloads /me, e.g. after consent changes in Profile. */
  reload: () => Promise<unknown>;
}

export const ShellContext = createContext<ShellState | null>(null);

/** The signed-in login and the patient whose records are open. Only usable inside the app shell. */
export function useShell(): ShellState {
  const s = useContext(ShellContext);
  if (!s) throw new Error("useShell outside the app shell");
  return s;
}
