# patient360-web

The Patient 360 portal: Next.js 16 (static export) + React 19 + Tailwind CSS 4.
Phase 1 patient view: sign in with mobile + WhatsApp OTP, patient picker, consent, Home, My records, Profile.
Lab partner and admin views come next.

Branding is white-label: name, logo and colours come from the API (`/api/hospital`). Logos live in
`public/brands/<hospital>/`.

## Run locally

```bash
nvm use                 # Node 24
npm ci
# start patient360-api on :3000 first (OTP_SENDER=console prints codes to its log)
npm run dev             # http://localhost:3001, proxies /api/* to http://localhost:3000
```

Set `API_ORIGIN` to point the dev proxy somewhere else.

## Build

`npm run build` writes a static site to `out/`, served from S3 + CloudFront. CloudFront sends `/api/*` to the
API, so the session cookie is first-party and no token is ever handled in JavaScript.
