// Thin client for the Patient 360 API. Same origin in dev (Next rewrite) and prod (CloudFront /api/*),
// so the httpOnly session cookie travels automatically and no token is ever handled in JavaScript.

import { SIGN_IN_PATH } from "./session";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly body: Record<string, unknown> = {},
  ) {
    super(code);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(0, "NETWORK");
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  // Signed out mid-visit (session expired, account or lab deactivated): straight to the sign-in page. Sign-in
  // calls and the session check itself handle their own 401s.
  if (res.status === 401 && !path.startsWith("/auth/") && path !== "/session" && typeof window !== "undefined") {
    window.location.replace(SIGN_IN_PATH);
  }
  if (!res.ok) throw new ApiError(res.status, (data?.error as string) ?? "UNKNOWN", data ?? {});
  return data as T;
}

/**
 * Sends a file straight to S3 with a presigned POST from the API (the API never handles the bytes). XHR rather than
 * fetch, for upload progress. Resolves true when S3 stored it; false when S3 refused it, the connection dropped or
 * the signal aborted it.
 */
export function postToS3(target: { url: string; fields: Record<string, string> }, file: File, onProgress: (fraction: number) => void, signal: AbortSignal) {
  return new Promise<boolean>((resolve) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(target.fields)) form.append(k, v);
    // S3 reads the policy fields first: the file must be the last part.
    form.append("file", file);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", target.url);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
    xhr.onerror = xhr.onabort = xhr.ontimeout = () => resolve(false);
    signal.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}

/** Downloads a file the API generates (a template): fetched with the session, saved under the name given. */
export async function downloadFile(path: string, filename: string) {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { credentials: "same-origin", cache: "no-store" });
  } catch {
    throw new ApiError(0, "NETWORK");
  }
  if (!res.ok) throw new ApiError(res.status, ((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "UNKNOWN");
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body ?? {}),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body ?? {}),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

// ─── Response shapes (mirror patient360-api) ─────────────────────────────────

export interface Hospital {
  name: string;
  shortName: string;
  portalTitle: string | null;
  logoUrl: string | null;
  logoLightUrl: string | null;
  primaryColor: string | null;
  primaryColorDark: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  loginHeadline: string | null;
  loginTagline: string | null;
  loginPoints: string[];
  termsUrl: string | null;
  privacyUrl: string | null;
  supportPhone: string | null;
  supportEmail: string | null;
}

export interface LinkedPatient {
  id: number;
  patientCode: string;
  fullName: string;
  relation: string;
  birthYear: number;
  /** False: opening this patient shows the consent notice first. */
  hasConsent: boolean;
}

export interface ConsentNotice {
  notice: { version: string; body: string };
  accepted: boolean;
}

export type ConsentStatus = "GIVEN" | "NOT_GIVEN" | "WITHDRAWN";

export interface Consents {
  noticeVersion: string | null;
  patients: { patientId: number; status: ConsentStatus; decidedAt: string | null }[];
}

export interface Me {
  mobile: string;
  patients: LinkedPatient[];
  activePatientId: number | null;
  consentRequired: boolean;
  theme: "system" | "light" | "dark";
}

export interface Profile {
  patientCode: string;
  fullName: string;
  dob: string;
  gender: string | null;
  bloodGroup: string | null;
  abhaNumber: string | null;
  mobile: string;
  email: string | null;
  address: string | null;
  emergencyContact: { name: string; phone: string | null } | null;
}

export interface DocumentType {
  id: number;
  code: string;
  label: string;
  /** One of DOC_ICONS in components/icons.tsx; anything else draws the file icon. */
  icon: string;
}

export interface PatientDocument {
  id: number;
  type: DocumentType;
  title: string;
  documentDate: string | null;
  uploadedAt: string;
  source: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  notes: string | null;
  canView: boolean;
  /** Not yet opened or downloaded from this login. */
  isNew: boolean;
}

// ─── Staff views (admins, hospital staff and lab partners) ───────────────────

export type DocumentStatus = "UPLOADING" | "AVAILABLE" | "FAILED";
export type ActiveStatus = "ACTIVE" | "DEACTIVATED";

export interface StaffSearchRow {
  id: number;
  patientCode: string;
  fullName: string;
  dob: string;
  gender: string | null;
  mobile: string;
  isTest: boolean;
  documentCount: number;
}

export interface SearchResult<T> {
  results: T[];
  /** The text was too short to search on. */
  tooShort: boolean;
}

export interface StaffDocument {
  id: number;
  type: { id: number; label: string; icon: string };
  title: string;
  documentDate: string | null;
  uploadedAt: string;
  source: string;
  uploadedBy: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  canView: boolean;
}

export interface PatientLogin {
  accountId: number;
  mobile: string;
  email: string | null;
  hasPassword: boolean;
  /** A temporary password not yet replaced by the person's own. */
  passwordMustChange: boolean;
  relation: string;
  linkedAt: string;
  lastLoginAt: string | null;
  consent: ConsentStatus;
  consentAt: string | null;
}

export interface StaffPatient {
  patient: Profile & { id: number; isTest: boolean; createdAt: string };
  logins: PatientLogin[];
  documents: StaffDocument[];
}

/** Shown once, to pass on: the person sets their own password at the first sign-in. */
export interface TemporaryPassword {
  password: string;
  email: string;
  expiresAt: string;
}

/** POST /patients and PUT /patients/:id: 409 when the details look like a record that already exists. */
export interface DuplicateMatch {
  id: number;
  patientCode: string;
  fullName: string;
  dob: string;
  mobile: string;
}

