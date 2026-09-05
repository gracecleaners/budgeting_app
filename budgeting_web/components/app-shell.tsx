"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV = [
  { href: "/app", label: "Dashboard", icon: "🏠" },
  { href: "/app/transactions", label: "Transactions", icon: "💳" },
  { href: "/app/budgets", label: "Budgets", icon: "📊" },
  { href: "/app/savings", label: "Savings", icon: "🎯" },
  { href: "/app/accounts", label: "Accounts", icon: "🏦" },
  { href: "/app/reports", label: "Reports", icon: "📄" },
  { href: "/app/more", label: "More", icon: "⚙️" },
];

const MOBILE_NAV = [NAV[0], NAV[1], NAV[2], NAV[4], NAV[6]];

export function AppShell({
  user,
  children,
}: {
  user: { name: string; email: string; currency: string };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const isActive = (href: string) =>
    href === "/app" ? pathname === "/app" : pathname.startsWith(href);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-slate-200 bg-white">
        <div className="px-5 py-5 border-b border-slate-100">
          <p className="font-bold text-slate-900">Budget Tracker</p>
          <p className="text-xs text-slate-500 mt-0.5">{user.currency} · {user.name}</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                isActive(item.href)
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="px-3 pb-4">
          <button
            onClick={logout}
            className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-50 transition"
          >
            Log out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 px-4 py-6 max-w-5xl mx-auto w-full pb-24 md:pb-6">{children}</main>

        {/* Mobile bottom nav */}
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          aria-label="Primary"
        >
          {MOBILE_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
                isActive(item.href) ? "text-emerald-600" : "text-slate-500"
              }`}
            >
              <span className="text-lg" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
