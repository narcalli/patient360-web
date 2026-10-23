import type { Metadata, Viewport } from "next";
import { Figtree, Noto_Sans } from "next/font/google";
import { BrandProvider } from "@/components/brand";
import { ThemeProvider } from "@/components/theme";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import "./globals.css";

// Healthcare pairing: Figtree for headings, Noto Sans for reading. Self-hosted at build time, so the patient's
// browser makes no request to Google.
const heading = Figtree({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-heading", display: "swap" });
const body = Noto_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-body", display: "swap" });

// No title here: the tab title is the hospital's name from hospital_config, set by BrandProvider.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Zoom stays enabled (no maximum-scale): patients with low vision must be able to pinch to zoom.
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The boot script sets data-theme before React hydrates, so the attribute differs from the server HTML.
    <html lang="en-IN" className={`${heading.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">
        <BrandProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </BrandProvider>
      </body>
    </html>
  );
}
