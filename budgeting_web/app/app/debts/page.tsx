"use client";

import { useCallback, useEffect, useState } from "react";

import { api, formatMoney, ApiClientError } from "@/lib/api";

type Debt = {
  id: number;
  name: string;
  direction: "owed_by_me" | "owed_to_me";
  originalCents: number;
  remainingCents: number;
  paidCents: number;
  progressPercent: number;
  interestRate: string | null;
  dueDate: string | null;
  minimumCents: number | null;
  lender: string | null;
  paymentFrequency: string;
};

type Account = { id: number; name: string };

export default function DebtsPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currency, setCurrency] = useState("UGX");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [payDebt, setPayDebt] = useState<Debt | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDebts(await api.get<Debt[]>("/debts"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    api.get<Account[]>("/accounts").then(setAccounts).catch(() => {});
    api.get<{ currency: string }>("/auth/me").then((u) => setCurrency(u.currency)).catch(() => {});
  }, [load]);

  const iOwe = debts.filter((d) => d.direction === "owed_by_me").reduce((a, d) => a + d.remainingCents, 0);
  const owedToMe = debts.filter((d) => d.direction === "owed_to_me").reduce((a, d) => a + d.remainingCents, 0);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Debts</h1>
        <button onClick={() => setShowAdd(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">
          + Add debt
        </button>
      </header>

      {debts.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">I owe</p>
            <p className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-1">{formatMoney(iOwe, currency)}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">Owed to me</p>
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">{formatMoney(owedToMe, currency)}</p>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-rose-600 bg-rose-50 dark:bg-rose-900/30 rounded-lg px-3 py-2">{error}</p>}

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {[...Array(2)].map((_, i) => <div key={i} className="h-28 bg-slate-200 dark:bg-slate-700 rounded-2xl animate-pulse" />)}
        </div>
      ) : debts.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3" aria-hidden>💸</p>
          <p className="text-slate-600 dark:text-slate-300 font-medium">No debts tracked</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">Track loans, credit, and money you've lent to others.</p>
          <button onClick={() => setShowAdd(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium">Add your first debt</button>
        </div>
      ) : (
        <ul className="space-y-3">
          {debts.map((d) => (
            <li key={d.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 dark:text-slate-100 truncate">{d.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {d.direction === "owed_by_me" ? "You owe" : "Owed to you"}
                    {d.lender ? ` · ${d.lender}` : ""}
                    {d.interestRate ? ` · ${d.interestRate}%` : ""}
                    {d.dueDate ? ` · due ${d.dueDate}` : ""}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${d.direction === "owed_by_me" ? "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300" : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"}`}>
                  {d.progressPercent}% paid
                </span>
              </div>
              <div className="flex items-baseline justify-between mb-1 text-sm">
                <span className="text-slate-600 dark:text-slate-300">
                  {formatMoney(d.originalCents - d.remainingCents, currency)} <span className="text-slate-400">paid of {formatMoney(d.originalCents, currency)}</span>
                </span>
                <span className="font-medium text-slate-700 dark:text-slate-200">{formatMoney(d.remainingCents, currency)} left</span>
              </div>
              <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, d.progressPercent)}%` }} />
              </div>
              {d.direction === "owed_by_me" && d.remainingCents > 0 && (
                <div className="flex justify-end mt-2">
                  <button onClick={() => setPayDebt(d)} className="text-xs bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-3 py-1.5 rounded-lg font-medium">
                    Record payment
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {showAdd && (
        <DebtModal
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            load();
          }}
        />
      )}
      {payDebt && (
        <PaymentModal
          debt={payDebt}
          accounts={accounts}
          currency={currency}
          onClose={() => setPayDebt(null)}
          onSaved={() => {
            setPayDebt(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function DebtModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: "", direction: "owed_by_me", originalAmount: "", remainingAmount: "", interestRate: "", dueDate: "", lender: "", minimumPayment: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = "w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg px-3 py-2 text-sm";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/debts", {
        name: form.name,
        direction: form.direction,
        originalAmount: Number(form.originalAmount),
        remainingAmount: form.remainingAmount ? Number(form.remainingAmount) : undefined,
        interestRate: form.interestRate ? Number(form.interestRate) : null,
        dueDate: form.dueDate || null,
        lender: form.lender || null,
        minimumPayment: form.minimumPayment ? Number(form.minimumPayment) : null,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create debt");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-slate-800 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 shadow-xl max-h-[90dvh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Add debt</h2>
        <form onSubmit={submit} className="space-y-3">
          {error && <p className="text-sm text-rose-600 bg-rose-50 dark:bg-rose-900/30 rounded-lg px-3 py-2">{error}</p>}
          <input required placeholder="Debt name (e.g. Car Loan)" aria-label="Debt name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={input} />
          <select aria-label="Direction" value={form.direction} onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value }))} className={input}>
            <option value="owed_by_me">I owe this money</option>
            <option value="owed_to_me">This money is owed to me</option>
          </select>
          <input required type="number" step="0.01" min="0.01" placeholder="Original amount" aria-label="Original amount" value={form.originalAmount} onChange={(e) => setForm((f) => ({ ...f, originalAmount: e.target.value }))} className={input} />
          <input type="number" step="0.01" min="0" placeholder="Remaining amount (defaults to original)" aria-label="Remaining amount" value={form.remainingAmount} onChange={(e) => setForm((f) => ({ ...f, remainingAmount: e.target.value }))} className={input} />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" step="0.01" min="0" max="100" placeholder="Interest %" aria-label="Interest rate" value={form.interestRate} onChange={(e) => setForm((f) => ({ ...f, interestRate: e.target.value }))} className={input} />
            <input type="date" aria-label="Due date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} className={input} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Lender" aria-label="Lender" value={form.lender} onChange={(e) => setForm((f) => ({ ...f, lender: e.target.value }))} className={input} />
            <input type="number" step="0.01" min="0" placeholder="Min payment" aria-label="Minimum payment" value={form.minimumPayment} onChange={(e) => setForm((f) => ({ ...f, minimumPayment: e.target.value }))} className={input} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
            <button type="submit" disabled={busy} className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">{busy ? "Saving..." : "Add debt"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PaymentModal({ debt, accounts, currency, onClose, onSaved }: { debt: Debt; accounts: Account[]; currency: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ amount: debt.minimumCents ? String(debt.minimumCents / 100) : "", accountId: String(accounts[0]?.id ?? ""), date: new Date().toISOString().slice(0, 10), note: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = "w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg px-3 py-2 text-sm";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post(`/debts/${debt.id}/payments`, {
        amount: Number(form.amount),
        accountId: Number(form.accountId),
        date: form.date,
        note: form.note || undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to record payment");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-slate-800 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1">Payment: {debt.name}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Remaining {formatMoney(debt.remainingCents, currency)}</p>
        <form onSubmit={submit} className="space-y-3">
          {error && <p className="text-sm text-rose-600 bg-rose-50 dark:bg-rose-900/30 rounded-lg px-3 py-2">{error}</p>}
          <input required type="number" step="0.01" min="0.01" placeholder="Amount" aria-label="Amount" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className={input} />
          <select required aria-label="Account" value={form.accountId} onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))} className={input}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <input required type="date" aria-label="Date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className={input} />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
            <button type="submit" disabled={busy} className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">{busy ? "Recording..." : "Record payment"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
