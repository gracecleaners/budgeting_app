"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { api, setCacheUser, clearCache, ApiClientError, syncNow, pendingWrites } from "@/lib/api";
import { readQueue } from "@/lib/sync-queue";
import { applyTheme, type Theme } from "@/lib/client";
import { CURRENCIES } from "@/lib/defaults";

type Profile = {
  id: number;
  name: string;
  email: string;
  currency: string;
  country: string | null;
  theme: Theme;
  monthlyIncomeTargetCents: number | null;
};

export default function MorePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({ name: "", currency: "UGX", country: "", monthlyIncomeTarget: "" });
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>("system");
  const [queued, setQueued] = useState<ReturnType<typeof readQueue>>([]);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const refreshQueue = () => setQueued(readQueue());

  useEffect(() => {
    refreshQueue();
  }, []);

  useEffect(() => {
    api.get<Profile>("/profile").then((p) => {
      setProfile(p);
      setCacheUser(p.id);
      setForm({
        name: p.name,
        currency: p.currency,
        country: p.country ?? "",
        monthlyIncomeTarget: p.monthlyIncomeTargetCents ? String(p.monthlyIncomeTargetCents / 100) : "",
      });
      setTheme(p.theme ?? "system");
    });
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await api.patch("/profile", {
        name: form.name,
        currency: form.currency,
        country: form.country || null,
        monthlyIncomeTarget: form.monthlyIncomeTarget ? Number(form.monthlyIncomeTarget) : null,
      });
      setMsg("Profile updated");
    } catch (err) {
      setMsg(err instanceof ApiClientError ? err.message : "Failed to update");
    }
  }

  async function saveTheme(next: Theme) {
    setTheme(next);
    applyTheme(next);
    await api.patch("/profile", { theme: next }).catch(() => {});
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    try {
      await api.post("/auth/password", pw);
      setPwMsg("Password changed");
      setPw({ currentPassword: "", newPassword: "" });
    } catch (err) {
      setPwMsg(err instanceof ApiClientError ? err.message : "Failed to change password");
    }
  }

  const input =
    "w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg px-3 py-2 text-sm";

  return (
    <div className="space-y-4 max-w-lg">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">More</h1>

      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Profile</h2>
        <form onSubmit={saveProfile} className="space-y-3">
          {profile && (
            <p className="text-xs text-slate-400">{profile.email}</p>
          )}
          <input aria-label="Full name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={input} placeholder="Full name" />
          <div className="grid grid-cols-2 gap-3">
            <select aria-label="Currency" value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} className={input}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input aria-label="Country" value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} className={input} placeholder="Country" />
          </div>
          <input aria-label="Monthly income target" type="number" min="0" value={form.monthlyIncomeTarget} onChange={(e) => setForm((f) => ({ ...f, monthlyIncomeTarget: e.target.value }))} className={input} placeholder="Monthly income target (optional)" />
          {msg && <p className="text-sm text-emerald-600">{msg}</p>}
          <button type="submit" className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">Save profile</button>
        </form>
      </section>

      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Appearance</h2>
        <div className="grid grid-cols-3 gap-2">
          {(["light", "dark", "system"] as Theme[]).map((t) => (
            <button
              key={t}
              onClick={() => saveTheme(t)}
              className={`py-2 rounded-lg text-sm font-medium capitalize ${
                theme === t ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
              }`}
            >
              {t === "light" ? "☀️ " : t === "dark" ? "🌙 " : "💻 "}{t}
            </button>
          ))}
        </div>
      </section>

      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Change password</h2>
        <form onSubmit={changePassword} className="space-y-3">
          <input aria-label="Current password" type="password" autoComplete="current-password" required value={pw.currentPassword} onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))} className={input} placeholder="Current password" />
          <input aria-label="New password" type="password" autoComplete="new-password" required minLength={8} value={pw.newPassword} onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))} className={input} placeholder="New password (min 8 chars)" />
          {pwMsg && <p className="text-sm text-emerald-600">{pwMsg}</p>}
          <button type="submit" className="text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-slate-200">Update password</button>
        </form>
      </section>

      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">Offline sync</h2>
        {queued.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
            All caught up. Changes made offline sync automatically when you reconnect.
          </p>
        ) : (
          <>
            <p className="text-sm text-amber-600 dark:text-amber-400 mb-2">
              {queued.length} change{queued.length === 1 ? "" : "s"} waiting to sync:
            </p>
            <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-1 mb-3 list-disc list-inside">
              {queued.slice(0, 5).map((w) => (
                <li key={w.id}>{w.description}</li>
              ))}
            </ul>
            <button
              onClick={async () => {
                setSyncMsg("Syncing…");
                const { sent, remaining } = await syncNow();
                setSyncMsg(sent > 0 ? `Synced ${sent} change${sent === 1 ? "" : "s"}.` : "Nothing synced — are you online?");
                refreshQueue();
                void remaining;
              }}
              className="text-sm bg-emerald-600 text-white rounded-lg px-3 py-2 font-medium hover:bg-emerald-700"
            >
              Sync now
            </button>
          </>
        )}
        {syncMsg && <p className="text-sm text-emerald-600 mt-2">{syncMsg}</p>}
      </section>

      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">Data</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
          Your dashboard, transactions, budgets, and goals are cached on this device for offline viewing.
        </p>
        <button
          onClick={() => {
            clearCache();
            location.reload();
          }}
          className="text-sm border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-slate-200"
        >
          Clear offline cache
        </button>
      </section>

      <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
        <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Quick links</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Link href="/app/accounts" className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-slate-200">🏦 Accounts</Link>
          <Link href="/app/subscriptions" className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-slate-200">📺 Subscriptions</Link>
          <Link href="/app/notifications" className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-slate-200">🔔 Notifications</Link>
          <Link href="/app/reports" className="border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-slate-200">📈 Reports</Link>
        </div>
      </section>
    </div>
  );
}
