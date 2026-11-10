"use client";

import { useHospital } from "./brand";
import { WhatsAppIcon } from "./icons";

/** wa.me wants digits only, with the country code; a bare 10-digit number is an Indian mobile. */
export const whatsAppHref = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  const full = digits.length === 10 ? `91${digits}` : digits;
  return full.length >= 11 ? `https://wa.me/${full}` : null;
};

/**
 * A plain WhatsApp icon, fixed at the bottom right of every patient page and the sign-in pages. It opens a chat with the Ovum bot
 * (WhatsApp Web on a computer). The number comes from the API's WHATSAPP_BOT_PHONE (via /hospital); without one nothing shows.
 */
export function WhatsAppBot() {
  const phone = useHospital()?.botPhone;
  const href = phone ? whatsAppHref(phone) : null;
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      title="Chat with us on WhatsApp"
      className="fixed right-3 bottom-3 z-30 inline-flex h-10 w-10 items-center justify-center rounded-full bg-whatsapp text-white shadow-[var(--shadow-pop)] hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 lg:right-5 lg:bottom-5"
    >
      <WhatsAppIcon size={22} />
    </a>
  );
}
