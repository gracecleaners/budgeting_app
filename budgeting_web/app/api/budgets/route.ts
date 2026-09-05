import { and, asc, eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { ApiError, handle, readJson } from "@/lib/http";
import { parseBudgetBody, serializeBudget, spentByCategory } from "@/lib/serialize";

const { budgets, categories } = schema;

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const [rows, spent, cats] = await Promise.all([
      db()
        .select({ budget: budgets, category: categories })
        .from(budgets)
        .innerJoin(categories, eq(budgets.categoryId, categories.id))
        .orderBy(asc(categories.name)),
      spentByCategory(),
      db().select().from(categories),
    ]);
    return Response.json(
      rows.map((r) => serializeBudget(r.budget, r.category, spent.get(r.category.id) ?? 0))
    );
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const parsed = parseBudgetBody(await readJson(request));
    if (!parsed.ok) throw new ApiError(400, parsed.error);

    // Django had unique_together (category, period); mirror that behavior
    const [existing] = await db()
      .select({ id: budgets.id })
      .from(budgets)
      .where(
        and(
          eq(budgets.categoryId, parsed.value.categoryId),
          eq(budgets.period, parsed.value.period)
        )
      );
    if (existing) {
      throw new ApiError(
        400,
        "A budget for this category and period already exists"
      );
    }

    const [row] = await db()
      .insert(budgets)
      .values({
        categoryId: parsed.value.categoryId,
        amount: parsed.value.amount.toFixed(2),
        period: parsed.value.period,
      })
      .returning();
    const [category] = await db()
      .select()
      .from(categories)
      .where(eq(categories.id, row.categoryId));
    if (!category) throw new ApiError(400, "Category does not exist");
    const spent = (await spentByCategory()).get(category.id) ?? 0;
    return Response.json(serializeBudget(row, category, spent), { status: 201 });
  });
}
