import { desc, eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { ApiError, handle, readJson } from "@/lib/http";
import { parseTransactionBody, serializeTransaction, spentByCategory } from "@/lib/serialize";

const { transactions, categories } = schema;

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(async () => {
    const url = new URL(request.url);
    const ordering = url.searchParams.get("ordering");
    const type = url.searchParams.get("type");

    const [rows, spent] = await Promise.all([
      db()
        .select({ tx: transactions, category: categories })
        .from(transactions)
        .innerJoin(categories, eq(transactions.categoryId, categories.id))
        .orderBy(desc(transactions.date), desc(transactions.id)),
      spentByCategory(),
    ]);

    let mapped = rows.map((r) => serializeTransaction(r.tx, r.category, spent.get(r.category.id) ?? 0));
    if (type === "income" || type === "expense") {
      mapped = mapped.filter((t) => t.type === type);
    }
    if (ordering === "-date") {
      // already sorted by date desc; keep as-is
    } else if (ordering === "date") {
      mapped.sort((a, b) => a.date.localeCompare(b.date));
    }
    return Response.json(mapped);
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const parsed = parseTransactionBody(await readJson(request));
    if (!parsed.ok) throw new ApiError(400, parsed.error);

    const [category] = await db()
      .select()
      .from(categories)
      .where(eq(categories.id, parsed.value.categoryId));
    if (!category) throw new ApiError(400, "Category does not exist");

    const [row] = await db()
      .insert(transactions)
      .values({
        categoryId: parsed.value.categoryId,
        amount: parsed.value.amount.toFixed(2),
        type: parsed.value.type,
        date: parsed.value.date,
        note: parsed.value.note,
      })
      .returning();
    const spent = (await spentByCategory()).get(category.id) ?? 0;
    return Response.json(serializeTransaction(row, category, spent), { status: 201 });
  });
}
