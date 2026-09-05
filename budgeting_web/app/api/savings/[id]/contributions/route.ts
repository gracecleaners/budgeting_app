import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, handle, readJson } from "@/lib/http";
import { toCents } from "@/lib/money";
import { isValidDateKey } from "@/lib/dates";

type Params = { params: Promise<{ id: string }> };

const contribSchema = z.object({
  // positive = contribute into goal, negative = withdraw back to wallet
  amount: z.number().refine((v) => v !== 0, "amount cannot be zero"),
  accountId: z.number().int().positive(),
  date: z.string().refine(isValidDateKey),
  note: z.string().max(255).optional(),
});

export async function GET(_request: Request, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const goalId = Number((await params).id);

    const [goal] = await db()
      .select({ id: schema.savingsGoals.id })
      .from(schema.savingsGoals)
      .where(and(eq(schema.savingsGoals.id, goalId), eq(schema.savingsGoals.userId, user.id)));
    if (!goal) throw new ApiError(404, "Goal not found");

    const rows = await db()
      .select()
      .from(schema.savingsContributions)
      .where(eq(schema.savingsContributions.goalId, goalId))
      .orderBy(desc(schema.savingsContributions.date), desc(schema.savingsContributions.id));

    return Response.json({ success: true, data: rows, message: null });
  });
}

/**
 * Records a contribution or withdrawal and writes the matching "savings"
 * transaction in one DB transaction, so balances and goal progress stay
 * consistent (spec #41 rule 5).
 */
export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const goalId = Number((await params).id);
    const body = contribSchema.parse(await readJson(request));

    const [goal] = await db()
      .select()
      .from(schema.savingsGoals)
      .where(and(eq(schema.savingsGoals.id, goalId), eq(schema.savingsGoals.userId, user.id)));
    if (!goal) throw new ApiError(404, "Goal not found");

    const [account] = await db()
      .select()
      .from(schema.accounts)
      .where(and(eq(schema.accounts.id, body.accountId), eq(schema.accounts.userId, user.id)));
    if (!account) throw new ApiError(400, "Invalid account reference");

    const cents = toCents(Math.abs(body.amount));
    const isWithdrawal = body.amount < 0;

    const savedRows = await db()
      .select({ total: schema.savingsContributions.amountCents })
      .from(schema.savingsContributions)
      .where(eq(schema.savingsContributions.goalId, goalId));
    const savedCents = savedRows.reduce((a, r) => a + r.total, 0);
    if (isWithdrawal && cents > savedCents) {
      throw new ApiError(400, "Withdrawal exceeds the amount saved in this goal");
    }

    const result = await db().transaction(async (tx) => {
      // savings-type tx: contributes FROM the wallet; withdrawals run the
      // reverse direction (to the wallet) so balances move correctly
      const [transaction] = await tx
        .insert(schema.transactions)
        .values({
          userId: user.id,
          type: "savings",
          amountCents: cents,
          fromAccountId: isWithdrawal ? null : body.accountId,
          toAccountId: isWithdrawal ? body.accountId : null,
          date: body.date,
          description: `${isWithdrawal ? "Withdrawal from" : "Contribution to"} ${goal.name}`,
          notes: body.note ?? null,
        })
        .returning();

      const [contribution] = await tx
        .insert(schema.savingsContributions)
        .values({
          userId: user.id,
          goalId,
          amountCents: isWithdrawal ? -cents : cents,
          accountId: body.accountId,
          date: body.date,
          note: body.note ?? "",
          transactionId: transaction.id,
        })
        .returning();

      return { contribution, transactionId: transaction.id };
    });

    return Response.json(
      { success: true, data: result, message: isWithdrawal ? "Withdrawal recorded" : "Contribution recorded" },
      { status: 201 }
    );
  });
}
