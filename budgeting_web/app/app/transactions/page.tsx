"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { api, formatMoney, formatDateKey, ApiClientError } from "@/lib/api";

type Tx = {
  id: number;
  type: string;
  amountCents: number;
  date: string;
  description: string;
  categoryId: number | null;
  category?: { name: string; color: string } | null;
  fromAccountId: number | null;
  toAccountId: number | null;
};

type TxList = { items: Tx[]; total: number; page: number; pageSize: number };

type Category = { id: number; name: string; kind: string };
type Account = { id: number; name: string };

const TYPE_STYLES: Record<string, string> = {
  income: "bg-emerald-100 text-emerald-700",
  expense: "bg-rose-100 text-rose-700",
  transfer: "bg-sky-100 text-sky-700",
  savings: "bg-violet-100 text-violet-700",
  debt_payment: "bg-amber-100 text-amber-700",
  investment: "bg-indigo-100 text-indigo-700",
};

export default function TransactionsPage() {
  const [list, setList] = useState<TxList | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currency, setCurrency] = useState("UGX");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const searchParams = useSearchParams();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (type) params.set("type", type);
      if (q) params.set("q", q);
      params.set("page", String(page));
      const data = await api.get<TxList>(`/transactions?${params}`);
      setList(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [page, type, q]);

  useEffect(() => {
    load();
    // support the quick-add FAB: /app/transactions?add=1 opens the modal
    if (searchParams.get("add") === "1") setShowAdd(true);
  }, [load, searchParams]);

  useEffect(() => {
    (async () => {
      try {
        const [cats, accs] = await Promise.all([
          api.get<Category[]>("/categories"),
          api.get<Account[]>("/accounts"),
        ]);
        setCategories(cats);
        setAccounts(accs);
      } catch {
        // non-fatal
      }
    })();
    api.get<{ currency: string }>("/auth/me").then((u) => setCurrency(u.currency)).catch(() => {});
  }, []);

  const totalPages = list ? Math.max(1, Math.ceil(list.total / list.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Transactions</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition"
        >
          + Add
        </button>
      </header>

      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Search description, merchant..."
          aria-label="Search transactions"
          className="flex-1 min-w-40 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg px-3 py-2 text-sm"
        />
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
          aria-label="Filter by type"
          className="border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">All types</option>
          {["income", "expense", "transfer", "savings", "debt_payment", "investment"].map((t) => (
            <option key={t} value={t}>
              {t.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</p>}

      {loading && !list ? (
        <div className="space-y-2" aria-busy="true">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !list || list.items.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3" aria-hidden>
            🧾
          </p>
          <p className="text-slate-600 font-medium">No transactions yet</p>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            Start tracking your money by adding your first transaction.
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Add Transaction
          </button>
        </div>
      ) : (
        <>
          <ul className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
            {list.items.map((tx) => (
              <li key={tx.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase ${
                        TYPE_STYLES[tx.type] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {tx.type.replace("_", " ")}
                    </span>
                    {tx.category && (
                      <span className="text-xs text-slate-500">{tx.category.name}</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-700 mt-1 truncate">
                    {tx.description || tx.type.replace("_", " ")}
                  </p>
                  <p className="text-xs text-slate-400">{formatDateKey(tx.date)}</p>
                </div>
                <span
                  className={`text-sm font-semibold shrink-0 ${
                    tx.type === "income" ? "text-emerald-600" : "text-slate-800"
                  }`}
                >
                  {tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}
                  {formatMoney(tx.amountCents, currency)}
                </span>
              </li>
            ))}
          </ul>
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-2 rounded-lg border border-slate-300 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-slate-500">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-2 rounded-lg border border-slate-300 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {showAdd && (
        <AddTxModal
          categories={categories}
          accounts={accounts}
          onClose={() => setShowAdd(false)}
          onAdded={() => {
            setShowAdd(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function AddTxModal({
  categories,
  accounts,
  onClose,
  onAdded,
}: {
  categories: Category[];
  accounts: Account[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const [type, setType] = useState<"income" | "expense" | "transfer">("expense");
  const [form, setForm] = useState({
    amount: "",
    categoryId: "",
    fromAccountId: "",
    toAccountId: "",
    date: new Date().toISOString().slice(0, 10),
    description: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const incomeCats = categories.filter((c) => c.kind === "income");
  const expenseCats = categories.filter((c) => c.kind === "expense");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload: Record<string, unknown> = {
      type,
      amount: Number(form.amount),
      date: form.date,
      description: form.description,
    };
    if (type === "income") payload.toAccountId = Number(form.toAccountId);
    if (type === "expense") payload.fromAccountId = Number(form.fromAccountId);
    if (type === "transfer") {
      payload.fromAccountId = Number(form.fromAccountId);
      payload.toAccountId = Number(form.toAccountId);
    }
    const cat = Number(form.categoryId);
    if (cat) payload.categoryId = cat;

    try {
      await api.post("/transactions", payload);
      onAdded();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save");
      setBusy(false);
    }
  }

  const input =
    "w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none";

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-slate-800 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 shadow-xl max-h-[90dvh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Add transaction</h2>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {(["expense", "income", "transfer"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`py-2 rounded-lg text-sm font-medium capitalize ${
                type === t ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <form onSubmit={submit} className="space-y-3">
          {error && <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</p>}
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            placeholder="Amount"
            aria-label="Amount"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            className={input}
          />
          {type === "expense" && (
            <select
              required
              aria-label="From account"
              value={form.fromAccountId}
              onChange={(e) => setForm((f) => ({ ...f, fromAccountId: e.target.value }))}
              className={input}
            >
              <option value="">From account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
          {type === "income" && (
            <select
              required
              aria-label="To account"
              value={form.toAccountId}
              onChange={(e) => setForm((f) => ({ ...f, toAccountId: e.target.value }))}
              className={input}
            >
              <option value="">To account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
          {type === "transfer" && (
            <>
              <select
                required
                aria-label="From account"
                value={form.fromAccountId}
                onChange={(e) => setForm((f) => ({ ...f, fromAccountId: e.target.value }))}
                className={input}
              >
                <option value="">From account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <select
                required
                aria-label="To account"
                value={form.toAccountId}
                onChange={(e) => setForm((f) => ({ ...f, toAccountId: e.target.value }))}
                className={input}
              >
                <option value="">To account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </>
          )}
          {type !== "transfer" && (
            <select
              aria-label="Category"
              value={form.categoryId}
              onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
              className={input}
            >
              <option value="">Category (optional)</option>
              {(type === "income" ? incomeCats : expenseCats).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <input
            type="date"
            required
            aria-label="Date"
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            className={input}
          />
          <input
            placeholder="Description (optional)"
            aria-label="Description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className={input}
          />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
