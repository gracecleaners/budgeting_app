"use client";

import { useCallback, useEffect, useState } from "react";

import { api, formatMoney, formatDateKey, ApiClientError } from "@/lib/api";

type Subscription = {
  id: number;
  name: string;
  amountCents: number;
  cycle: string;
  nextPaymentDate: string;
  status: string;
  monthlyCostCents: number;
};

type Recurring = {
  id: number;
  template: { type?: string; amount?: number; description?: string };
  frequency: string;
  nextDate: string;
  active: boolean;
};

type Account = { id: number; name: string };
type Category = { id: number; name: string; kind: string };

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [totals, setTotals] = useState<{ monthly_cost_cents: number; annual_cost_cents: number; due_this_week: number } | null>(null);
  const [recurring, setRecurring] = useState<Recurring[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currency, setCurrency] = useState("UGX");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ items: Subscription[]; totals: typeof totals }>("/subscriptions");
      setSubs(data.items);
      setTotals(data.totals);
      setRecurring(await api.get<Recurring[]>("/recurring"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    api.get<Account[]>("/accounts").then(setAccounts).catch(() => {});
    api.get<Category[]>("/categories").then(setCategories).catch(() => {});
    api.get<{ currency: string }>("/auth/me").then((u) => setCurrency(u.currency)).catch(() => {});
  }, [load]);

  async function toggleStatus(s: Subscription) {
    const next = s.status === "active" ? "paused" : "active";
    await api.patch("/subscriptions", { id: s.id, status: next });
    load();
  }

  async function stopRecurring(r: Recurring) {
    if (!confirm(`Stop the recurring "${r.template.description ?? "transaction"}"?`)) return;
    await api.delete(`/recurring?id=${r.id}`);
    load();
  }

  async function runDue() {
    const res = await fetch("/api/recurring", { method: "PUT" });
    const json = await res.json();
    if (json.success) {
      alert(json.message);
      load();
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Subscriptions</h1>
        <button onClick={() => setShowAdd(true)} className="bg-emerald-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 shrink-0 min-h-11">
          + Add
        </button>
      </header>

      {totals && subs.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase">Monthly</p>
            <p className="text-base font-bold text-slate-800 dark:text-slate-100 mt-1">{formatMoney(totals.monthly_cost_cents, currency)}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase">Annual</p>
            <p className="text-base font-bold text-slate-800 dark:text-slate-100 mt-1">{formatMoney(totals.annual_cost_cents, currency)}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase">Due 7 days</p>
            <p className="text-base font-bold text-amber-600 dark:text-amber-400 mt-1">{totals.due_this_week}</p>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-rose-600 bg-rose-50 dark:bg-rose-900/30 rounded-lg px-3 py-2">{error}</p>}

      {loading ? (
        <div className="space-y-2" aria-busy="true">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />)}
        </div>
      ) : subs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-4xl mb-3" aria-hidden>📺</p>
          <p className="text-slate-600 dark:text-slate-300 font-medium">No subscriptions tracked</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">Netflix, Spotify, internet — track what recurs on your money.</p>
          <button onClick={() => setShowAdd(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Add subscription</button>
        </div>
      ) : (
        <ul className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
          {subs.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{s.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDateKey(s.nextPaymentDate)} · {s.cycle}
                  {s.nextPaymentDate >= today && s.nextPaymentDate <= new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10) ? " · due soon ⏰" : ""}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{formatMoney(s.amountCents, currency)}</p>
                <button onClick={() => toggleStatus(s)} className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                  {s.status === "active" ? "Pause" : "Resume"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100">Recurring transactions</h2>
          <button onClick={runDue} className="text-xs border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700">
            Run due now
          </button>
        </div>
        {recurring.filter((r) => r.active).length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No recurring rules yet. Salary, rent, and bills can auto-generate — coming to the Add form soon; use the API in the meantime.
          </p>
        ) : (
          <ul className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
            {recurring.filter((r) => r.active).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{r.template.description ?? r.template.type}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{r.frequency} · next {formatDateKey(r.nextDate)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{formatMoney(Math.round((r.template.amount ?? 0) * 100), currency)}</p>
                  <button onClick={() => stopRecurring(r)} className="text-xs text-rose-400 hover:text-rose-600">Stop</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {showAdd && (
        <AddSubModal
          accounts={accounts}
          categories={categories}
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function AddSubModal({ accounts, categories, onClose, onSaved }: { accounts: Account[]; categories: Category[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: "", amount: "", cycle: "monthly", nextPaymentDate: new Date().toISOString().slice(0, 10), accountId: "", categoryId: "", makeRecurring: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = "w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg px-3 py-2 text-sm";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/subscriptions", {
        name: form.name,
        amount: Number(form.amount),
        cycle: form.cycle,
        nextPaymentDate: form.nextPaymentDate,
        accountId: form.accountId ? Number(form.accountId) : undefined,
        categoryId: form.categoryId ? Number(form.categoryId) : undefined,
      });
      if (form.makeRecurring && form.accountId) {
        await api.post("/recurring", {
          template: {
            type: "expense",
            amount: Number(form.amount),
            fromAccountId: Number(form.accountId),
            categoryId: form.categoryId ? Number(form.categoryId) : undefined,
            description: form.name,
          },
          frequency: form.cycle === "yearly" ? "yearly" : form.cycle === "quarterly" ? "quarterly" : form.cycle === "weekly" ? "weekly" : "monthly",
          nextDate: form.nextPaymentDate,
        });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-slate-800 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 shadow-xl max-h-[90dvh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Add subscription</h2>
        <form onSubmit={submit} className="space-y-3">
          {error && <p className="text-sm text-rose-600 bg-rose-50 dark:bg-rose-900/30 rounded-lg px-3 py-2">{error}</p>}
          <input required placeholder="Name (e.g. Netflix)" aria-label="Subscription name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={input} />
          <div className="grid grid-cols-2 gap-2">
            <input required type="number" step="0.01" min="0.01" placeholder="Amount" aria-label="Amount" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className={input} />
            <select aria-label="Billing cycle" value={form.cycle} onChange={(e) => setForm((f) => ({ ...f, cycle: e.target.value }))} className={input}>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <input required type="date" aria-label="Next payment date" value={form.nextPaymentDate} onChange={(e) => setForm((f) => ({ ...f, nextPaymentDate: e.target.value }))} className={input} />
          <select aria-label="Account" value={form.accountId} onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))} className={input}>
            <option value="">Paying account (optional)</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select aria-label="Category" value={form.categoryId} onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))} className={input}>
            <option value="">Category (optional)</option>
            {categories.filter((c) => c.kind === "expense").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {form.accountId && (
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={form.makeRecurring} onChange={(e) => setForm((f) => ({ ...f, makeRecurring: e.target.checked }))} />
              Also auto-generate this payment each cycle
            </label>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
            <button type="submit" disabled={busy} className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">{busy ? "Saving..." : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
