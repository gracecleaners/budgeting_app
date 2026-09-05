import { and, eq, isNull } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { resolveRange, type RangePreset, monthBounds, todayKey } from "@/lib/dates";
import { toCents } from "@/lib/money";
import {
  accountBalance,
  cashFlow,
  expensesByCategory,
  totalExpenses,
  totalIncome,
  budgetUsage,
  type AccountLike,
  type TxLike,
} from "@/lib/finance";
import { budgetAlertLevel, alertMessage, budgetLabel } from "@/lib/budgets";
import { loadBudgetProgress } from "@/lib/budgets-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const url = new URL(request.url);
    const preset = (url.searchParams.get("range") ?? "month") as RangePreset;
    const range = resolveRange(preset, {
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });

    const [accountRows, allTx] = await Promise.all([
      db()
        .select()
        .from(schema.accounts)
        .where(and(eq(schema.accounts.userId, user.id), eq(schema.accounts.archived, false))),
      db()
        .select()
        .from(schema.transactions)
        .where(and(eq(schema.transactions.userId, user.id), isNull(schema.transactions.deletedAt))),    ]);

    const accountLikes: AccountLike[] = accountRows.map((a) => ({
      id: a.id,
      openingBalanceCents: toCents(a.openingBalance),
    }));
    const txLikes: TxLike[] = allTx.map((t) => ({
      type: t.type,
      amountCents: t.amountCents,
      date: t.date,
      categoryId: t.categoryId,
      fromAccountId: t.fromAccountId,
      toAccountId: t.toAccountId,
    }));

    const inRange = (t: TxLike) =>
      (!range.from || t.date >= range.from) && (!range.to || t.date <= range.to);
    const rangeTx = txLikes.filter(inRange);

    const balances = accountLikes.map((a) => accountBalance(a, txLikes));
    const totalBalance = balances.reduce((a, b) => a + b, 0);

    const income = totalIncome(rangeTx);
    const expenses = totalExpenses(rangeTx);

    // category breakdown for the donut chart
    const catRows = await db()
      .select({ id: schema.categories.id, name: schema.categories.name, kind: schema.categories.kind, color: schema.categories.color })
      .from(schema.categories)
      .where(eq(schema.categories.userId, user.id));
    const byCategory = expensesByCategory(
      rangeTx,
      catRows.map((c) => ({ ...c, kind: c.kind }))
    );

    // cash-flow by month (last 6 months of activity)
    const monthMap = new Map<string, { income: number; expenses: number }>();
    for (const t of txLikes) {
      const mk = t.date.slice(0, 7);
      const entry = monthMap.get(mk) ?? { income: 0, expenses: 0 };
      if (t.type === "income") entry.income += t.amountCents;
      if (t.type === "expense") entry.expenses += t.amountCents;
      monthMap.set(mk, entry);
    }
    const cashflowByMonth = [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, v]) => ({ month, ...v }));

    // upcoming bills placeholder: expense transactions marked recurring this month
    const thisMonth = monthBounds(todayKey());

    // Budget utilization + alerts (Phase 2)
    const budgets = await loadBudgetProgress(user.id);
    const budgetAlerts = budgets
      .filter((b) => b.alert === "warning" || b.alert === "almost_exceeded" || b.alert === "exceeded")
      .map((b) => ({
        budgetId: b.id,
        label: b.name,
        level: b.alert as "exceeded" | "almost_exceeded" | "warning",
        message: alertMessage(b.name, b.percent, (c) => `${user.currency} ${c}`, b.amountCents, b.spentCents),
      }));
    const overall = budgets.find((b) => !b.categoryId && !b.accountId);
    const totalBudgetedCents = budgets.reduce((a, b) => a + b.amountCents, 0);
    const utilization = overall
      ? budgetUsage(overall.amountCents, overall.spentCents)
      : totalBudgetedCents > 0
        ? budgetUsage(
            totalBudgetedCents,
            budgets.reduce((a, b) => a + b.spentCents, 0)
          )
        : null;

    return Response.json({
      success: true,
      data: {
        range: { preset, ...range },
        totals: {
          total_balance_cents: totalBalance,
          income_cents: income,
          expenses_cents: expenses,
          cash_flow_cents: cashFlow(rangeTx),
        },
        accounts: accountRows.map((a, i) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          color: a.color,
          balance_cents: balances[i],
        })),
        expenses_by_category: byCategory,
        cashflow_by_month: cashflowByMonth,
        budgets: budgets.map((b) => ({
          id: b.id,
          name: b.name,
          amountCents: b.amountCents,
          spentCents: b.spentCents,
          remainingCents: b.remainingCents,
          percent: b.percent,
          status: b.status,
          period: b.period,
        })),
        budget_alerts: budgetAlerts,
        budget_utilization: utilization
          ? {
              amountCents: utilization.cents,
              spentCents: utilization.spentCents,
              percent: utilization.percent,
              status: utilization.status,
            }
          : null,
        meta: {
          currency: user.currency,
          current_month: thisMonth,
        },
      },
      message: null,
    });
  });
}
