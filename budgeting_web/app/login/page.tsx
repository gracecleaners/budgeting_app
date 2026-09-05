"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { setCacheUser, clearCache } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.message ?? "Login failed");
      clearCache();
      setCacheUser(json.data.id);
      router.replace("/app");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setBusy(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center text-slate-900">Budget Tracker</h1>
        <p className="text-sm text-slate-500 text-center mt-1 mb-8">
          Log in to manage your money
        </p>
        <form onSubmit={submit} className="space-y-4 bg-white rounded-2xl border border-slate-200 p-6">
          {error && (
            <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2" role="alert">
              {error}
            </p>
          )}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-emerald-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-50"
          >
            {busy ? "Logging in..." : "Log in"}
          </button>
          <p className="text-sm text-center text-slate-500">
            No account?{" "}
            <Link href="/signup" className="text-emerald-600 font-medium hover:underline">
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
