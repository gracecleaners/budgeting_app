/**
 * API client for the { success, data, message } envelope.
 * - GETs fall back to a per-user localStorage cache when offline.
 * - Failed writes (POST/PATCH/DELETE) are queued in localStorage and
 *   flushed automatically when connectivity returns (offline sync).
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

import { enqueue, flushQueue, queueSize } from "./sync-queue";

function cacheKey(): string {
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
    // best-effort
  }
}

export function clearCache(): void {
  try {
    localStorage.removeItem(cacheKey());
  } catch {
    // ignore
  }
}

/** Human labels for queued writes (shown in the sync UI). */
function describeWrite(method: string, path: string, body: unknown): string {
  const b = (body ?? {}) as Record<string, unknown>;
  if (path.startsWith("/transactions") && method === "POST") {
    const amt = typeof b.amount === "number" ? b.amount : "?";
    return `${String(b.type ?? "transaction")} ${amt} — ${String(b.description ?? "")}`;
  }
  if (path.includes("/contributions")) return `Savings contribution ${String(b.amount ?? "")}`;
  if (path.includes("/payments")) return `Debt payment ${String(b.amount ?? "")}`;
  return `${method} ${path}`;
}

function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers:
        body !== undefined
          ? { "Content-Type": "application/json" }
          : undefined,
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
    // Offline GET fallback: serve cached data
    if (isNetworkError(err) && method === "GET") {
      const cached = readCache(path);
      if (cached !== null) return (cached as ApiEnvelope<T>).data;
    }
    // Offline write: queue it for later sync instead of failing
    if (isNetworkError(err) && (method === "POST" || method === "PATCH" || method === "DELETE")) {
      enqueue({ method: method as "POST", path: `${BASE}${path}`, body, description: describeWrite(method, path, body) });
      throw new OfflineQueuedError(describeWrite(method, path, body));
    }
    throw err;
  }
}

/** Thrown when a write was queued for sync instead of being applied now. */
export class OfflineQueuedError extends Error {
  constructor(label: string) {
    super(`Offline — "${label}" saved on this device and will sync automatically.`);
    this.name = "OfflineQueuedError";
  }
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

/** Flush pending offline writes; returns counts for UI display. */
export async function syncNow(): Promise<{ sent: number; failed: number; remaining: number }> {
  const { sent, failed } = await flushQueue();
  return { sent, failed, remaining: queueSize() };
}

export function pendingWrites(): number {
  return queueSize();
}

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

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
