import { getToken } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export function getApiUrl(): string {
  return API_URL.replace(/\/$/, "");
}

type ApiEnvelope<T> = {
  data?: T;
  error?: string;
  code?: string;
  details?: unknown;
};

/** Error thrown for any non-2xx API response. `details` is optional structured data. */
export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** One short line from a 409 `insufficient_stock` response. */
export type ShortageDetail = {
  item_id: string;
  sku: string;
  name: string;
  unit: string;
  dibutuhkan: number | string;
  tersedia: number | string;
  kurang: number | string;
};

export function shortageDetails(err: unknown): ShortageDetail[] | null {
  if (err instanceof ApiError && err.code === "insufficient_stock" && Array.isArray(err.details)) {
    return err.details as ShortageDetail[];
  }
  return null;
}

async function parseEnvelope<T>(res: Response): Promise<T> {
  let body: ApiEnvelope<T> = {};
  try {
    body = (await res.json()) as ApiEnvelope<T>;
  } catch {
    // non-JSON body; fall through with status only
  }
  if (!res.ok || body.error) {
    throw new ApiError(body.error ?? `API ${res.status}`, res.status, body.code, body.details);
  }
  return body.data as T;
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${getApiUrl()}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  return parseEnvelope<T>(res);
}

export async function apiPost<T>(
  path: string,
  payload: unknown,
  init?: RequestInit,
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${getApiUrl()}${path}`, {
    method: "POST",
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  return parseEnvelope<T>(res);
}

export async function apiPut<T>(
  path: string,
  payload: unknown,
  init?: RequestInit,
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${getApiUrl()}${path}`, {
    method: "PUT",
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  return parseEnvelope<T>(res);
}

export async function apiPatch<T>(
  path: string,
  payload: unknown,
  init?: RequestInit,
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${getApiUrl()}${path}`, {
    method: "PATCH",
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  return parseEnvelope<T>(res);
}
