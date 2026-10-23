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

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body ?? {}),
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
