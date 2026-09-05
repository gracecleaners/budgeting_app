import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";
import { OnboardingWizard } from "@/components/onboarding-wizard";

export const dynamic = "force-dynamic";

// Lives OUTSIDE the /app segment on purpose: the /app layout redirects
// non-onboarded users here, so nesting it under /app would loop forever.
export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.onboardedAt) redirect("/app");
  return <OnboardingWizard name={user.name} />;
}
