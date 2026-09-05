// The API now lives in this app's own /api routes (Netlify functions).
// Override only if you run the API somewhere else.
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

type ApiClient = {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  patch<T>(path: string, body: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
};

const localStorageKey = "budget_offline_cache";

function getCached(path: string): unknown {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(localStorageKey);
    if (!raw) return null;
    const store: Record<string, { ts: number; data: unknown }> = JSON.parse(raw);
    const entry = store[path];
    if (entry && Date.now() - entry.ts < 5 * 60 * 1000) {
      return entry.data;
    }
  } catch {
    // ignore corrupt storage
  }
  return null;
}

function setCached(path: string, data: unknown) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(localStorageKey);
    const store: Record<string, { ts: number; data: unknown }> = raw
      ? JSON.parse(raw)
      : {};
    store[path] = { ts: Date.now(), data };
    localStorage.setItem(localStorageKey, JSON.stringify(store));
  } catch {
    // ignore write failures
  }
}

function offlineFallback<T>(path: string, cached: unknown): T {
  if (cached === null) {
    throw new Error(`Offline: no cached data for ${path}`);
  }
  return cached as T;
}

async function fetchApi<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${BASE}${path}`;
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
  };
  if (body) {
    opts.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(url, opts);
    if (!res.ok) {
      throw new Error(`API error ${res.status}: ${res.statusText}`);
    }
    const data: T = await res.json();
    if (method === "GET") {
      setCached(path, data);
    }
    return data;
  } catch (err) {
    const cached = getCached(path);
    if (cached !== null) {
      return offlineFallback<T>(path, cached);
    }
    throw err;
  }
}

export const api: ApiClient = {
  get: (path) => fetchApi<any>("GET", path),
  post: (path, body) => fetchApi<any>("POST", path, body),
  patch: (path, body) => fetchApi<any>("PATCH", path, body),
  delete: (path) => fetchApi<any>("DELETE", path),
};

export type Category = {
  id: number;
  name: string;
  color: string;
  created_at: string;
  spent: number;
};

export type Budget = {
  id: number;
  category: Category;
  category_id: number;
  amount: number;
  period: string;
  created_at: string;
  updated_at: string;
  progress: {
    amount: number;
    spent: number;
    remaining: number;
    percent: number;
  };
};

export type Transaction = {
  id: number;
  category: Category;
  category_id: number;
  amount: number;
  type: "income" | "expense";
  date: string;
  note: string;
  created_at: string;
};

export type Summary = {
  total_income: number;
  total_expenses: number;
  net: number;
  months_tracked: number;
  average_monthly_expense: number;
};
