import type { Metadata } from "next";
import "./globals.css";
import Script from "next/script";

// Geist was previously loaded via next/font/google, which fetches fonts at
// build time and breaks on Netlify when Google rate-limits build servers.
// A system font stack keeps builds hermetic. To restore Geist, self-host
// it with next/font/local instead.
const systemFontStack =
  "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const monoFontStack =
  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";

export const metadata: Metadata = {
  title: "Budget Tracker",
  description: "Personal budgeting app that works offline and as a mobile app",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Budget Tracker",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      style={
        {
          "--font-geist-sans": systemFontStack,
          "--font-geist-mono": monoFontStack,
        } as React.CSSProperties
      }
      className="h-full antialiased"
    >
      <meta name="theme-color" content="#0f172a" />
      <link rel="icon" href="/icons/icon-192.svg" type="image/svg+xml" />
      <body className="min-h-full flex flex-col">{children}</body>
      <Script src="/sw.js" strategy="beforeInteractive" />
    </html>
  );
}
