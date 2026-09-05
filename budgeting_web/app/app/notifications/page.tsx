"use client";

import { useCallback, useEffect, useState } from "react";

import { api, formatDateTime } from "@/lib/api";

type Notification = {
  id: number;
  level: "info" | "warning" | "critical";
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
};

const LEVEL_META: Record<Notification["level"], { icon: string; cls: string }> = {
  info: { icon: "ℹ️", cls: "bg-sky-50 dark:bg-sky-900/20 border-sky-100 dark:border-sky-800" },
  warning: { icon: "⚠️", cls: "bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800" },
  critical: { icon: "🚨", cls: "bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800" },
};

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<{ items: Notification[]; unread: number }>("/notifications");
      setItems(data.items);
      setUnread(data.unread);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markAll() {
    await api.patch("/notifications", { all: true });
    load();
  }

  async function markOne(id: number) {
    await api.patch("/notifications", { id });
    load();
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          Notifications{unread > 0 ? ` (${unread})` : ""}
        </h1>
        {unread > 0 && (
          <button onClick={markAll} className="text-sm text-emerald-600 hover:underline">
            Mark all read
          </button>
        )}
      </header>

      {loading ? (
        <div className="space-y-2" aria-busy="true">
          {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3" aria-hidden>🔔</p>
          <p className="text-slate-600 dark:text-slate-300 font-medium">No notifications</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Budget warnings, upcoming bills, and due dates will appear here.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const meta = LEVEL_META[n.level] ?? LEVEL_META.info;
            return (
              <li key={n.id} className={`rounded-xl border p-4 ${meta.cls} ${n.readAt ? "opacity-60" : ""}`}>
                <div className="flex items-start gap-3">
                  <span aria-hidden className="text-lg leading-none mt-0.5">{meta.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{n.body || n.title}</p>
                    <p className="text-xs text-slate-400 mt-1">{formatDateTime(n.createdAt)}</p>
                  </div>
                  {!n.readAt && (
                    <button onClick={() => markOne(n.id)} className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shrink-0">
                      Mark read
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
