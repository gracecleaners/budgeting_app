import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Budget Tracker",
  description: "Personal finance management that works offline and as a mobile app",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Budget Tracker",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* Apply saved theme before paint to avoid a flash of the wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('fin_theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col text-slate-900 dark:text-slate-100">{children}</body>
    </html>
  );
}
