"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { api, ApiClientError } from "@/lib/api";
import { CURRENCIES, ACCOUNT_TYPES } from "@/lib/defaults";

type AccountDraft = { name: string; type: string; openingBalance: string; institution: string };
type GoalDraft = { name: string; targetAmount: string; targetDate: string; priority: string };

const inputCls =
  "w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg px-3 py-2.5 text-sm min-h-11";

export function OnboardingWizard({ name }: { name: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [currency, setCurrency] = useState("UGX");
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [accounts, setAccounts] = useState<AccountDraft[]>([
    { name: "Cash", type: "cash", openingBalance: "", institution: "" },
  ]);
  const [goals, setGoals] = useState<GoalDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const addAccount = () =>
    setAccounts((a) => [...a, { name: "", type: "mobile_money", openingBalance: "", institution: "" }]);
  const addGoal = () =>
    setGoals((g) => [...g, { name: "", targetAmount: "", targetDate: "", priority: "medium" }]);

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      await api.post("/onboarding", {
        currency,
        monthlyIncome: monthlyIncome ? Number(monthlyIncome) : undefined,
        accounts: accounts
          .filter((a) => a.name.trim())
          .map((a) => ({
            name: a.name,
            type: a.type,
            openingBalance: Number(a.openingBalance || 0),
            institution: a.institution || undefined,
          })),
        goals: goals
          .filter((g) => g.name.trim() && g.targetAmount)
          .map((g) => ({
            name: g.name,
            targetAmount: Number(g.targetAmount),
            targetDate: g.targetDate || null,
            priority: g.priority,
          })),
      });
      router.replace("/app");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Failed to save setup");
      setBusy(false);
    }
  }

  const STEPS = ["Welcome", "Accounts", "Goals", "Review"];

  return (
    <div className="min-h-dvh flex flex-col max-w-lg mx-auto px-4 py-6">
      {/* Progress dots */}
      <div className="flex items-center gap-2 mb-8" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i <= step ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"
            }`}
          />
        ))}
      </div>

      {error && (
        <p className="text-sm text-rose-600 bg-rose-50 dark:bg-rose-900/30 rounded-lg px-3 py-2 mb-4" role="alert">
          {error}
        </p>
      )}

      <div className="flex-1">
        {step === 0 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Welcome, {name.split(" ")[0]} 👋
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                Let&apos;s set up your money in under a minute. Every step is skippable — you can
                always change things later in <strong>More</strong>.
              </p>
            </div>
            <div>
              <label htmlFor="ob-currency" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Preferred currency
              </label>
              <select id="ob-currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ob-income" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Approximate monthly income <span className="text-slate-400">(optional)</span>
              </label>
              <input
                id="ob-income"
                type="number"
                min="0"
                inputMode="decimal"
                placeholder="e.g. 2000000"
                value={monthlyIncome}
                onChange={(e) => setMonthlyIncome(e.target.value)}
                className={inputCls}
              />
              <p className="text-xs text-slate-400 mt-1">Used for savings-rate insights — never shared.</p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Your accounts</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                Where does your money live? Add wallet balances to see your total at a glance.
              </p>
            </div>
            {accounts.map((a, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    aria-label="Account name"
                    placeholder="Name (e.g. MTN MoMo)"
                    value={a.name}
                    onChange={(e) => setAccounts((arr) => arr.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                    className={inputCls}
                  />
                  <select
                    aria-label="Account type"
                    value={a.type}
                    onChange={(e) => setAccounts((arr) => arr.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))}
                    className={inputCls}
                  >
                    {ACCOUNT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <input
                    aria-label="Opening balance"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    placeholder="Current balance"
                    value={a.openingBalance}
                    onChange={(e) => setAccounts((arr) => arr.map((x, j) => (j === i ? { ...x, openingBalance: e.target.value } : x)))}
                    className={inputCls}
                  />
                  {accounts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setAccounts((arr) => arr.filter((_, j) => j !== i))}
                      className="text-rose-500 px-3 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/30"
                      aria-label={`Remove account ${i + 1}`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button type="button" onClick={addAccount} className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
              + Add another account
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">First savings goals</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                Emergency fund, school fees, a laptop — name it and we&apos;ll track progress.
              </p>
            </div>
            {goals.length === 0 && (
              <p className="text-sm text-slate-400">No goals yet — add one or skip.</p>
            )}
            {goals.map((g, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
                <input
                  aria-label="Goal name"
                  placeholder="Goal name (e.g. Emergency Fund)"
                  value={g.name}
                  onChange={(e) => setGoals((arr) => arr.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  className={inputCls}
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    aria-label="Target amount"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    placeholder="Target amount"
                    value={g.targetAmount}
                    onChange={(e) => setGoals((arr) => arr.map((x, j) => (j === i ? { ...x, targetAmount: e.target.value } : x)))}
                    className={inputCls}
                  />
                  <input
                    aria-label="Target date"
                    type="date"
                    value={g.targetDate}
                    onChange={(e) => setGoals((arr) => arr.map((x, j) => (j === i ? { ...x, targetDate: e.target.value } : x)))}
                    className={inputCls}
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    aria-label="Priority"
                    value={g.priority}
                    onChange={(e) => setGoals((arr) => arr.map((x, j) => (j === i ? { ...x, priority: e.target.value } : x)))}
                    className={inputCls}
                  >
                    <option value="low">Low priority</option>
                    <option value="medium">Medium priority</option>
                    <option value="high">High priority</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setGoals((arr) => arr.filter((_, j) => j !== i))}
                    className="text-rose-500 px-3 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/30"
                    aria-label={`Remove goal ${i + 1}`}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            <button type="button" onClick={addGoal} className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
              + Add goal
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Ready!</h1>
            <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-2">
              <li>💱 Currency: <strong>{currency}</strong></li>
              {monthlyIncome && <li>💵 Monthly income: <strong>{currency} {Number(monthlyIncome).toLocaleString()}</strong></li>}
              <li>🏦 Accounts: <strong>{accounts.filter((a) => a.name.trim()).length || "none (add later)"}</strong></li>
              <li>🎯 Goals: <strong>{goals.filter((g) => g.name.trim() && g.targetAmount).length || "none (add later)"}</strong></li>
            </ul>
            <p className="text-xs text-slate-400">
              Tip: after this, set up budgets in the Budgets tab to unlock utilization tracking and alerts.
            </p>
          </div>
        )}
      </div>

      {/* Sticky footer actions */}
      <div className="sticky bottom-0 pt-4 pb-2 bg-slate-50 dark:bg-slate-900 flex gap-3 safe-bottom">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="flex-1 border border-slate-300 dark:border-slate-600 rounded-xl py-3 text-sm font-medium text-slate-600 dark:text-slate-300"
          >
            Back
          </button>
        )}
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            className="flex-1 bg-emerald-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-emerald-700"
          >
            Continue
          </button>
        ) : (
          <button
            type="button"
            onClick={finish}
            disabled={busy}
            className="flex-1 bg-emerald-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? "Setting up..." : "Finish setup"}
          </button>
        )}
      </div>
    </div>
  );
}
