"use client";

import { useCallback, useEffect, useState } from "react";

import { api, formatMoney, ApiClientError } from "@/lib/api";

type Goal = {
  id: number;
  name: string;
  targetCents: number;
  savedCents: number;
  targetDate: string | null;
  priority: string;
  percent: number;
  remainingCents: number;
  suggestedMonthlyCents: number | null;
  daysRemaining: number | null;
  status: "achieved" | "on_track" | "behind" | "no_date";
};

type Account = { id: number; name: string };

const STATUS_META: Record<Goal["status"], { chip: string; label: string; bar: string }> = {
  achieved: { chip: "bg-emerald-100 text-emerald-700", label: "Achieved 🎉", bar: "#22c55e" },
  on_track: { chip: "bg-sky-100 text-sky-700", label: "On track", bar: "#0ea5e9" },
  behind: { chip: "bg-amber-100 text-amber-700", label: "Behind schedule", bar: "#f59e0b" },
  no_date: { chip: "bg-slate-100 text-slate-600", label: "No target date", bar: "#64748b" },
};

export default function SavingsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currency, setCurrency] = useState("UGX");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [contribGoal, setContribGoal] = useState<Goal | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setGoals(await api.get<Goal[]>("/savings"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    api.get<Account[]>("/accounts").then(setAccounts).catch(() => {});
    api.get<{ currency: string }>("/auth/me").then((u) => setCurrency(u.currency)).catch(() => {});
  }, [load]);

  const totalSaved = goals.reduce((a, g) => a + g.savedCents, 0);
  const totalTarget = goals.reduce((a, g) => a + g.targetCents, 0);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Savings & Goals</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700"
        >
          + New goal
        </button>
      </header>

      {goals.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <p className="text-sm text-slate-500 dark:text-slate-400">Total saved</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {formatMoney(totalSaved, currency)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            of {formatMoney(totalTarget, currency)} across {goals.length} goal{goals.length === 1 ? "" : "s"}
          </p>
        </div>
      )}

      {error && <p className="text-sm text-rose-600 bg-rose-50 dark:bg-rose-900/30 rounded-lg px-3 py-2">{error}</p>}

      {loading ? (
        <div className="space-y-3" aria-busy="true">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-32 bg-slate-200 dark:bg-slate-700 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3" aria-hidden>🎯</p>
          <p className="text-slate-600 dark:text-slate-300 font-medium">No savings goals yet</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">
            Set a target for your emergency fund, school fees, or that laptop.
          </p>
          <button onClick={() => setShowAdd(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
            Create your first goal
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {goals.map((g) => {
            const meta = STATUS_META[g.status];
            return (
              <li key={g.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 dark:text-slate-100 truncate">{g.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {g.targetDate ? `Target ${g.targetDate}${g.daysRemaining !== null ? ` · ${g.daysRemaining} days left` : ""}` : "No target date"}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${meta.chip} dark:bg-opacity-20`}>
                    {meta.label}
                  </span>
                </div>
                <div className="flex items-baseline justify-between mb-1 text-sm">
                  <span className="text-slate-600 dark:text-slate-300">
                    {formatMoney(g.savedCents, currency)} <span className="text-slate-400">of {formatMoney(g.targetCents, currency)}</span>
                  </span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">{Math.round(g.percent)}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${g.percent}%`, backgroundColor: meta.bar }} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {g.status === "achieved"
                      ? "Goal reached!"
                      : g.suggestedMonthlyCents != null
                        ? `Save ${formatMoney(g.suggestedMonthlyCents, currency)}/mo to stay on schedule`
                        : `${formatMoney(g.remainingCents, currency)} to go`}
                  </span>
                  <button
                    onClick={() => setContribGoal(g)}
                    className="text-xs bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-3 py-1.5 rounded-lg font-medium"
                  >
                    Contribute / Withdraw
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {showAdd && (
        <GoalModal
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            load();
          }}
        />
      )}
      {contribGoal && (
        <ContributionModal
          goal={contribGoal}
          accounts={accounts}
          currency={currency}
          onClose={() => setContribGoal(null)}
          onSaved={() => {
            setContribGoal(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function GoalModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: "", targetAmount: "", targetDate: "", priority: "medium", description: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = "w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg px-3 py-2 text-sm";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/savings", {
        name: form.name,
        targetAmount: Number(form.targetAmount),
        targetDate: form.targetDate || null,
        priority: form.priority,
        description: form.description || undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to create goal");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-slate-800 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 shadow-xl max-h-[90dvh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">New savings goal</h2>
        <form onSubmit={submit} className="space-y-3">
          {error && <p className="text-sm text-rose-600 bg-rose-50 dark:bg-rose-900/30 rounded-lg px-3 py-2">{error}</p>}
          <input required placeholder="Goal name (e.g. Emergency Fund)" aria-label="Goal name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={input} />
          <input required type="number" step="0.01" min="0.01" placeholder="Target amount" aria-label="Target amount" value={form.targetAmount} onChange={(e) => setForm((f) => ({ ...f, targetAmount: e.target.value }))} className={input} />
          <input type="date" aria-label="Target date" value={form.targetDate} onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))} className={input} />
          <select aria-label="Priority" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} className={input}>
            <option value="low">Low priority</option>
            <option value="medium">Medium priority</option>
            <option value="high">High priority</option>
          </select>
          <input placeholder="Description (optional)" aria-label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className={input} />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
            <button type="submit" disabled={busy} className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">{busy ? "Creating..." : "Create goal"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ContributionModal({ goal, accounts, currency, onClose, onSaved }: { goal: Goal; accounts: Account[]; currency: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ amount: "", accountId: String(accounts[0]?.id ?? ""), date: new Date().toISOString().slice(0, 10), note: "", withdraw: false });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = "w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg px-3 py-2 text-sm";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const amt = Number(form.amount);
      await api.post(`/savings/${goal.id}/contributions`, {
        amount: form.withdraw ? -amt : amt,
        accountId: Number(form.accountId),
        date: form.date,
        note: form.note || undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to record");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" role="dialog" aria-modal="true">
      <div className="bg-white dark:bg-slate-800 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-1">{goal.name}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Saved {formatMoney(goal.savedCents, currency)} of {formatMoney(goal.targetCents, currency)}
        </p>
        <form onSubmit={submit} className="space-y-3">
          {error && <p className="text-sm text-rose-600 bg-rose-50 dark:bg-rose-900/30 rounded-lg px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setForm((f) => ({ ...f, withdraw: false }))} className={`py-2 rounded-lg text-sm font-medium ${!form.withdraw ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>Contribute</button>
            <button type="button" onClick={() => setForm((f) => ({ ...f, withdraw: true }))} className={`py-2 rounded-lg text-sm font-medium ${form.withdraw ? "bg-rose-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>Withdraw</button>
          </div>
          <input required type="number" step="0.01" min="0.01" placeholder="Amount" aria-label="Amount" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className={input} />
          <select required aria-label="Account" value={form.accountId} onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))} className={input}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <input required type="date" aria-label="Date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className={input} />
          <input placeholder="Note (optional)" aria-label="Note" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} className={input} />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Cancel</button>
            <button type="submit" disabled={busy} className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">{busy ? "Saving..." : "Record"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
