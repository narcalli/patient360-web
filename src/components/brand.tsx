"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api, type Hospital } from "@/lib/api";

const BrandContext = createContext<Hospital | null>(null);

/** Loads the hospital's branding once and applies its colours as CSS variables (white-label). */
export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [hospital, setHospital] = useState<Hospital | null>(null);

  useEffect(() => {
    api
      .get<Hospital>("/hospital")
      .then((h) => {
        const root = document.documentElement.style;
        root.setProperty("--color-brand", h.primaryColor);
        root.setProperty("--color-ink-strong", h.secondaryColor);
        document.title = `${h.name} · Patient portal`;
        setHospital(h);
      })
      .catch(() => setHospital(null));
  }, []);

  return <BrandContext.Provider value={hospital}>{children}</BrandContext.Provider>;
}

export const useHospital = () => useContext(BrandContext);

/** The hospital logo; "light" turns it white for coloured backgrounds. */
export function Logo({ light = false, className = "" }: { light?: boolean; className?: string }) {
  const h = useHospital();
  if (!h) return <div className={`h-10 ${className}`} />;
  if (!h.logoUrl) return <span className={`text-xl font-extrabold ${light ? "text-white" : "text-ink-strong"} ${className}`}>{h.shortName}</span>;
  return <img src={h.logoUrl} alt={h.name} className={`${light ? "brightness-0 invert" : ""} ${className}`} />;
}