export interface PatientCreated {
  id: number;
  patientCode: string;
  login: { accountId: number; mobile: string; joinedExisting: boolean; temporaryPassword: TemporaryPassword | null; keptOwnPassword: boolean };
}

export interface LinkCreated {
  accountId: number;
  joinedExisting: boolean;
  temporaryPassword: TemporaryPassword | null;
  keptOwnPassword: boolean;
}

export type StaffRoleCode = "admin" | "staff" | "lab_partner";

export interface StaffUserRow {
  id: number;
  fullName: string;
  role: { code: StaffRoleCode; label: string };
  lab: { id: number; name: string } | null;
  mobile: string | null;
  email: string | null;
  status: ActiveStatus;
  lastLoginAt: string | null;
  hasPassword: boolean;
  passwordMustChange: boolean;
  passwordExpiresAt: string | null;
  /** Types that sign in with the authenticator app only. */
  authenticator: "ON" | "NOT_SET_UP" | null;
  isMe: boolean;
}

export interface UserOptions {
  roles: {
    code: StaffRoleCode;
    label: string;
    description: string | null;
    needsLab: boolean;
    needsAuthenticator: boolean;
    permissions: { code: string; label: string }[];
  }[];
  labs: { id: number; name: string }[];
}

export interface LabPartnerUser {
  id: number;
  fullName: string;
  mobile: string | null;
  email: string | null;
  status: ActiveStatus;
  lastLoginAt: string | null;
}

export interface LabPartner {
  id: number;
  name: string;
  status: ActiveStatus;
  createdAt: string;
  uploadCount: number;
  users: LabPartnerUser[];
}

export interface AuditItem {
  id: number;
  at: string;
  actorType: string;
  actor: string | null;
  action: string;
  patient: { id: number; patientCode: string; fullName: string } | null;
  documentId: number | null;
  details: Record<string, unknown> | null;
  ip: string | null;
}

export interface AuditPage {
  items: AuditItem[];
  nextBefore: number | null;
  actions: string[];
  actorTypes: string[];
}

export interface PartnerSearchRow {
  id: number;
  patientCode: string;
  fullName: string;
  /** Masked: +91XXXXXX1234. */
  mobile: string;
  dob: string;
  /** Lets this person upload for this patient for a while; only search results carry one. */
  uploadPass: string;
}

export interface PartnerUploads {
  items: {
    id: number;
    title: string;
    type: { label: string; icon: string };
    patient: { patientCode: string; fullName: string };
    documentDate: string | null;
    uploadedAt: string;
    uploadedBy: string;
    sizeBytes: number;
    status: DocumentStatus;
  }[];
  counts: Record<DocumentStatus, number>;
}

/** GET /api/partner/upload-options: what a lab may upload, from hospital_config. */
export interface UploadOptions {
  documentTypes: { id: number; label: string; icon: string }[];
  maxBytes: number;
  types: { mimeType: string; extensions: string[] }[];
}

/** POST /api/partner/uploads: the new document's id and where to send the file. */
export interface UploadTarget {
  id: number;
  upload: { url: string; fields: Record<string, string> };
  expiresInSeconds: number;
}

/** POST /api/partner/uploads/:id/complete: whether the file reached the patient's record, and why not. */
export interface UploadResult {
  status: DocumentStatus;
  reason?: "NOT_RECEIVED" | "SIZE_MISMATCH" | "TYPE_MISMATCH" | "NOT_THIS_FORMAT";
}

// ─── Imports (mirror patient360-api routes/imports.ts) ───────────────────────

export type ImportStatus = "UPLOADING" | "NEEDS_FIX" | "READY" | "IMPORTING" | "COMPLETED" | "COMPLETED_WITH_ISSUES" | "FAILED";

export interface ImportTypeRow {
  id: number;
  code: string;
  label: string;
  description: string;
  columns: { header: string; required: boolean; hint: string; example: string }[];
}

export interface ImportView {
  id: number;
  type: { code: string; label: string };
  label: string;
  status: ImportStatus;
  statusNote: string | null;
  sheet: { name: string; sizeBytes: number | null; uploadedAt: string | null; revision: number } | null;
  /** The sheet file is gone; the import's results are kept. */
  sheetDeleted: boolean;
  uploadPending: boolean;
  counts: { total: number; ready: number; errors: number; existing: number; created: number; skipped: number; failed: number };
  createdBy: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  /** What the import allows right now; decided by the API. */
  can: { run: boolean; replace: boolean; deleteSheet: boolean; delete: boolean; download: boolean };
}

/** One run of an import (GET /admin/imports/:id/logs). */
export interface ImportLogView {
  id: number;
  runNumber: number;
  status: "RUNNING" | "COMPLETED" | "COMPLETED_WITH_ISSUES" | "FAILED";
  note: string | null;
  startedBy: string;
  startedAt: string;
  finishedAt: string | null;
  counts: { total: number; created: number; skipped: number; failed: number };
  rollback: {
    /** AVAILABLE until `until` (24 hours after the run finished), then EXPIRED; DONE once rolled back. */
    state: "AVAILABLE" | "NOTHING" | "RUNNING" | "EXPIRED" | "DONE";
    until: string | null;
    rolledBackAt: string | null;
    rolledBackBy: string | null;
    removed: { patients: number; accounts: number; links: number } | null;
  };
}

export interface ImportIssue {
  id: number;
  phase: "CHECK" | "RUN";
  severity: "ERROR" | "SKIPPED";
  rowNumber: number;
  field: string | null;
  code: string;
  message: string;
}

export interface ImportIssuePage {
  total: number;
  pageSize: number;
  items: ImportIssue[];
}
