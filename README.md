# patient360-web

The Patient 360 portal: Next.js 16 (static export) + React 19 + Tailwind CSS 4.
One portal, one sign-in page (`/login`) for everyone: **Mobile & OTP** (WhatsApp code) or **Email & password**. The
API works out who it is and what comes next (an admin's authenticator code, a forced password change after a
temporary password, or a choice when one number is registered twice). Forgot password: `/login/forgot`.

| Area | Pages |
| --- | --- |
| Patient | `/patient` (Overview), `/patient/records`, `/patient/profile` (details, consent, sign-in) |
| Hospital admin | `/admin/patients` (search, `new`, `view?id=`, `edit?id=`), `/admin/users`, `/admin/lab-partners`, `/admin/audit`, `/admin/account` |
| Hospital staff | `/staff/patients` (search, `new`, `view?id=`, `edit?id=`), `/staff/account` |
| Lab partner | `/partner/patients` (find a patient), `/partner/uploads` (My uploads), `/partner/account` |

Access: `GET /api/session` returns the person's type, its home, its nav (path, label, icon name) and its permissions
(from the API's role_permission table). The sidebar is drawn from the nav, every area's layout
(`src/lib/use-session.ts`) opens only pages under one of its paths, and buttons show only when the permission is
there (`can()` in `src/lib/session.ts`). The portal holds no list of types or pages. The API checks the permission
again on every request, so this is the map, not the lock. Admin and staff share the patient pages
(`src/components/patient-staff.tsx`, `patient-form.tsx`); `useAreaBase()` keeps their links inside the area.

Temporary passwords (Users, or a patient's "Signs in with") are shown once to whoever made them and must be changed
at the first sign-in before anything else opens.

Consent is asked inside the patient area for whichever patient is open (after sign-in, or on switching to a family
member), and can be given or withdrawn per person from Profile.

Navigation is a sidebar like a chat app's: on desktop it collapses to an icon rail (remembered on the device), on
phones and tablets it is a drawer from the menu button. Account, appearance and sign out sit at its bottom.

Branding is white-label: name, logos and colours come from the API (`/api/hospital`), which reads them from the
`hospital_config` row. Nothing hospital-specific is in this repo; changing the row changes the portal on its next
load, with no build. Logos are uploaded with `scripts/branding.ts` in patient360-api.

## Design system

- Style: minimal and accessible (healthcare), Figtree headings with Noto Sans body, self-hosted at build.
- Colours are semantic tokens in `src/app/globals.css` (`canvas`, `surface`, `subtle`, `ink`, `muted`, `brand`,
  `field-line`, `ok`/`warn`/`bad`…), defined for light and for dark. Components use token names only.
- Light, Dark or System: chosen from the account menu (or the sign-in page), kept in `localStorage` for the first paint
  and on the login (`PUT /api/session/preferences`, patient or staff) so it follows the person. An inline script in `<head>` sets
  `data-theme` before paint, so there is no white flash.
- Hospital colours are adjusted in the browser (`src/lib/color.ts`) so links, buttons and panel text always read
  at 4.5:1 in both themes, whatever is in the DB.
- `test/design.test.ts` checks every text/background token pair (4.5:1) and field borders (3:1) in both themes,
  512 sample hospital colours, the theme boot script, and the date helpers.

## Run locally

```bash
nvm use                 # Node 24
npm ci
cp .env.example .env.local   # set DOCUMENTS_ORIGIN and REPORTS_ORIGIN (the two buckets' S3 origins)
# start patient360-api on :3000 first (OTP_SENDER=console prints codes to its log)
npm run dev             # http://localhost:3001, proxies /api/* to API_ORIGIN
```

## Checks

`npm run check` runs the type check, the white-label check and the tests. The white-label check
(`scripts/check-white-label.mjs`, also run by `npm run build`) fails on anything hospital-specific in the code:
colours outside the theme tokens in `globals.css`, links, phone numbers, emails, hospital names, a fixed page title,
or files in `public/`.

## Security

- Branding from the API is checked again in the browser (`src/lib/branding.ts`): colours only `#RRGGBB`, logos only
  from `/api/hospital/logo/…`, links only `https://`. The same check runs on the copy cached in the browser.
- Document links must be `https://` before they are opened, and are opened with no referrer.
- `security-headers.mjs` holds the security headers (CSP, no framing, HSTS, …). `next dev` sends them now; the
  CloudFront response headers policy must send the same list at deploy, because a static site can't set headers.
  The CSP allows scripts only from the portal itself, documents only from `DOCUMENTS_ORIGIN` and `REPORTS_ORIGIN`,
  and uploads (lab partners' presigned POSTs) only to `REPORTS_ORIGIN`.

## Build

`npm run build` writes a static site to `out/`, served from S3 + CloudFront. CloudFront sends `/api/*` to the
API, so the session cookie is first-party and no token is ever handled in JavaScript.
