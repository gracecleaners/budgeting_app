import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { ApiError, handle, readJson } from "@/lib/http";
import { parseTransactionBody, serializeTransaction, spentByCategory } from "@/lib/serialize";

const { transactions, categories } = schema;

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  return handle(async () => {
    const id = Number((await params).id);
    const [row] = await db()
      .select({ tx: transactions, category: categories })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(eq(transactions.id, id));
    if (!row) throw new ApiError(404, "Not found");
    const spent = (await spentByCategory()).get(row.category.id) ?? 0;
    return Response.json(serializeTransaction(row.tx, row.category, spent));
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const id = Number((await params).id);
    const [existing] = await db().select().from(transactions).where(eq(transactions.id, id));
    if (!existing) throw new ApiError(404, "Not found");

    const body = await readJson(request);
    const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;

    const updates: Partial<typeof transactions.$inferInsert> = {};
    if (b.amount !== undefined) {
      const amount = Number(b.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new ApiError(400, "amount must be a positive number");
      }
      updates.amount = amount.toFixed(2);
    }
    if (b.type !== undefined) {
      if (b.type !== "income" && b.type !== "expense") {
        throw new ApiError(400, 'type must be "income" or "expense"');
      }
      updates.type = b.type;
    }
    if (b.date !== undefined) {
      const date = typeof b.date === "string" ? b.date : "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new ApiError(400, "date must be YYYY-MM-DD");
      }
      updates.date = date;
    }
    if (b.note !== undefined) {
      if (typeof b.note !== "string") throw new ApiError(400, "note must be a string");
      updates.note = b.note.slice(0, 255);
    }
    if (b.category_id !== undefined || b.categoryId !== undefined) {
      const categoryId = Number(b.category_id ?? b.categoryId);
      if (!Number.isInteger(categoryId) || categoryId <= 0) {
        throw new ApiError(400, "category_id must be a positive integer");
      }
      const [category] = await db().select().from(categories).where(eq(categories.id, categoryId));
      if (!category) throw new ApiError(400, "Category does not exist");
      updates.categoryId = categoryId;
    }

    const [row] = await db()
      .update(transactions)
      .set(updates)
      .where(eq(transactions.id, id))
      .returning();
    if (!row) throw new ApiError(404, "Not found");
    const [category] = await db()
      .select()
      .from(categories)
      .where(eq(categories.id, row.categoryId));
    const spent = (await spentByCategory()).get(row.categoryId) ?? 0;
    return Response.json(serializeTransaction(row, category!, spent));
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return handle(async () => {
    const id = Number((await params).id);
    const [row] = await db().delete(transactions).where(eq(transactions.id, id)).returning();
    if (!row) throw new ApiError(404, "Not found");
    return new Response(null, { status: 204 });
  });
}
