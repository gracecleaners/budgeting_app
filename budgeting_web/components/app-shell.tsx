"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { api, clearCache, setCacheUser } from "@/lib/api";
import { restoreTheme, applyTheme, type Theme } from "@/lib/client";

const NAV = [
  { href: "/app", label: "Dashboard", icon: "🏠", mobile: true },
  { href: "/app/transactions", label: "Transactions", icon: "💳", mobile: true },
  { href: "/app/budgets", label: "Budgets", icon: "📊", mobile: true },
  { href: "/app/savings", label: "Savings", icon: "🎯", mobile: false },
  { href: "/app/debts", label: "Debts", icon: "💸", mobile: false },
  { href: "/app/subscriptions", label: "Subscriptions", icon: "📺", mobile: false },
  { href: "/app/reports", label: "Reports", icon: "📈", mobile: false },
  { href: "/app/notifications", label: "Notifications", icon: "🔔", mobile: false, badge: true },
  { href: "/app/more", label: "More", icon: "⚙️", mobile: true },
];

const MOBILE_NAV = NAV.filter((n) => n.mobile);

export function AppShell({
  user,
  children,
}: {
  user: { name: string; email: string; currency: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    restoreTheme();
    setTheme((localStorage.getItem("fin_theme") as Theme) ?? "system");
    // generate today's alerts + get unread count for the badge
    api
      .post("/notifications")
      .then(() => api.get<{ unread: number }>("/notifications"))
      .then((d) => setUnread(d.unread))
      .catch(() => {});
  }, []);

  useEffect(() => {
    // refresh badge on nav change
    api.get<{ unread: number }>("/notifications").then((d) => setUnread(d.unread)).catch(() => {});
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    clearCache();
    setCacheUser(null);
    router.replace("/login");
    router.refresh();
  }

  function cycleTheme() {
    const next: Theme = theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    setTheme(next);
    applyTheme(next);
  }

  const isActive = (href: string) =>
    href === "/app" ? pathname === "/app" : pathname.startsWith(href);

  const themeIcon = theme === "system" ? "💻" : theme === "light" ? "☀️" : "🌙";

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="px-5 py-5 border-b border-slate-100 dark:border-slate-700">
          <p className="font-bold text-slate-900 dark:text-slate-100">Budget Tracker</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{user.currency} · {user.name}</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1" aria-label="Primary">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                isActive(item.href)
                  ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              <span aria-hidden>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge && unread > 0 && (
                <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-5 text-center">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="px-3 pb-4 space-y-1">
          <button
            onClick={cycleTheme}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            aria-label={`Theme: ${theme}`}
          >
            <span aria-hidden>{themeIcon}</span> Theme: {theme}
          </button>
          <button
            onClick={logout}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            Log out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between px-4 pt-4">
          <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">Budget Tracker</p>
          <div className="flex items-center gap-3">
            <button onClick={cycleTheme} aria-label="Toggle theme" className="text-lg">
              {themeIcon}
            </button>
            <Link href="/app/notifications" className="relative text-lg" aria-label={`Notifications, ${unread} unread`}>
              🔔
              {unread > 0 && (
                <span className="absolute -top-1 -right-1.5 bg-rose-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <button onClick={logout} className="text-sm text-slate-500 dark:text-slate-400" aria-label="Log out">
              ⎋
            </button>
          </div>
        </div>

        <main className="flex-1 px-4 py-4 md:py-6 max-w-5xl mx-auto w-full pb-28 md:pb-6">{children}</main>

        {/* Mobile bottom nav — 5 primary destinations */}
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex z-40"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          aria-label="Primary"
        >
          {MOBILE_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium min-h-12 justify-center ${
                isActive(item.href) ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              <span className="text-lg leading-none" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Quick-add FAB */}
        <Link
          href="/app/transactions?add=1"
          className="md:hidden fixed right-4 bottom-20 z-40 w-14 h-14 rounded-full bg-emerald-600 text-white shadow-lg flex items-center justify-center text-2xl leading-none active:scale-95 transition-transform"
          aria-label="Add transaction"
        >
          +
        </Link>
      </div>
    </div>
  );
}
