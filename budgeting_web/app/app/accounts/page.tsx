"use client";

import { useCallback, useEffect, useState } from "react";

import { api, formatMoney } from "@/lib/api";
import { ACCOUNT_TYPES } from "@/lib/defaults";

type Account = {
  id: number;
  name: string;
  type: string;
  openingBalance: string;
  currency: string;
  institution: string | null;
  color: string;
  balanceCentsCache: number;
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [currency, setCurrency] = useState("UGX");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Account[]>("/accounts");
      setAccounts(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    api.get<{ currency: string }>("/auth/me").then((u) => setCurrency(u.currency)).catch(() => {});
  }, [load]);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Accounts</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition"
        >
          + Add account
        </button>
      </header>

      {loading ? (
        <div className="space-y-2" aria-busy="true">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3" aria-hidden>
            🏦
          </p>
          <p className="text-slate-600 font-medium">No accounts yet</p>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            Add your cash, bank, or Mobile Money accounts to start tracking.
          </p>
          <button
            onClick={() => setShowAdd(true)}
            className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Create account
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {accounts.map((a) => (
            <li key={a.id} className="bg-white rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: a.color }} />
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 truncate">{a.name}</p>
                    <p className="text-xs text-slate-500">
                      {ACCOUNT_TYPES.find((t) => t.value === a.type)?.label ?? a.type}
                      {a.institution ? ` · ${a.institution}` : ""}
                    </p>
                  </div>
                </div>
                <span className="font-semibold text-slate-800">
                  {formatMoney(a.balanceCentsCache, a.currency)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showAdd && (
        <AddAccountModal
          defaultCurrency={currency}
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

function AddAccountModal({
  defaultCurrency,
  onClose,
  onAdded,
}: {
  defaultCurrency: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    type: "cash",
    openingBalance: "",
    institution: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/accounts", {
        name: form.name,
        type: form.type,
        openingBalance: Number(form.openingBalance || 0),
        currency: defaultCurrency,
        institution: form.institution || undefined,
      });
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
      setBusy(false);
    }
  }

  const input =
    "w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none";

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" role="dialog" aria-modal="true">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">New account</h2>
        <form onSubmit={submit} className="space-y-3">
          {error && <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</p>}
          <input
            required
            placeholder="Account name (e.g. MTN Mobile Money)"
            aria-label="Account name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className={input}
          />
          <select
            aria-label="Account type"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            className={input}
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="0.01"
            placeholder="Opening balance (0)"
            aria-label="Opening balance"
            value={form.openingBalance}
            onChange={(e) => setForm((f) => ({ ...f, openingBalance: e.target.value }))}
            className={input}
          />
          <input
            placeholder="Institution (optional)"
            aria-label="Institution"
            value={form.institution}
            onChange={(e) => setForm((f) => ({ ...f, institution: e.target.value }))}
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
              {busy ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
