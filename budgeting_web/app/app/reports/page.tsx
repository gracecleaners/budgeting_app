"use client";

import { useCallback, useEffect, useState } from "react";

import { api, formatMoney } from "@/lib/api";

type Analytics = {
  spending: {
    total_cents: number;
    average_daily_cents: number;
    by_category: { categoryId: number; name: string; color: string; cents: number }[];
    top_category: { name: string; cents: number } | null;
  };
  income: { total_cents: number; change_pct: number | null };
  savings: { rate_pct: number; total_cents: number; change_pct: number | null };
  cashflow: { series: { month: string; income: number; expenses: number; net: number }[]; change_pct: number | null };
  net_worth: { assets_cents: number; liabilities_cents: number; net_cents: number; debt_to_income_pct: number };
  health: { score: number; label: string; factors: { name: string; points: number; max: number; note: string }[]; disclaimer: string };
  insights: string[];
};

const RANGES = [
  { value: "3m", label: "3 months" },
  { value: "6m", label: "6 months" },
  { value: "year", label: "This year" },
  { value: "all", label: "All time" },
];

export default function ReportsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [currency, setCurrency] = useState("UGX");
  const [range, setRange] = useState("6m");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (r: string) => {
    setLoading(true);
    try {
      setData(await api.get<Analytics>(`/analytics?range=${r}`));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(range);
    api.get<{ currency: string }>("/auth/me").then((u) => setCurrency(u.currency)).catch(() => {});
  }, [load, range]);

  async function exportCsv() {
    const params = new URLSearchParams({ range });
    const res = await fetch(`/api/transactions?${params}&page_size=100`);
    const json = await res.json();
    if (!json.success) return;
    const rows: Record<string, unknown>[] = json.data.items;
    const header = ["date", "type", "amount", "category", "description"];
    const lines = [header.join(",")];
    for (const r of rows) {
      const cat = (r.category as { name?: string } | null)?.name ?? "";
      lines.push(
        [r.date, r.type, ((r.amountCents as number) / 100).toFixed(2), cat, JSON.stringify(r.description ?? "")].join(",")
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading && !data) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-40 bg-slate-200 dark:bg-slate-700 rounded-2xl animate-pulse" />
        <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-2xl animate-pulse" />
      </div>
    );
  }
  if (!data) return <p className="text-slate-500">Failed to load analytics.</p>;

  const cur = currency;
  const maxNet = Math.max(1, ...data.cashflow.series.map((m) => Math.abs(m.net)));

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Reports & Analytics</h1>
        <div className="flex gap-2">
          <select aria-label="Range" value={range} onChange={(e) => setRange(e.target.value)} className="text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg px-3 py-2 bg-white dark:bg-slate-800">
            {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <button onClick={exportCsv} className="text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-slate-200">
            Export CSV
          </button>
        </div>
      </header>

      {/* Health score */}
      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20 shrink-0" role="img" aria-label={`Financial health ${data.health.score} of 100`}>
            <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3.5" className="dark:opacity-20" />
              <circle
                cx="18" cy="18" r="15.9" fill="none"
                stroke={data.health.score >= 60 ? "#22c55e" : data.health.score >= 40 ? "#f59e0b" : "#ef4444"}
                strokeWidth="3.5"
                strokeDasharray={`${data.health.score} 100`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{data.health.score}</span>
              <span className="text-[9px] text-slate-400">/ 100</span>
            </div>
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100">Financial Health: {data.health.label}</h2>
            <ul className="mt-2 space-y-1">
              {data.health.factors.map((f) => (
                <li key={f.name} className="text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-slate-600 dark:text-slate-300">{f.name}:</span> {f.points}/{f.max} — {f.note}
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-slate-400 mt-2">{data.health.disclaimer}</p>
          </div>
        </div>
      </section>

      {/* Insights */}
      {data.insights.length > 0 && (
        <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Insights</h2>
          <ul className="space-y-2">
            {data.insights.map((ins, i) => (
              <li key={i} className="flex gap-2 text-sm text-slate-600 dark:text-slate-300">
                <span aria-hidden>💡</span> {ins}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Net worth */}
      <section className="grid grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase">Assets</p>
          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1">{formatMoney(data.net_worth.assets_cents, cur)}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase">Liabilities</p>
          <p className="text-sm font-bold text-rose-600 dark:text-rose-400 mt-1">{formatMoney(data.net_worth.liabilities_cents, cur)}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase">Net worth</p>
          <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mt-1">{formatMoney(data.net_worth.net_cents, cur)}</p>
        </div>
      </section>

      {/* Cash flow trend */}
      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-4">Cash flow trend</h2>
        {data.cashflow.series.length === 0 ? (
          <p className="text-sm text-slate-500">No data for this range.</p>
        ) : (
          <div className="flex items-end gap-2 h-40">
            {data.cashflow.series.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex items-end justify-center h-32">
                  <div
                    className={`w-2/3 rounded-t ${m.net >= 0 ? "bg-emerald-500" : "bg-rose-400"}`}
                    style={{ height: `${(Math.abs(m.net) / maxNet) * 100}%` }}
                    title={`${m.month}: ${formatMoney(m.net, cur)}`}
                  />
                </div>
                <span className="text-[10px] text-slate-500">{m.month.slice(2)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Spending breakdown */}
      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">Spending analysis</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          Avg {formatMoney(data.spending.average_daily_cents, cur)}/day
          {data.spending.top_category ? ` · top: ${data.spending.top_category.name}` : ""}
        </p>
        {data.spending.by_category.length === 0 ? (
          <p className="text-sm text-slate-500">No expenses in this range.</p>
        ) : (
          <ul className="space-y-2.5">
            {data.spending.by_category.slice(0, 8).map((c) => {
              const max = data.spending.by_category[0].cents || 1;
              return (
                <li key={c.categoryId}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600 dark:text-slate-300">{c.name}</span>
                    <span className="font-medium text-slate-800 dark:text-slate-100">{formatMoney(c.cents, cur)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(c.cents / max) * 100}%`, backgroundColor: c.color }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
