// Thin client for the Patient 360 API. Same origin in dev (Next rewrite) and prod (CloudFront /api/*),
// so the httpOnly session cookie travels automatically and no token is ever handled in JavaScript.

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
  if (!res.ok) throw new ApiError(res.status, (data?.error as string) ?? "UNKNOWN", data ?? {});
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body ?? {}),
};

// ─── Response shapes (mirror patient360-api) ─────────────────────────────────

export interface Hospital {
  name: string;
  shortName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  supportPhone: string | null;
  supportEmail: string | null;
}

export interface LinkedPatient {
  id: number;
  patientCode: string;
  fullName: string;
  relation: string;
  birthYear: number;
}

export interface Me {
  mobile: string;
  patients: LinkedPatient[];
  activePatientId: number | null;
  consentRequired: boolean;
}

export interface Profile {
  patientCode: string;
  fullName: string;
  dob: string;
  gender: string | null;
  mobile: string;
  email: string | null;
  address: string | null;
}

export interface DocumentType {
  id: number;
  code: string;
  label: string;
}

export interface PatientDocument {
  id: number;
  type: DocumentType;
  documentDate: string | null;
  uploadedAt: string;
  source: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  notes: string | null;
  canView: boolean;
}
