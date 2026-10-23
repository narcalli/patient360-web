"use client";

import { useHospital } from "./brand";
import { HelpIcon, MailIcon, PhoneIcon } from "./icons";

// Support contacts come from hospital_config. Links are built only from values that can't smuggle anything in.
export const telHref = (phone: string) => {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits.length >= 6 ? `tel:${digits}` : null;
};
export const mailHref = (email: string) => (/^[^\s@?&#<>"']+@[^\s@?&#<>"']+\.[a-z]{2,}$/i.test(email) ? `mailto:${email}` : null);

/** "Need help?" with the hospital's phone and email. Renders nothing when the hospital has set neither. */
export function HelpCard({ className = "" }: { className?: string }) {
  const h = useHospital();
  if (!h?.supportPhone && !h?.supportEmail) return null;
  const tel = h.supportPhone ? telHref(h.supportPhone) : null;
  const mail = h.supportEmail ? mailHref(h.supportEmail) : null;
  return (
    <section aria-label="Need help?" className={`rounded-[var(--radius-card)] border border-line bg-subtle p-4 ${className}`}>
      <h2 className="flex items-center gap-2 text-sm font-bold">
        <HelpIcon size={18} className="text-brand" /> Need help?
      </h2>
      <p className="mt-1 text-sm text-muted">Questions about your records? Contact {h.shortName}.</p>
      <ul className="mt-3 space-y-1">
        {h.supportPhone && (
          <li>
            {tel ? (
              <a href={tel} className="btn-ghost -ml-3 tabular"><PhoneIcon size={16} /> {h.supportPhone}</a>
            ) : (
              <span className="text-sm font-semibold">{h.supportPhone}</span>
            )}
          </li>
        )}
        {h.supportEmail && (
          <li>
            {mail ? (
              <a href={mail} className="btn-ghost -ml-3 max-w-full break-all"><MailIcon size={16} className="shrink-0" /> {h.supportEmail}</a>
            ) : (
              <span className="text-sm font-semibold break-all">{h.supportEmail}</span>
            )}
          </li>
        )}
      </ul>
    </section>
  );
}
