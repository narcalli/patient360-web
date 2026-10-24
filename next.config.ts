import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { securityHeaders } from "./security-headers.mjs";

// Production: a static export served from S3 + CloudFront, with CloudFront sending /api/* to the API and adding
// the security headers from security-headers.mjs. Development: next dev proxies /api/* to the local API (so the
// session cookie is same-origin in both) and sends the same security headers, so the dev server shows what
// production will block.
export default function config(phase: string): NextConfig {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    const api = process.env.API_ORIGIN ?? "http://localhost:3000";
    const documentsOrigin = process.env.DOCUMENTS_ORIGIN;
    const reportsOrigin = process.env.REPORTS_ORIGIN;
    if (!documentsOrigin || !reportsOrigin) throw new Error("Set DOCUMENTS_ORIGIN and REPORTS_ORIGIN in .env.local (see .env.example)");
    // Extra hosts (e.g. a tunnel such as *.ngrok-free.app) allowed to load the dev server's /_next resources.
    const allowedDevOrigins = (process.env.DEV_ALLOWED_ORIGINS ?? "").split(",").map((h) => h.trim()).filter(Boolean);
    return {
      // The dev badge defaults to bottom-left, on top of the sidebar's account row.
      devIndicators: { position: "bottom-right" },
      allowedDevOrigins,
      async rewrites() {
        return [{ source: "/api/:path*", destination: `${api}/api/:path*` }];
      },
      async headers() {
        return [{ source: "/:path*", headers: securityHeaders({ documentsOrigin, reportsOrigin, dev: true }) }];
      },
    };
  }
  return { output: "export", trailingSlash: true, images: { unoptimized: true } };
}
