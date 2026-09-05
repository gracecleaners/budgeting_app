/**
 * API client for the new envelope format ({ success, data, message }) with a
 * per-user localStorage read cache for offline viewing (spec: offline reads).
 * Offline writes will come with the sync phase.
 */

const BASE = "/api";
const CACHE_KEY = "fin_offline_cache_v2";

export type ApiEnvelope<T> = { success: boolean; data: T; message: string | null };

export class ApiClientError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function cacheKey(): string {
  // isolate cache per logged-in user so data never leaks across accounts
  return `${CACHE_KEY}:${localStorage.getItem("fin_user_id") ?? "anon"}`;
}

export function setCacheUser(userId: number | null): void {
  if (userId === null) localStorage.removeItem("fin_user_id");
  else localStorage.setItem("fin_user_id", String(userId));
}

function readCache(path: string): unknown {
  try {
    const raw = localStorage.getItem(cacheKey());
    if (!raw) return null;
    const store: Record<string, { ts: number; data: unknown }> = JSON.parse(raw);
    return store[path]?.data ?? null;
  } catch {
    return null;
  }
}

function writeCache(path: string, data: unknown): void {
  try {
    const raw = localStorage.getItem(cacheKey());
    const store: Record<string, { ts: number; data: unknown }> = raw ? JSON.parse(raw) : {};
    store[path] = { ts: Date.now(), data };
    localStorage.setItem(cacheKey(), JSON.stringify(store));
  } catch {
    // storage full/corrupt: cache is best-effort
  }
}

export function clearCache(): void {
  try {
    localStorage.removeItem(cacheKey());
  } catch {
    // ignore
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
    });
    const json = (await res.json()) as ApiEnvelope<T>;
    if (!res.ok || !json.success) {
      throw new ApiClientError(res.status, json.message ?? `Request failed (${res.status})`);
    }
    if (method === "GET") writeCache(path, json);
    return json.data;
  } catch (err) {
    // offline fallback for GETs: serve last-seen data (read-only offline)
    if (err instanceof TypeError && method === "GET") {
      const cached = readCache(path);
      if (cached !== null) return (cached as ApiEnvelope<T>).data;
    }
    throw err;
  }
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

export function formatMoney(cents: number, currency = "UGX"): string {
  const abs = Math.abs(cents) / 100;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(abs);
  return `${currency} ${cents < 0 ? "-" : ""}${formatted}`;
}

export function formatDateKey(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
