import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { BrandProvider } from "@/components/brand";
import "./globals.css";

// Self-hosted at build time: no request to Google from the patient's browser.
const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-manrope" });

export const metadata: Metadata = {
  title: "Patient portal",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={manrope.variable}>
      <body className="font-sans antialiased">
        <BrandProvider>{children}</BrandProvider>
      </body>
    </html>
  );
}
