import { and, eq, isNull } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { budgetProgress, budgetLabel, budgetAlertLevel, type BudgetRow, type TxRow } from "@/lib/budgets";

/**
 * Loads all active budgets for a user with computed progress and labels.
 * Server-side companion to the pure lib/budgets.ts functions.
 */
export async function loadBudgetProgress(userId: number) {
  const [budgetRows, categoryRows, accountRows, txRows] = await Promise.all([
    db()
      .select()
      .from(schema.budgets)
      .where(and(eq(schema.budgets.userId, userId), eq(schema.budgets.archived, false))),
    db()
      .select({ id: schema.categories.id, name: schema.categories.name })
      .from(schema.categories)
      .where(eq(schema.categories.userId, userId)),
    db()
      .select({ id: schema.accounts.id, name: schema.accounts.name })
      .from(schema.accounts)
      .where(eq(schema.accounts.userId, userId)),
    db()
      .select({
        type: schema.transactions.type,
        amountCents: schema.transactions.amountCents,
        date: schema.transactions.date,
        categoryId: schema.transactions.categoryId,
        fromAccountId: schema.transactions.fromAccountId,
      })
      .from(schema.transactions)
      .where(and(eq(schema.transactions.userId, userId), isNull(schema.transactions.deletedAt))),
  ]);

  const catName = new Map(categoryRows.map((c) => [c.id, c.name]));
  const accName = new Map(accountRows.map((a) => [a.id, a.name]));
  const txs: TxRow[] = txRows.map((t) => ({
    type: t.type,
    amountCents: t.amountCents,
    date: t.date,
    categoryId: t.categoryId,
    fromAccountId: t.fromAccountId,
  }));

  return budgetRows.map((b) => {
    const row: BudgetRow = {
      id: b.id,
      categoryId: b.categoryId,
      accountId: b.accountId,
      name: b.name,
      amountCents: b.amountCents,
      period: b.period,
      startDate: b.startDate,
      endDate: b.endDate,
    };
    const progress = budgetProgress(row, txs);
    return {
      id: b.id,
      name: budgetLabel(row, b.categoryId ? catName.get(b.categoryId) : null, b.accountId ? accName.get(b.accountId) : null),
      categoryId: b.categoryId,
      accountId: b.accountId,
      amountCents: b.amountCents,
      period: b.period,
      startDate: b.startDate,
      endDate: b.endDate,
      spentCents: progress.spentCents,
      remainingCents: progress.remainingCents,
      percent: progress.percent,
      status: progress.status,
      window: progress.window,
      alert: budgetAlertLevel(progress.percent),
    };
  });
}
