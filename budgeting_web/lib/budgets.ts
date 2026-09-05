import { budgetUsage, type BudgetUsage } from "@/lib/finance";

/**
 * Budget period windows and spent calculations (spec #8).
 * Pure functions so they're unit-testable; routes only fetch data.
 */

export type BudgetPeriod = "weekly" | "monthly" | "custom";

export type BudgetRow = {
  id: number;
  categoryId: number | null;
  accountId: number | null;
  name: string;
  amountCents: number;
  period: string;
  startDate: string | null;
  endDate: string | null;
};

export type TxRow = {
  type: string;
  amountCents: number;
  date: string;
  categoryId: number | null;
  fromAccountId: number | null;
};

/** Local date key for "now" (same convention as lib/dates). */
function nowKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * The active spending window for a budget, relative to today.
 * weekly -> current week (Sun-based, matching lib/dates.resolveRange)
 * monthly -> current calendar month
 * custom -> fixed startDate..endDate
 */
export function budgetWindow(budget: BudgetRow, today = nowKey()): { from: string; to: string } {
  if (budget.period === "custom") {
    return { from: budget.startDate ?? "0000-01-01", to: budget.endDate ?? "9999-12-31" };
  }
  const [y, m, d] = today.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");

  if (budget.period === "weekly") {
    const now = new Date(Number(y), Number(m) - 1, Number(d));
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return {
      from: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
      to: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
    };
  }

  // monthly (default)
  const last = new Date(Number(y), Number(m), 0).getDate();
  return { from: `${y}-${pad(Number(m))}-01`, to: `${y}-${pad(Number(m))}-${pad(last)}` };
}

/** Human label: which scope the budget applies to. */
export function budgetLabel(
  budget: BudgetRow,
  categoryName?: string | null,
  accountName?: string | null
): string {
  if (budget.name) return budget.name;
  if (budget.categoryId && categoryName) return categoryName;
  if (budget.accountId && accountName) return accountName;
  return budget.categoryId ? "Category budget" : budget.accountId ? "Account budget" : "Overall";
}

/**
 * Spent amount for a budget in its active window: expense transactions
 * (optionally restricted to one category and/or one source account).
 */
export function spentForBudget(budget: BudgetRow, txs: TxRow[], today = nowKey()): number {
  const { from, to } = budgetWindow(budget, today);
  return txs.reduce((sum, t) => {
    if (t.type !== "expense") return sum;
    if (t.date < from || t.date > to) return sum;
    if (budget.categoryId !== null && t.categoryId !== budget.categoryId) return sum;
    if (budget.accountId !== null && t.fromAccountId !== budget.accountId) return sum;
    return sum + t.amountCents;
  }, 0);
}

export type BudgetProgress = BudgetUsage & {
  window: { from: string; to: string };
  spentCents: number;
};

export function budgetProgress(budget: BudgetRow, txs: TxRow[], today = nowKey()): BudgetProgress {
  const window = budgetWindow(budget, today);
  const spentCents = spentForBudget(budget, txs, today);
  return { ...budgetUsage(budget.amountCents, spentCents), window, spentCents };
}

/**
 * Alert severity for the dashboard notifications list:
 * exceeded > almost_exceeded (>=90%) > warning (>=75%) > ok (>=50%) > null.
 */
export function budgetAlertLevel(percent: number): "exceeded" | "almost_exceeded" | "warning" | "ok" | null {
  if (percent >= 100) return "exceeded";
  if (percent >= 90) return "almost_exceeded";
  if (percent >= 75) return "warning";
  if (percent >= 50) return "ok";
  return null;
}

/** Short human alert line for banners/toasts (spec #8 "alerts"). */
export function alertMessage(
  label: string,
  percent: number,
  fmt: (cents: number) => string,
  budgetCents: number,
  spentCents: number
): string {
  if (percent >= 100) return `${label}: over budget — ${fmt(spentCents)} of ${fmt(budgetCents)}`;
  if (percent >= 90) return `${label}: almost exceeded (${Math.round(percent)}%)`;
  if (percent >= 75) return `${label}: ${Math.round(percent)}% used — watch this budget`;
  return `${label}: ${Math.round(percent)}% used`;
}
