// Security headers for every portal page. A static export can't set headers itself, so the same list is applied
// by `next dev` (next.config.ts) and by the CloudFront response headers policy at deploy, keeping the two in step.
//
// documentsOrigin: the S3 origin that the API's short-lived document links point at (viewer iframe and image).
// reportsOrigin: the lab reports bucket: lab partners send files there, and the viewer opens them from there.
// They come from DOCUMENTS_ORIGIN and REPORTS_ORIGIN, never from code, so a different bucket or hospital needs no
// code change.

/** @param {string} value @param {string} name */
function s3Origin(value, name) {
  const origin = new URL(value);
  if (origin.protocol !== "https:" || origin.pathname !== "/") throw new Error(`${name} must be an https origin, e.g. https://<bucket>.s3.<region>.amazonaws.com`);
  return origin.origin;
}

/** @param {{ documentsOrigin: string, reportsOrigin: string, dev?: boolean }} opts */
export function securityHeaders({ documentsOrigin, reportsOrigin, dev = false }) {
  const docs = `${s3Origin(documentsOrigin, "DOCUMENTS_ORIGIN")} ${s3Origin(reportsOrigin, "REPORTS_ORIGIN")}`;
  const uploads = s3Origin(reportsOrigin, "REPORTS_ORIGIN");

  const csp = [
    "default-src 'self'",
    // Next's static export inlines its boot scripts, so 'unsafe-inline' is needed; dev also needs eval for React.
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${docs}`,
    `frame-src ${docs}`,
    // Uploads go from the browser straight to the reports bucket (presigned POST).
    `connect-src 'self' ${uploads}${dev ? " ws:" : ""}`,
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "same-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ...(dev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
  ];
}
