import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="flex flex-col items-center justify-center min-h-[100dvh] px-4 text-center">
      <div className="bg-slate-100 rounded-2xl p-8 max-w-sm w-full">
        <div className="text-4xl mb-4">📡</div>
        <h1 className="text-xl font-semibold text-slate-800 mb-2">You&apos;re offline</h1>
        <p className="text-sm text-slate-500 mb-6">
          This route isn&apos;t cached yet. The app shell is still available.
        </p>
        <Link
          href="/"
          className="inline-block bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition"
        >
          Return to dashboard
        </Link>
      </div>
    </main>
  );
}
