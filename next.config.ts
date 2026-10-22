import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

// Production: a static export served from S3 + CloudFront, with CloudFront sending /api/* to the API.
// Development: next dev proxies /api/* to the local API, so the session cookie is same-origin in both.
export default function config(phase: string): NextConfig {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    const api = process.env.API_ORIGIN ?? "http://localhost:3000";
    return { async rewrites() { return [{ source: "/api/:path*", destination: `${api}/api/:path*` }]; } };
  }
  return { output: "export", trailingSlash: true, images: { unoptimized: true } };
}
