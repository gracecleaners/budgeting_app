"use client";

import { useEffect, useState, useCallback } from "react";
import {
  api,
  type Category,
  type Budget,
  type Transaction,
  type Summary,
} from "@/lib/api";

type OfflineStatus = "online" | "offline" | "checking";

export default function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [offline, setOffline] = useState<OfflineStatus>("checking");
  const [loading, setLoading] = useState(true);
  const [showAddTx, setShowAddTx] = useState(false);
  const [showAddBudget, setShowAddBudget] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [s, b, t, c] = await Promise.all([
        api.get<Summary>("/summary/"),
        api.get<Budget[]>("/budgets/"),
        api.get<Transaction[]>("/transactions/?ordering=-date"),
        api.get<Category[]>("/categories/"),
      ]);
      setSummary(s);
      setBudgets(b);
      setTransactions(t.slice(0, 20));
      setCategories(c);
    } catch (err) {
      console.error("Failed to load budgeting data", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30_000);
    const onlineHandler = () => {
      setOffline("online");
      fetchAll();
    };
    const offlineHandler = () => setOffline("offline");
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);
    setOffline(navigator.onLine ? "online" : "offline");
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline", offlineHandler);
    };
  }, [fetchAll]);

  const totalBudgeted = budgets.reduce((acc, b) => acc + b.progress.amount, 0);
  const totalSpent = budgets.reduce((acc, b) => acc + b.progress.spent, 0);
  const overallPercent = totalBudgeted > 0 ? Math.min(100, Math.round((totalSpent / totalBudgeted) * 100)) : 0;

  const formatMoney = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  return (
    <main className="flex-1 px-4 py-6 max-w-5xl mx-auto w-full">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Budget Tracker</h1>
          <p className="text-sm text-slate-500 mt-1">
            {summary ? `Tracked ${summary.months_tracked} month${summary.months_tracked === 1 ? "" : "s"}` : "Loading..."}
          </p>
        </div>
        <OfflineBadge status={offline} />
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-emerald-500" />
        </div>
      ) : summary ? (
        <>
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Financial Summary</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SummaryCard
                label="Total Income"
                value={summary.total_income}
                variant="income"
              />
              <SummaryCard
                label="Total Expenses"
                value={summary.total_expenses}
                variant="expense"
              />
              <SummaryCard
                label="Net"
                value={summary.net}
                variant={summary.net >= 0 ? "income" : "negative"}
              />
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Overall Progress</h2>
            <div className="bg-slate-50 rounded-2xl p-5">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-sm text-slate-600">Budgeted vs spent this period</span>
                <span className="text-sm font-medium text-slate-700">
                  {formatMoney(totalSpent)} of {formatMoney(totalBudgeted)}
                </span>
              </div>
              <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${overallPercent}%`,
                    backgroundColor: overallPercent > 90 ? "#ef4444" : overallPercent > 70 ? "#f59e0b" : "#22c55e",
                  }}
                />
              </div>
              <p className="text-sm text-slate-500 mt-2">
                {overallPercent}% of your budgeted amount spent
              </p>
            </div>
          </section>

          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Budgets</h2>
              <button
                className="text-sm bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition"
                onClick={() => setShowAddBudget(true)}
              >
                Add Budget
              </button>
            </div>
            {budgets.length === 0 ? (
              <p className="text-slate-500 text-sm">No budgets yet. Create one to start tracking.</p>
            ) : (
              <div className="space-y-3">
                {budgets.map((budget) => (
                  <BudgetCard key={budget.id} budget={budget} />
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">Recent Transactions</h2>
              <button
                className="text-sm bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition"
                onClick={() => setShowAddTx(true)}
              >
                Add Transaction
              </button>
            </div>
            {transactions.length === 0 ? (
              <p className="text-slate-500 text-sm">No transactions yet.</p>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                {transactions.map((tx) => (
                  <TransactionRow key={tx.id} tx={tx} />
                ))}
              </div>
            )}
          </section>
        </>
      ) : (
        <p className="text-slate-500">Failed to load data. Check your connection.</p>
      )}

      <AddTransactionModal
        open={showAddTx}
        categories={categories}
        onClose={() => setShowAddTx(false)}
        onAdd={async (tx) => {
          await api.post("/transactions/", tx);
          setShowAddTx(false);
          fetchAll();
        }}
      />

      <AddBudgetModal
        open={showAddBudget}
        categories={categories}
        onClose={() => setShowAddBudget(false)}
        onAdd={async (b) => {
          await api.post("/budgets/", b);
          setShowAddBudget(false);
          fetchAll();
        }}
      />
    </main>
  );
}

function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function OfflineBadge({ status }: { status: OfflineStatus }) {
  if (status === "online") return null;
  return (
    <span
      className={`text-xs px-3 py-1 rounded-full font-medium ${
        status === "offline" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
      }`}
    >
      {status === "offline" ? "Offline — using cached data" : "Reconnecting..."}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: "income" | "expense" | "negative";
}) {
  const color = variant === "income" ? "text-emerald-600" : variant === "negative" ? "text-rose-600" : "text-slate-800";
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-xl font-semibold mt-1 ${color}`}>{formatMoney(value)}</p>
    </div>
  );
}

