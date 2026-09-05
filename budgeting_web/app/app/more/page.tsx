"use client";

import { useEffect, useState } from "react";

import { api, setCacheUser, clearCache } from "@/lib/api";

type Me = { id: number; name: string; email: string; currency: string; country: string | null };

export default function MorePage() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    api.get<Me>("/auth/me").then((u) => {
      setMe(u);
      setCacheUser(u.id);
    });
  }, []);

  return (
    <div className="space-y-4 max-w-md">
      <h1 className="text-2xl font-bold text-slate-900">More</h1>

      <section className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-800 mb-2">Profile</h2>
        {me ? (
          <dl className="text-sm space-y-1.5">
            <div className="flex justify-between"><dt className="text-slate-500">Name</dt><dd className="font-medium">{me.name}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Email</dt><dd className="font-medium">{me.email}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Currency</dt><dd className="font-medium">{me.currency}</dd></div>
            {me.country && <div className="flex justify-between"><dt className="text-slate-500">Country</dt><dd className="font-medium">{me.country}</dd></div>}
          </dl>
        ) : (
          <p className="text-sm text-slate-500">Loading…</p>
        )}
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-800 mb-2">Offline</h2>
        <p className="text-sm text-slate-500 mb-3">
          Your dashboard and transactions are cached on this device so you can view them without
          internet. Changes made offline will sync in a future update.
        </p>
        <button
          onClick={() => {
            clearCache();
            location.reload();
          }}
          className="text-sm border border-slate-300 rounded-lg px-3 py-2 hover:bg-slate-50"
        >
          Clear offline cache
        </button>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-800 mb-2">Roadmap</h2>
        <ul className="text-sm text-slate-500 space-y-1.5 list-disc list-inside">
          <li>Phase 2 — Budgets with progress & alerts</li>
          <li>Phase 3 — Savings goals & contributions</li>
          <li>Phase 4 — Debts, recurring & subscriptions</li>
          <li>Phase 5 — Analytics, reports & health score</li>
          <li>Phase 6 — Notifications & reminders</li>
          <li>Phase 7 — Dark mode & offline sync</li>
        </ul>
      </section>
    </div>
  );
}
