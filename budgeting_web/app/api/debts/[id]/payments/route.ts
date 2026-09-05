import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, handle, readJson } from "@/lib/http";
import { toCents } from "@/lib/money";
import { isValidDateKey } from "@/lib/dates";

type Params = { params: Promise<{ id: string }> };

const paymentSchema = z.object({
  amount: z.number().positive(),
  accountId: z.number().int().positive(),
  date: z.string().refine(isValidDateKey),
  note: z.string().max(255).optional(),
});

export async function GET(_request: Request, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const debtId = Number((await params).id);
    const [debt] = await db()
      .select({ id: schema.debts.id })
      .from(schema.debts)
      .where(and(eq(schema.debts.id, debtId), eq(schema.debts.userId, user.id)));
    if (!debt) throw new ApiError(404, "Debt not found");

    const rows = await db()
      .select()
      .from(schema.debtPayments)
      .where(eq(schema.debtPayments.debtId, debtId))
      .orderBy(desc(schema.debtPayments.date));
    return Response.json({ success: true, data: rows, message: null });
  });
}

/** Records a payment: reduces debt, writes a debt_payment transaction atomically. */
export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const debtId = Number((await params).id);
    const body = paymentSchema.parse(await readJson(request));

    const [debt] = await db()
      .select()
      .from(schema.debts)
      .where(and(eq(schema.debts.id, debtId), eq(schema.debts.userId, user.id)));
    if (!debt) throw new ApiError(404, "Debt not found");

    const [account] = await db()
      .select()
      .from(schema.accounts)
      .where(and(eq(schema.accounts.id, body.accountId), eq(schema.accounts.userId, user.id)));
    if (!account) throw new ApiError(400, "Invalid account reference");

    const cents = toCents(body.amount);
    const isOwedByMe = debt.direction === "owed_by_me";
    if (isOwedByMe && cents > debt.remainingCents) {
      throw new ApiError(400, "Payment exceeds the remaining balance");
    }

    const result = await db().transaction(async (tx) => {
      const [transaction] = await tx
        .insert(schema.transactions)
        .values({
          userId: user.id,
          type: "debt_payment",
          amountCents: cents,
          fromAccountId: isOwedByMe ? body.accountId : null,
          toAccountId: isOwedByMe ? null : body.accountId,
          date: body.date,
          description: `Debt payment: ${debt.name}`,
          notes: body.note ?? null,
        })
        .returning();

      const [payment] = await tx
        .insert(schema.debtPayments)
        .values({
          userId: user.id,
          debtId,
          amountCents: cents,
          accountId: body.accountId,
          date: body.date,
          note: body.note ?? "",
          transactionId: transaction.id,
        })
        .returning();

      // reduce remaining for debts I owe; money owed to me reduces what they owe
      const remaining = isOwedByMe
        ? debt.remainingCents - cents
        : debt.remainingCents + cents;
      await tx
        .update(schema.debts)
        .set({ remainingCents: Math.max(0, remaining) })
        .where(eq(schema.debts.id, debtId));

      return { payment, transactionId: transaction.id };
    });

    return Response.json(
      { success: true, data: result, message: "Payment recorded" },
      { status: 201 }
    );
  });
}
