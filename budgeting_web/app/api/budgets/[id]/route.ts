import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { ApiError, handle, idFrom, readJson } from "@/lib/http";
import { parseBudgetBody, serializeBudget, spentByCategory } from "@/lib/serialize";

const { budgets, categories } = schema;

type Params = { params: Promise<{ id: string }> };

async function loadBudget(id: number) {
  const [row] = await db()
    .select({ budget: budgets, category: categories })
    .from(budgets)
    .innerJoin(categories, eq(budgets.categoryId, categories.id))
    .where(eq(budgets.id, id));
  if (!row) throw new ApiError(404, "Not found");
  return row;
}

export async function GET(_request: Request, { params }: Params) {
  return handle(async () => {
    const id = Number((await params).id);
    const row = await loadBudget(id);
    const spent = (await spentByCategory()).get(row.category.id) ?? 0;
    return Response.json(serializeBudget(row.budget, row.category, spent));
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const id = Number((await params).id);
    const existing = await loadBudget(id);
    const body = await readJson(request);
    const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;

    const updates: { amount?: string; period?: string; categoryId?: number; updatedAt?: Date } = {};
    if (b.amount !== undefined) {
      const amount = Number(b.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new ApiError(400, "amount must be a positive number");
      }
      updates.amount = amount.toFixed(2);
    }
    if (b.period !== undefined) {
      const parsed = parseBudgetBody({ period: b.period, amount: 1, category_id: existing.category.id });
      if (!parsed.ok) throw new ApiError(400, parsed.error);
      updates.period = parsed.value.period;
    }
    if (b.category_id !== undefined || b.categoryId !== undefined) {
      const categoryId = Number(b.category_id ?? b.categoryId);
      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        throw new ApiError(400, "category_id must be a positive integer");
      }
      updates.categoryId = categoryId;
    }

    const [row] = await db()
      .update(budgets)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(budgets.id, id))
      .returning();
    if (!row) throw new ApiError(404, "Not found");
    const [category] = await db()
      .select()
      .from(categories)
      .where(eq(categories.id, row.categoryId));
    const spent = (await spentByCategory()).get(row.categoryId) ?? 0;
    return Response.json(serializeBudget(row, category!, spent));
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return handle(async () => {
    const id = Number((await params).id);
    const [row] = await db().delete(budgets).where(eq(budgets.id, id)).returning();
    if (!row) throw new ApiError(404, "Not found");
    return new Response(null, { status: 204 });
  });
}
