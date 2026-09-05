import { and, eq, isNull } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";
import { toCents } from "@/lib/money";
import { resolveRange, type RangePreset, monthKeyOf } from "@/lib/dates";
import {
  accountBalance,
  expensesByCategory,
  healthScore,
  pctChange,
  totalExpenses,
  totalIncome,
  savingsRate,
  debtToIncomeRatio,
  type AccountLike,
  type TxLike,
} from "@/lib/finance";
import { loadBudgetProgress } from "@/lib/budgets-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const url = new URL(request.url);
    const preset = (url.searchParams.get("range") ?? "6m") as RangePreset;
    const range = resolveRange(preset, {
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });

    const [accountRows, txRows, debtRows, budgets] = await Promise.all([
      db()
        .select()
        .from(schema.accounts)
        .where(and(eq(schema.accounts.userId, user.id), eq(schema.accounts.archived, false))),
      db()
        .select()
        .from(schema.transactions)
        .where(and(eq(schema.transactions.userId, user.id), isNull(schema.transactions.deletedAt))),
      db()
        .select()
        .from(schema.debts)
        .where(and(eq(schema.debts.userId, user.id), eq(schema.debts.archived, false))),
      loadBudgetProgress(user.id),
    ]);

    const accountLikes: AccountLike[] = accountRows.map((a) => ({
      id: a.id,
      openingBalanceCents: toCents(a.openingBalance),
    }));
    const txLikes: TxLike[] = txRows.map((t) => ({
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

    const catRows = await db()
      .select({ id: schema.categories.id, name: schema.categories.name, kind: schema.categories.kind, color: schema.categories.color })
      .from(schema.categories)
      .where(eq(schema.categories.userId, user.id));
    const byCategory = expensesByCategory(rangeTx, catRows);

    // monthly series across the whole range
    const months = new Map<string, { income: number; expenses: number; savings: number }>();
    for (const t of txLikes) {
      const mk = monthKeyOf(t.date);
      const e = months.get(mk) ?? { income: 0, expenses: 0, savings: 0 };
      if (t.type === "income") e.income += t.amountCents;
      else if (t.type === "expense") e.expenses += t.amountCents;
      else if (t.type === "savings") e.savings += t.amountCents;
      months.set(mk, e);
    }
    const series = [...months.entries()].sort(([a], [b]) => a.localeCompare(b));

    const income = totalIncome(rangeTx);
    const expenses = totalExpenses(rangeTx);
    const days = range.from && range.to
      ? Math.max(1, Math.round((new Date(range.to).getTime() - new Date(range.from).getTime()) / 86_400_000))
      : 30;

    // net worth: assets (accounts) minus liabilities (debts owed by me)
    const assetCents = accountLikes.reduce((a, acc) => a + accountBalance(acc, txLikes), 0);
    const liabilityCents = debtRows
      .filter((d) => d.direction === "owed_by_me")
      .reduce((a, d) => a + d.remainingCents, 0);
    const savedThisPeriodCents = series
      .filter(([mk]) => !range.from || mk >= range.from.slice(0, 7))
      .reduce((a, [, v]) => a + v.savings, 0);

    const onTrack = budgets.filter((b) => b.status === "on_track").length;
    const adherencePct = budgets.length > 0 ? Math.round((onTrack / budgets.length) * 100) : 100;

    const health = healthScore({
      incomeCents: income,
      expenseCents: expenses,
      savedCents: savedThisPeriodCents,
      debtCents: liabilityCents,
      budgetAdherencePct: adherencePct,
    });

    const lastMonth = series.length >= 2 ? series[series.length - 2][1] : null;
    const thisMonth = series.length >= 1 ? series[series.length - 1][1] : null;

    return Response.json({
      success: true,
      data: {
        range: { preset, ...range },
        spending: {
          total_cents: expenses,
          average_daily_cents: Math.round(expenses / days),
          by_category: byCategory,
          top_category: byCategory[0] ?? null,
        },
        income: {
          total_cents: income,
          by_month: series.map(([month, v]) => ({ month, cents: v.income })),
          change_pct: thisMonth && lastMonth ? pctChange(thisMonth.income, lastMonth.income) : null,
        },
        savings: {
          rate_pct: savingsRate(income, savedThisPeriodCents),
          total_cents: savedThisPeriodCents,
          change_pct: thisMonth && lastMonth ? pctChange(thisMonth.savings, lastMonth.savings) : null,
        },
        cashflow: {
          series: series.map(([month, v]) => ({ month, income: v.income, expenses: v.expenses, net: v.income - v.expenses })),
          change_pct: thisMonth && lastMonth ? pctChange(thisMonth.income - thisMonth.expenses, lastMonth.income - lastMonth.expenses) : null,
        },
        net_worth: {
          assets_cents: assetCents,
          liabilities_cents: liabilityCents,
          net_cents: assetCents - liabilityCents,
          debt_to_income_pct: debtToIncomeRatio(liabilityCents, income),
        },
        health: {
          score: health.score,
          label: health.label,
          factors: health.factors,
          disclaimer: "Informational only — not professional financial advice.",
        },
        insights: buildInsights({ byCategory, series, income, expenses, savedCents: savedThisPeriodCents }),
      },
      message: null,
    });
  });
}

/** Data-grounded insight lines (spec #16) — no unsupported claims. */
function buildInsights(input: {
  byCategory: { name: string; cents: number }[];
  series: [string, { income: number; expenses: number; savings: number }][];
  income: number;
  expenses: number;
  savedCents: number;
}): string[] {
  const insights: string[] = [];
  const s = input.series;
  if (s.length >= 2) {
    const cur = s[s.length - 1][1];
    const prev = s[s.length - 2][1];
    const diff = pctChange(cur.income - cur.expenses, prev.income - prev.expenses);
    if (diff !== null) {
      insights.push(
        diff >= 0
          ? `Your cash flow improved ${diff}% versus last month.`
          : `Your cash flow dropped ${Math.abs(diff)}% versus last month.`
      );
    }
    const sr = pctChange(cur.savings, prev.savings);
    if (sr !== null && cur.savings > 0) {
      insights.push(`Savings ${sr >= 0 ? "increased" : "decreased"} by ${Math.abs(sr)}% compared with last month.`);
    }
  }
  if (input.byCategory.length > 0) {
    insights.push(`Your biggest spending category is ${input.byCategory[0].name}.`);
  }
  if (input.income > 0) {
    insights.push(`You are saving ${savingsRate(input.income, input.savedCents)}% of your income in this period.`);
  }
  return insights.slice(0, 6);
}
