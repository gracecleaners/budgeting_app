import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { OnboardingWizard } from "@/components/onboarding-wizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.onboardedAt) redirect("/app");
  return <OnboardingWizard name={user.name} />;
}
