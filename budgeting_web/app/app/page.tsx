"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { api } from "@/lib/api";
import { formatMoney } from "@/lib/money";

type DashboardData = {
  totals: {
    total_balance_cents: number;
    income_cents: number;
    expenses_cents: number;
    cash_flow_cents: number;
  };
  accounts: { id: number; name: string; type: string; color: string; balance_cents: number }[];
  expenses_by_category: { categoryId: number; name: string; color: string; cents: number }[];
  cashflow_by_month: { month: string; income: number; expenses: number }[];
  meta: { currency: string };
};

const RANGES = [
  { value: "month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "3m", label: "3 months" },
  { value: "6m", label: "6 months" },
  { value: "year", label: "This year" },
  { value: "all", label: "All time" },
];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState("month");

  const load = useCallback(async (r: string) => {
    setLoading(true);
    setError(null);
    try {
      const json = await api.get<{ data: DashboardData }>(`/dashboard?range=${r}`);
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(range);
  }, [load, range]);

  if (loading && !data) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-200 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !data) {
    return <p className="text-rose-600 text-sm bg-rose-50 rounded-xl p-4">{error}</p>;
  }
  if (!data) return null;

  const cur = data.meta.currency;
  const maxCat = Math.max(1, ...data.expenses_by_category.map((c) => c.cents));
  const maxFlow = Math.max(1, ...data.cashflow_by_month.flatMap((m) => [m.income, m.expenses]));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Total balance {formatMoney(data.totals.total_balance_cents, cur)}
          </p>
        </div>
        <select
          aria-label="Date range"
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white"
        >
          {RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3" aria-label="Financial summary">
        <SummaryCard label="Income" cents={data.totals.income_cents} currency={cur} tone="text-emerald-600" />
        <SummaryCard label="Expenses" cents={data.totals.expenses_cents} currency={cur} tone="text-rose-600" />
        <SummaryCard
          label="Cash flow"
          cents={data.totals.cash_flow_cents}
          currency={cur}
          tone={data.totals.cash_flow_cents >= 0 ? "text-emerald-600" : "text-rose-600"}
        />
        <SummaryCard label="Balance" cents={data.totals.total_balance_cents} currency={cur} tone="text-slate-900" />
      </section>

      <section className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-4">Expenses by category</h2>
          {data.expenses_by_category.length === 0 ? (
            <p className="text-sm text-slate-500">
              No expenses in this period.{" "}
              <Link href="/app/transactions" className="text-emerald-600 hover:underline">
                Add one
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-3">
              {data.expenses_by_category.slice(0, 6).map((c) => (
                <li key={c.categoryId}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">{c.name}</span>
                    <span className="font-medium text-slate-800">{formatMoney(c.cents, cur)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${(c.cents / maxCat) * 100}%`, backgroundColor: c.color }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-800 mb-4">Cash flow by month</h2>
          {data.cashflow_by_month.length === 0 ? (
            <p className="text-sm text-slate-500">No data yet.</p>
          ) : (
            <div className="flex items-end gap-3 h-40" role="img" aria-label="Income vs expenses by month">
              {data.cashflow_by_month.map((m) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center gap-1 h-32">
                    <div
                      className="w-1/3 bg-emerald-500 rounded-t"
                      style={{ height: `${(m.income / maxFlow) * 100}%` }}
                      title={`Income ${formatMoney(m.income, cur)}`}
                    />
                    <div
                      className="w-1/3 bg-rose-400 rounded-t"
                      style={{ height: `${(m.expenses / maxFlow) * 100}%` }}
                      title={`Expenses ${formatMoney(m.expenses, cur)}`}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500">{m.month.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-4 mt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Income
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-400" /> Expenses
            </span>
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800">Accounts</h2>
          <Link href="/app/accounts" className="text-sm text-emerald-600 hover:underline">
            Manage
          </Link>
        </div>
        {data.accounts.length === 0 ? (
          <p className="text-sm text-slate-500">
            No accounts yet.{" "}
            <Link href="/app/accounts" className="text-emerald-600 hover:underline">
              Create your first account
            </Link>
            .
          </p>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-3">
            {data.accounts.map((a) => (
              <li key={a.id} className="flex items-center gap-3 border border-slate-100 rounded-xl p-3">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                <span className="text-sm text-slate-600 flex-1 truncate">{a.name}</span>
                <span className="text-sm font-semibold text-slate-800">
                  {formatMoney(a.balance_cents, cur)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  cents,
  currency,
  tone,
}: {
  label: string;
  cents: number;
  currency: string;
  tone: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <p className="text-xs text-slate-500 uppercase tracking-wide">{label}</p>
      <p className={`text-lg md:text-xl font-semibold mt-1 ${tone}`}>{formatMoney(cents, currency)}</p>
    </div>
  );
}
