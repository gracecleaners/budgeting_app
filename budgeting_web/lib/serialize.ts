import { and, eq, sql } from "drizzle-orm";

import { db, schema } from "@/lib/db";

const { categories, budgets, transactions } = schema;

export type CategoryJson = {
  id: number;
  name: string;
  color: string;
  created_at: string;
  spent: number;
};

export type BudgetJson = {
  id: number;
  category: CategoryJson;
  category_id: number;
  amount: number;
  period: string;
  created_at: string;
  updated_at: string;
  progress: {
    amount: number;
    spent: number;
    remaining: number;
    percent: number;
  };
};

export type TransactionJson = {
  id: number;
  category: CategoryJson;
  category_id: number;
  amount: number;
  type: "income" | "expense";
  date: string;
  note: string;
  created_at: string;
};

export type SummaryJson = {
  total_income: number;
  total_expenses: number;
  net: number;
  months_tracked: number;
  average_monthly_expense: number;
};

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function num(value: string | number): number {
  return typeof value === "number" ? value : parseFloat(value);
}

/** Per-category expense totals, keyed by category id. */
export async function spentByCategory(): Promise<Map<number, number>> {
  const rows = await db()
    .select({
      categoryId: transactions.categoryId,
      total: sql<string>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(eq(transactions.type, "expense"))
    .groupBy(transactions.categoryId);
  return new Map(rows.map((r) => [r.categoryId, num(r.total)]));
}

export function serializeCategory(
  row: typeof categories.$inferSelect,
  spent: number
): CategoryJson {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    created_at: iso(row.createdAt),
    spent,
  };
}

export function serializeBudget(
  row: typeof budgets.$inferSelect,
  category: typeof categories.$inferSelect,
  spent: number
): BudgetJson {
  const amount = num(row.amount);
  const percent = amount > 0 ? Math.min(100, Math.round((spent / amount) * 1000) / 10) : 0;
  return {
    id: row.id,
    category: serializeCategory(category, spent),
    category_id: category.id,
    amount,
    period: row.period,
    created_at: iso(row.createdAt),
    updated_at: iso(row.updatedAt),
    progress: {
      amount,
      spent,
      remaining: amount - spent,
      percent,
    },
  };
}

export function serializeTransaction(
  row: typeof transactions.$inferSelect,
  category: typeof categories.$inferSelect,
  spent: number
): TransactionJson {
  return {
    id: row.id,
    category: serializeCategory(category, spent),
    category_id: category.id,
    amount: num(row.amount),
    type: row.type as "income" | "expense",
    date: row.date,
    note: row.note,
    created_at: iso(row.createdAt),
  };
}

export async function computeSummary(): Promise<SummaryJson> {
  const [totals] = await db()
    .select({
      income: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.type} = 'income'), 0)`,
      expenses: sql<string>`coalesce(sum(${transactions.amount}) filter (where ${transactions.type} = 'expense'), 0)`,
      months: sql<number>`count(distinct date_trunc('month', ${transactions.date}::date))`,
    })
    .from(transactions);

  const totalIncome = num(totals?.income ?? 0);
  const totalExpenses = num(totals?.expenses ?? 0);
  const monthsTracked = Number(totals?.months ?? 0);
  return {
    total_income: totalIncome,
    total_expenses: totalExpenses,
    net: totalIncome - totalExpenses,
    months_tracked: monthsTracked,
    average_monthly_expense:
      monthsTracked > 0 ? Math.round((totalExpenses / monthsTracked) * 100) / 100 : 0,
  };
}

export type Parsed<T> = { ok: false; error: string } | { ok: true; value: T };

/** Validates and returns { categoryId, amount, type, date, note } or an error message. */
export function parseTransactionBody(body: unknown): Parsed<{
  categoryId: number;
  amount: number;
  type: "income" | "expense";
  date: string;
  note: string;
}> {
  if (typeof body !== "object" || body === null)
    return { ok: false, error: "Invalid body" };
  const b = body as Record<string, unknown>;
  const categoryId = Number(b.category_id ?? b.categoryId);
  const amount = Number(b.amount);
  const type = b.type;
  const date = typeof b.date === "string" ? b.date : "";
  if (!Number.isInteger(categoryId) || categoryId <= 0)
    return { ok: false, error: "category_id must be a positive integer" };
  if (!Number.isFinite(amount) || amount <= 0)
    return { ok: false, error: "amount must be a positive number" };
  if (type !== "income" && type !== "expense")
    return { ok: false, error: 'type must be "income" or "expense"' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    return { ok: false, error: "date must be YYYY-MM-DD" };
  const note = typeof b.note === "string" ? b.note.slice(0, 255) : "";
  return {
    ok: true,
    value: { categoryId, amount, type, date, note },
  };
}

/** Validates and returns { categoryId, amount, period } or an error message. */
export function parseBudgetBody(body: unknown): Parsed<{
  categoryId: number;
  amount: number;
  period: "weekly" | "monthly" | "yearly";
}> {
  if (typeof body !== "object" || body === null)
    return { ok: false, error: "Invalid body" };
  const b = body as Record<string, unknown>;
  const categoryId = Number(b.category_id ?? b.categoryId);
  const amount = Number(b.amount);
  const period = b.period;
  if (!Number.isInteger(categoryId) || categoryId <= 0)
    return { ok: false, error: "category_id must be a positive integer" };
  if (!Number.isFinite(amount) || amount <= 0)
    return { ok: false, error: "amount must be a positive number" };
  if (period !== "weekly" && period !== "monthly" && period !== "yearly")
    return { ok: false, error: 'period must be "weekly", "monthly", or "yearly"' };
  return { ok: true, value: { categoryId, amount, period } };
}

export { and, eq };
