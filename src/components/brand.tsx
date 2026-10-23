"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api, type Hospital } from "@/lib/api";
import { parseHospital } from "@/lib/branding";
import { brandVariables } from "@/lib/color";

const BrandContext = createContext<Hospital | null>(null);

// The last branding seen, so a returning visitor gets the right logo and colours on the first frame. A DB change
// still shows on the next load, because the API is always asked again.
const CACHE_KEY = "p360.brand";

function readCache(): Hospital | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? parseHospital(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function writeCache(h: Hospital) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(h));
  } catch {
    // Private mode or storage blocked: the portal works the same, only the first frame waits for the API.
  }
}

/** Applies the hospital's colours, adjusted for contrast in each theme, as the --p360-* variables globals.css reads. */
function apply(h: Hospital) {
  const root = document.documentElement.style;
  // Missing colours fall back to the neutral defaults in globals.css.
  for (const [name, value] of Object.entries(brandVariables(h))) {
    if (value) root.setProperty(name, value);
    else root.removeProperty(name);
  }
}

/**
 * Loads the hospital's branding (white-label: name, logos, colours and sign-in text come from the API, never
 * from code). Nothing is shown until the branding is known, so a patient never sees another look flash first.
 */
export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const cached = readCache();
    if (cached) {
      apply(cached);
      setHospital(cached);
      setReady(true);
    }
    api
      .get<unknown>("/hospital")
      .then((raw) => {
        const h = parseHospital(raw);
        if (!h) return;
        apply(h);
        writeCache(h);
        setHospital(h);
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  if (!ready) return null;
  return (
    <BrandContext.Provider value={hospital}>
      {/* Rendered by React (hoisted into <head>), so Next's navigation doesn't reset it. */}
      {hospital && <title>{hospital.portalTitle ? `${hospital.name} · ${hospital.portalTitle}` : hospital.name}</title>}
      {children}
    </BrandContext.Provider>
  );
}

export const useHospital = () => useContext(BrandContext);

/**
 * The hospital logo. "light" is for coloured backgrounds: the hospital's light logo when it has one, otherwise the
 * normal logo turned white. On page backgrounds the normal logo shows in light mode and the light one in dark mode
 * (switched in CSS, so "System" follows the device without a re-render). With no logo, the short name stands in.
 */
export function Logo({ light = false, className = "" }: { light?: boolean; className?: string }) {
  const h = useHospital();
  const [broken, setBroken] = useState(false);
  if (!h) return <div className={`h-10 ${className}`} />;

  if (broken || !(h.logoUrl ?? h.logoLightUrl)) {
    return <span className={`block font-display text-2xl font-extrabold break-words ${light ? "text-on-panel" : "text-heading"} ${className}`}>{h.shortName}</span>;
  }
  const onColour = (
    <img
      src={h.logoLightUrl ?? h.logoUrl!}
      alt={h.name}
      className={`${h.logoLightUrl ? "" : "brightness-0 invert"} ${className}`}
      onError={() => setBroken(true)}
    />
  );
  if (light) return onColour;
  return (
    <>
      <img src={h.logoUrl ?? h.logoLightUrl!} alt={h.name} className={`dark:hidden ${h.logoUrl ? "" : "brightness-0"} ${className}`} onError={() => setBroken(true)} />
      <span className="hidden dark:contents">{onColour}</span>
    </>
  );
}

/** The portal's name under the logo ("Patient portal"), when the hospital has set one. */
export function PortalTitle({ className = "" }: { className?: string }) {
  const title = useHospital()?.portalTitle;
  return title ? <p className={`text-[11px] font-bold tracking-[0.08em] uppercase ${className}`}>{title}</p> : null;
}

/** "By continuing you agree to …", linking whichever of the terms and privacy policy the hospital has set. */
export function TermsNote() {
  const h = useHospital();
  if (!h?.termsUrl && !h?.privacyUrl) return null;
  const link = (href: string, label: string) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand underline underline-offset-2">{label}</a>
  );
  return (
    <>
      By continuing you agree to {h.shortName}&apos;s{" "}
      {h.termsUrl && link(h.termsUrl, "terms")}
      {h.termsUrl && h.privacyUrl && " and "}
      {h.privacyUrl && link(h.privacyUrl, "privacy policy")}.
    </>
  );
}