function BudgetCard({ budget }: { budget: Budget }) {
  const { progress } = budget;
  const over = progress.percent > 100;
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ backgroundColor: budget.category.color }}
          />
          <span className="font-medium text-slate-800">{budget.category.name}</span>
        </div>
        <span className="text-xs text-slate-500 uppercase tracking-wide">{budget.period}</span>
      </div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm text-slate-600">{formatMoney(progress.spent)} spent</span>
        <span className="text-sm text-slate-600">of {formatMoney(progress.amount)}</span>
      </div>
      <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(100, progress.percent)}%`,
            backgroundColor: over ? "#ef4444" : progress.percent > 80 ? "#f59e0b" : "#22c55e",
          }}
        />
      </div>
      <div className="flex items-center justify-between mt-2 text-sm">
        <span className={over ? "text-rose-600 font-medium" : "text-slate-600"}>
          {over ? "Over budget" : `${formatMoney(progress.remaining)} remaining`}
        </span>
        <span className="font-medium text-slate-700">{progress.percent}% used</span>
      </div>
    </div>
  );
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const isExpense = tx.type === "expense";
  return (
    <div className="flex items-center justify-between p-4">
      <div className="flex items-center gap-3">
        <span
          className={`inline-block w-2.5 h-2.5 rounded-full ${isExpense ? "bg-rose-400" : "bg-emerald-400"}`}
        />
        <div>
          <p className="text-sm font-medium text-slate-800">{tx.category.name}</p>
          <p className="text-xs text-slate-500">
            {tx.note || tx.type} · {new Date(tx.date).toLocaleDateString()}
          </p>
        </div>
      </div>
      <span className={`text-sm font-semibold ${isExpense ? "text-slate-800" : "text-emerald-600"}`}>
        {isExpense ? "-" : "+"}{formatMoney(tx.amount)}
      </span>
    </div>
  );
}

type AddTxForm = {
  category_id: number;
  amount: string;
  type: "income" | "expense";
  date: string;
  note: string;
};

function AddTransactionModal({
  open,
  categories,
  onClose,
  onAdd,
}: {
  open: boolean;
  categories: Category[];
  onClose: () => void;
  onAdd: (tx: AddTxForm) => Promise<void>;
}) {
  const [form, setForm] = useState<AddTxForm>({
    category_id: categories[0]?.id ?? 0,
    amount: "",
    type: "expense",
    date: new Date().toISOString().split("T")[0],
    note: "",
  });
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onAdd(form);
      setForm({
        category_id: categories[0]?.id ?? 0,
        amount: "",
        type: "expense",
        date: new Date().toISOString().split("T")[0],
        note: "",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Add Transaction</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
            <div className="flex gap-2">
              {(["income", "expense"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                    form.type === t
                      ? t === "income"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-rose-100 text-rose-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                  onClick={() => setForm((f) => ({ ...f, type: t }))}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={form.amount}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              placeholder="0.00"
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <select
              required
              value={form.category_id}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              onChange={(e) => setForm((f) => ({ ...f, category_id: Number(e.target.value) }))}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
            <input
              type="date"
              required
              value={form.date}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Note (optional)</label>
            <input
              type="text"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              placeholder="Groceries"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {saving ? "Saving..." : "Add Transaction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type AddBudgetForm = {
  category_id: number;
  amount: string;
  period: string;
};

function AddBudgetModal({
  open,
  categories,
  onClose,
  onAdd,
}: {
  open: boolean;
  categories: Category[];
  onClose: () => void;
  onAdd: (b: AddBudgetForm) => Promise<void>;
}) {
  const [form, setForm] = useState<AddBudgetForm>({
    category_id: categories[0]?.id ?? 0,
    amount: "",
    period: "monthly",
  });
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onAdd(form);
      setForm({ category_id: categories[0]?.id ?? 0, amount: "", period: "monthly" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Add Budget</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
            <select
              required
              value={form.category_id}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              onChange={(e) => setForm((f) => ({ ...f, category_id: Number(e.target.value) }))}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Budget Amount</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={form.amount}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              placeholder="500.00"
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Period</label>
            <select
              required
              value={form.period}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {saving ? "Saving..." : "Add Budget"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
