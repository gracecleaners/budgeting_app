"use client";

import { useCallback, useEffect, useState } from "react";

import { api, formatMoney, ApiClientError } from "@/lib/api";

type Budget = {
  id: number;
  name: string;
  categoryId: number | null;
  accountId: number | null;
  amountCents: number;
  period: string;
  startDate: string | null;
  endDate: string | null;
  spentCents: number;
  remainingCents: number;
  percent: number;
  status: "on_track" | "warning" | "almost_exceeded" | "exceeded";
  window: { from: string; to: string };
  alert: string | null;
};

type Category = { id: number; name: string; kind: string };
type Account = { id: number; name: string };

const STATUS_STYLES: Record<Budget["status"], { chip: string; bar: string; label: string }> = {
  on_track: { chip: "bg-emerald-100 text-emerald-700", bar: "#22c55e", label: "On track" },
  warning: { chip: "bg-amber-100 text-amber-700", bar: "#f59e0b", label: "Warning" },
  almost_exceeded: { chip: "bg-orange-100 text-orange-700", bar: "#f97316", label: "Almost exceeded" },
  exceeded: { chip: "bg-rose-100 text-rose-700", bar: "#ef4444", label: "Exceeded" },
};

export default function BudgetsPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currency, setCurrency] = useState("UGX");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Budget[]>("/budgets");
      setBudgets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load budgets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    (async () => {
      try {
        const [cats, accs] = await Promise.all([
          api.get<Category[]>("/categories"),
          api.get<Account[]>("/accounts"),
        ]);
        setCategories(cats.filter((c) => c.kind === "expense"));
        setAccounts(accs);
      } catch {
        // non-fatal
      }
      api.get<{ currency: string }>("/auth/me").then((u) => setCurrency(u.currency)).catch(() => {});
    })();
  }, [load]);

  async function remove(id: number) {
    if (!confirm("Delete this budget?")) return;
    try {
      await api.delete(`/budgets/${id}`);
      load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to delete");
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Budgets</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 transition shrink-0 min-h-11"
        >
          + Add
        </button>
      </header>

      {error && <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</p>}

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : budgets.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3" aria-hidden>
            📊
          </p>
          <p className="text-slate-600 font-medium">No budgets yet</p>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            Set a spending cap for a category, an account, or your overall budget.
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Create your first budget
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {budgets.map((b) => {
            const style = STATUS_STYLES[b.status];
            const over = b.percent > 100;
            return (
              <li key={b.id} className="bg-white rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 truncate">{b.name}</p>
                    <p className="text-xs text-slate-500 capitalize">
                      {b.period === "custom" && b.startDate && b.endDate
                        ? `${b.startDate} → ${b.endDate}`
                        : `${b.period} · this ${b.period === "weekly" ? "week" : "month"}`}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${style.chip}`}>
                    {style.label}
                  </span>
                </div>
                <div className="flex items-baseline justify-between mb-1 text-sm">
                  <span className="text-slate-600">
                    {formatMoney(b.spentCents, currency)}{" "}
                    <span className="text-slate-400">of {formatMoney(b.amountCents, currency)}</span>
                  </span>
                  <span className="font-medium text-slate-700">{Math.round(b.percent)}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, b.percent)}%`,
                      backgroundColor: style.bar,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className={`text-sm ${over ? "text-rose-600 font-medium" : "text-slate-600"}`}>
                    {over
                      ? `${formatMoney(-b.remainingCents, currency)} over`
                      : `${formatMoney(b.remainingCents, currency)} left`}
                  </span>
                  <span className="flex gap-1">
                    <button
                      onClick={() => setEditing(b)}
                      className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 min-h-11"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => remove(b.id)}
                      className="text-xs text-rose-500 hover:text-rose-700 px-3 py-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/30 min-h-11"
                    >
                      Delete
                    </button>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {(showAdd || editing) && (
        <BudgetModal
          budget={editing}
          categories={categories}
          accounts={accounts}
          onClose={() => {
            setShowAdd(false);
            setEditing(null);
          }}
          onSaved={() => {
            setShowAdd(false);
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function BudgetModal({
  budget,
  categories,
  accounts,
  onClose,
  onSaved,
}: {
  budget: Budget | null;
  categories: Category[];
  accounts: Account[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [scope, setScope] = useState<"overall" | "category" | "account">(
    budget ? (budget.categoryId ? "category" : budget.accountId ? "account" : "overall") : "category"
  );
  const [form, setForm] = useState({
    name: budget?.name ?? "",
    categoryId: budget?.categoryId ? String(budget.categoryId) : "",
    accountId: budget?.accountId ? String(budget.accountId) : "",
    amount: budget ? String(budget.amountCents / 100) : "",
    period: budget?.period ?? "monthly",
    startDate: budget?.startDate ?? "",
    endDate: budget?.endDate ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload: Record<string, unknown> = {
      amount: Number(form.amount),
      period: form.period,
    };
    if (scope === "category") payload.categoryId = Number(form.categoryId);
    if (scope === "account") payload.accountId = Number(form.accountId);
    if (scope === "overall" && form.name) payload.name = form.name;
    if (form.period === "custom") {
      payload.startDate = form.startDate;
      payload.endDate = form.endDate;
    }

    try {
      if (budget) {
        await api.patch(`/budgets/${budget.id}`, payload);
      } else {
        await api.post("/budgets", payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save budget");
      setBusy(false);
    }
  }

  const input =
    "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none";

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" role="dialog" aria-modal="true">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 shadow-xl max-h-[90dvh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">
          {budget ? "Edit budget" : "New budget"}
        </h2>
        <form onSubmit={submit} className="space-y-3">
          {error && <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</p>}

          {!budget && (
            <div className="grid grid-cols-3 gap-2">
              {(["category", "account", "overall"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={`py-2 rounded-lg text-sm font-medium capitalize ${
                    scope === s ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {scope === "category" && (
            <select
              required
              aria-label="Category"
              value={form.categoryId}
              onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
              className={input}
            >
              <option value="">Choose category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          {scope === "account" && (
            <select
              required
              aria-label="Account"
              value={form.accountId}
              onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}
              className={input}
            >
              <option value="">Choose account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
          {scope === "overall" && (
            <input
              placeholder="Budget name (e.g. Monthly spending cap)"
              aria-label="Budget name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className={input}
            />
          )}

          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            placeholder="Budget amount"
            aria-label="Budget amount"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            className={input}
          />

          {!budget && (
            <select
              aria-label="Period"
              value={form.period}
              onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
              className={input}
            >
              <option value="monthly">Monthly (repeats)</option>
              <option value="weekly">Weekly (repeats)</option>
              <option value="custom">Custom date range</option>
            </select>
          )}

          {form.period === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                required
                aria-label="Start date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                className={input}
              />
              <input
                type="date"
                required
                aria-label="End date"
                value={form.endDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                className={input}
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? "Saving..." : budget ? "Save changes" : "Create budget"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
