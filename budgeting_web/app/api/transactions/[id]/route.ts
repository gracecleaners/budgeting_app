import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, handle, readJson } from "@/lib/http";
import { toCents } from "@/lib/money";
import { isValidDateKey } from "@/lib/dates";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  amount: z.number().positive().optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  fromAccountId: z.number().int().positive().nullable().optional(),
  toAccountId: z.number().int().positive().nullable().optional(),
  date: z.string().refine(isValidDateKey).optional(),
  description: z.string().max(255).optional(),
  paymentMethod: z.string().max(30).nullable().optional(),
  merchant: z.string().max(120).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export async function GET(_request: Request, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const id = Number((await params).id);
    const [row] = await db()
      .select()
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.id, id),
          eq(schema.transactions.userId, user.id),
          isNull(schema.transactions.deletedAt)
        )
      );
    if (!row) throw new ApiError(404, "Transaction not found");
    return Response.json({ success: true, data: row, message: null });
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const id = Number((await params).id);
    const body = updateSchema.parse(await readJson(request));

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.amount !== undefined) updates.amountCents = toCents(body.amount);
    if (body.categoryId !== undefined) updates.categoryId = body.categoryId;
    if (body.fromAccountId !== undefined) updates.fromAccountId = body.fromAccountId;
    if (body.toAccountId !== undefined) updates.toAccountId = body.toAccountId;
    if (body.date !== undefined) updates.date = body.date;
    if (body.description !== undefined) updates.description = body.description;
    if (body.paymentMethod !== undefined) updates.paymentMethod = body.paymentMethod;
    if (body.merchant !== undefined) updates.merchant = body.merchant;
    if (body.notes !== undefined) updates.notes = body.notes;

    const [row] = await db()
      .update(schema.transactions)
      .set(updates)
      .where(
        and(
          eq(schema.transactions.id, id),
          eq(schema.transactions.userId, user.id),
          isNull(schema.transactions.deletedAt)
        )
      )
      .returning();
    if (!row) throw new ApiError(404, "Transaction not found");
    return Response.json({ success: true, data: row, message: "Transaction updated" });
  });
}

/** Soft delete — preserves the audit trail (spec #27). */
export async function DELETE(_request: Request, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const id = Number((await params).id);
    const [row] = await db()
      .update(schema.transactions)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(schema.transactions.id, id),
          eq(schema.transactions.userId, user.id),
          isNull(schema.transactions.deletedAt)
        )
      )
      .returning({ id: schema.transactions.id });
    if (!row) throw new ApiError(404, "Transaction not found");
    return Response.json({ success: true, data: { id: row.id }, message: "Transaction deleted" });
  });
}
