import { getToken } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export function getApiUrl(): string {
  return API_URL.replace(/\/$/, "");
}

type ApiEnvelope<T> = {
  data?: T;
  error?: string;
};

async function parseEnvelope<T>(res: Response): Promise<T> {
  const body = (await res.json()) as ApiEnvelope<T>;
  if (!res.ok || body.error) {
    throw new Error(body.error ?? `API ${res.status}`);
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
