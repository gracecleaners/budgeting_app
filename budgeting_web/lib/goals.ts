import { suggestedMonthlyContribution as smc } from "@/lib/finance";

/**
 * Savings-goal progress (spec #9/#10) and recurring-date advancement
 * (spec #12). Pure and unit-testable.
 */

export type GoalLike = {
  targetCents: number;
  savedCents: number;
  targetDate: string | null;
};

export type GoalProgress = {
  percent: number;
  remainingCents: number;
  suggestedMonthlyCents: number | null;
  daysRemaining: number | null;
  status: "achieved" | "on_track" | "behind" | "no_date";
};

export function goalProgress(goal: GoalLike, today = new Date()): GoalProgress {
  const percent =
    goal.targetCents > 0
      ? Math.min(100, Math.round((goal.savedCents / goal.targetCents) * 1000) / 10)
      : 0;
  const remainingCents = Math.max(0, goal.targetCents - goal.savedCents);

  if (!goal.targetDate) {
    return {
      percent,
      remainingCents,
      suggestedMonthlyCents: smc(goal.targetCents, goal.savedCents, null),
      daysRemaining: null,
      status: percent >= 100 ? "achieved" : "no_date",
    };
  }

  const target = new Date(`${goal.targetDate}T00:00:00`);
  const msLeft = target.getTime() - today.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msLeft / 86_400_000));

  let status: GoalProgress["status"] = "on_track";
  if (percent >= 100) status = "achieved";
  else {
    const monthsLeft =
      (target.getFullYear() - today.getFullYear()) * 12 + (target.getMonth() - today.getMonth());
    const monthlyNeeded = monthsLeft > 0 ? remainingCents / monthsLeft : remainingCents;
    const monthlyIncomeAssumption = 4_000_00; // not user data; only for behind-schedule heuristic
    if (daysRemaining === 0 && remainingCents > 0) status = "behind";
    else if (monthlyNeeded > monthlyIncomeAssumption) status = "behind";
  }

  return {
    percent,
    remainingCents,
    suggestedMonthlyCents: smc(goal.targetCents, goal.savedCents, goal.targetDate),
    daysRemaining,
    status,
  };
}

export type RecurringFrequency = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

/** Advance a date key by one frequency step (clamped to month end). */
export function nextRecurrence(dateKey: string, frequency: RecurringFrequency): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = (yy: number, mm: number) => new Date(yy, mm, 0).getDate();

  switch (frequency) {
    case "daily": {
      const isMonthEnd = d === lastDay(y, m);
      const nm2 = isMonthEnd ? (m === 12 ? 1 : m + 1) : m;
      const ny2 = isMonthEnd && m === 12 ? y + 1 : y;
      return `${ny2}-${pad(nm2)}-${pad(isMonthEnd ? 1 : d + 1)}`;
    }
    case "weekly":
      return addDays(dateKey, 7);
    case "monthly":
      return shiftMonth(y, m, d, 1, lastDay, pad);
    case "quarterly":
      return shiftMonth(y, m, d, 3, lastDay, pad);
    case "yearly": {
      const ny = y + 1;
      return `${ny}-${pad(m)}-${pad(Math.min(d, lastDay(ny, m)))}`;
    }
  }
}

function addDays(dateKey: string, days: number): string {
  const dt = new Date(`${dateKey}T00:00:00`);
  dt.setDate(dt.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function shiftMonth(
  y: number,
  m: number,
  d: number,
  by: number,
  lastDay: (yy: number, mm: number) => number,
  pad: (n: number) => string
): string {
  const total = (y * 12 + (m - 1)) + by;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${pad(nm)}-${pad(Math.min(d, lastDay(ny, nm)))}`;
}

/** Monthly-normalized cost of a subscription cycle (spec #13). */
export function monthlyCost(cents: number, cycle: string): number {
  switch (cycle) {
    case "yearly":
      return Math.round(cents / 12);
    case "quarterly":
      return Math.round(cents / 3);
    case "weekly":
      return Math.round((cents * 52) / 12);
    default:
      return cents;
  }
}
