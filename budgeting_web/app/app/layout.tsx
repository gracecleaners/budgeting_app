import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  // First-run users go through the onboarding wizard (spec #32).
  // The wizard lives at /onboarding (outside /app) so this redirect
  // can't loop against itself.
  if (!user.onboardedAt) redirect("/onboarding");
  return (
    <AppShell user={{ name: user.name, email: user.email, currency: user.currency }}>
      {children}
    </AppShell>
  );
}
