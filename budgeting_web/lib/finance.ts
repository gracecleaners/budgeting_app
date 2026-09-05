import { sumCents } from "@/lib/money";

/**
 * Core financial calculations (spec #36). All amounts in integer cents.
 * Transfers are NEVER included in income/expense math — they only move
 * money between accounts.
 */

export type TxLike = {
  type: string;
  amountCents: number;
  date: string;
  categoryId?: number | null;
  fromAccountId?: number | null;
  toAccountId?: number | null;
};

export type AccountLike = {
  id: number;
  openingBalanceCents: number;
};

export type CategoryLike = {
  id: number;
  name: string;
  kind: string;
  color: string;
};

export function totalIncome(txs: TxLike[]): number {
  return sumCents(txs.filter((t) => t.type === "income").map((t) => t.amountCents));
}

export function totalExpenses(txs: TxLike[]): number {
  return sumCents(txs.filter((t) => t.type === "expense").map((t) => t.amountCents));
}

export function cashFlow(txs: TxLike[]): number {
  return totalIncome(txs) - totalExpenses(txs);
}

/** Current balance of an account = opening + inflows - outflows. */
export function accountBalance(
  account: AccountLike,
  txs: TxLike[]
): number {
  let bal = account.openingBalanceCents;
  for (const t of txs) {
    if (t.type === "income" && t.toAccountId === account.id) bal += t.amountCents;
    else if (t.type === "expense" && t.fromAccountId === account.id) bal -= t.amountCents;
    else if (t.type === "transfer") {
      if (t.fromAccountId === account.id) bal -= t.amountCents;
      if (t.toAccountId === account.id) bal += t.amountCents;
    }
    // savings/debt_payment/investment treated as transfers-style outflows below
    else if (
      (t.type === "savings" || t.type === "debt_payment" || t.type === "investment") &&
      t.fromAccountId === account.id
    ) {
      bal -= t.amountCents;
    }
  }
  return bal;
}

export function totalBalances(accounts: AccountLike[], txs: TxLike[]): number {
  return sumCents(accounts.map((a) => accountBalance(a, txs)));
}

export function expensesByCategory(
  txs: TxLike[],
  categories: CategoryLike[]
): { categoryId: number; name: string; color: string; cents: number }[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const totals = new Map<number, number>();
  for (const t of txs) {
    if (t.type !== "expense" || t.categoryId == null) continue;
    totals.set(t.categoryId, (totals.get(t.categoryId) ?? 0) + t.amountCents);
  }
  return [...totals.entries()]
    .map(([categoryId, cents]) => ({
      categoryId,
      name: byId.get(categoryId)?.name ?? "Uncategorized",
      color: byId.get(categoryId)?.color ?? "#94a3b8",
      cents,
    }))
    .sort((a, b) => b.cents - a.cents);
}

export type BudgetUsage = {
  cents: number;
  spentCents: number;
  remainingCents: number;
  percent: number; // 0..100+, unclamped so callers can show "over"
  status: "on_track" | "warning" | "almost_exceeded" | "exceeded";
};

/** Budget usage with the spec's four statuses (#8). */
export function budgetUsage(budgetCents: number, spentCents: number): BudgetUsage {
  const percent = budgetCents > 0 ? (spentCents / budgetCents) * 100 : spentCents > 0 ? 100 : 0;
  const status: BudgetUsage["status"] =
    percent >= 100
      ? "exceeded"
      : percent >= 90
        ? "almost_exceeded"
        : percent >= 75
          ? "warning"
          : "on_track";
  return {
    cents: budgetCents,
    spentCents,
    remainingCents: budgetCents - spentCents,
    percent,
    status,
  };
}

/** Suggested monthly contribution to reach a goal by its target date. */
export function suggestedMonthlyContribution(
  targetCents: number,
  savedCents: number,
  targetDate?: string | null
): number | null {
  const remaining = targetCents - savedCents;
  if (remaining <= 0) return 0;
  if (!targetDate) return null;
  const target = new Date(`${targetDate}T00:00:00`);
  const now = new Date();
  const months = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
  if (months <= 0) return remaining; // due now/past: need it all
  return Math.ceil(remaining / months);
}

export function savingsRate(incomeCents: number, savedCents: number): number {
  if (incomeCents <= 0) return 0;
  return Math.max(0, Math.round((savedCents / incomeCents) * 100));
}

export function debtToIncomeRatio(debtCents: number, incomeCents: number): number {
  if (incomeCents <= 0) return debtCents > 0 ? 100 : 0;
  return Math.round((debtCents / incomeCents) * 100);
}

/**
 * Financial health score 0-100 (#15). Inputs are cents. Explanations array
 * mirrors the components so the UI can show what's helping/hurting.
 * NOT professional financial advice.
 */
export function healthScore(input: {
  incomeCents: number;
  expenseCents: number;
  savedCents: number;
  debtCents: number;
  budgetAdherencePct: number; // 0..100, % of budgets not exceeded
}): { score: number; label: string; factors: { name: string; points: number; max: number; note: string }[] } {
  const factors: { name: string; points: number; max: number; note: string }[] = [];

  const sr = savingsRate(input.incomeCents, input.savedCents);
  const srPts = Math.min(25, Math.round((sr / 20) * 25)); // 20%+ savings rate = full
  factors.push({
    name: "Savings rate",
    points: srPts,
    max: 25,
    note: `${sr}% of income saved`,
  });

  const eir =
    input.incomeCents > 0 ? Math.round((input.expenseCents / input.incomeCents) * 100) : 100;
  const eirPts = Math.max(0, Math.min(25, Math.round(25 - (eir / 100) * 25)));
  factors.push({
    name: "Expense-to-income",
    points: eirPts,
    max: 25,
    note: `${eir}% of income spent`,
  });

  const dir = debtToIncomeRatio(input.debtCents, input.incomeCents);
  const dirPts = Math.max(0, Math.min(20, 20 - Math.round((dir / 100) * 20)));
  factors.push({
    name: "Debt-to-income",
    points: dirPts,
    max: 20,
    note: dir === 0 ? "No debt tracked" : `${dir}% of income owed`,
  });

  const baPts = Math.round((input.budgetAdherencePct / 100) * 20);
  factors.push({
    name: "Budget adherence",
    points: baPts,
    max: 20,
    note: `${input.budgetAdherencePct}% of budgets on track`,
  });

  const consistencyPts = input.incomeCents > 0 && input.savedCents > 0 ? 10 : 0;
  factors.push({
    name: "Consistency",
    points: consistencyPts,
    max: 10,
    note: consistencyPts > 0 ? "Saved this period" : "No savings recorded yet",
  });

  const score = Math.max(0, Math.min(100, factors.reduce((a, f) => a + f.points, 0)));
  const label = score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Fair" : "Needs work";
  return { score, label, factors };
}

/** Month-over-month percentage change, safe at zero bases. */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}
