import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, handle, readJson } from "@/lib/http";
import { toCents } from "@/lib/money";
import { isValidDateKey } from "@/lib/dates";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  direction: z.enum(["owed_by_me", "owed_to_me"]).default("owed_by_me"),
  originalAmount: z.number().positive(),
  remainingAmount: z.number().min(0).optional(),
  interestRate: z.number().min(0).max(100).nullable().optional(),
  dueDate: z.string().refine(isValidDateKey).nullable().optional(),
  minimumPayment: z.number().min(0).nullable().optional(),
  lender: z.string().max(120).nullable().optional(),
  paymentFrequency: z.enum(["weekly", "monthly", "quarterly", "yearly"]).default("monthly"),
  accountId: z.number().int().positive().nullable().optional(),
});

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const rows = await db()
      .select()
      .from(schema.debts)
      .where(and(eq(schema.debts.userId, user.id), eq(schema.debts.archived, false)))
      .orderBy(asc(schema.debts.name));

    const paidRows = await db()
      .select({ debtId: schema.debtPayments.debtId, amountCents: schema.debtPayments.amountCents })
      .from(schema.debtPayments)
      .where(eq(schema.debtPayments.userId, user.id));
    const paidByDebt = new Map<number, number>();
    for (const p of paidRows) {
      paidByDebt.set(p.debtId, (paidByDebt.get(p.debtId) ?? 0) + p.amountCents);
    }

    const data = rows.map((d) => ({
      ...d,
      paidCents: d.originalCents - d.remainingCents,
      paidFromPaymentsCents: paidByDebt.get(d.id) ?? 0,
      progressPercent: d.originalCents > 0 ? Math.round(((d.originalCents - d.remainingCents) / d.originalCents) * 100) : 0,
    }));

    return Response.json({ success: true, data, message: null });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = createSchema.parse(await readJson(request));

    const [row] = await db()
      .insert(schema.debts)
      .values({
        userId: user.id,
        name: body.name.trim(),
        direction: body.direction,
        originalCents: toCents(body.originalAmount),
        remainingCents: toCents(body.remainingAmount ?? body.originalAmount),
        interestRate: body.interestRate != null ? String(body.interestRate) : null,
        dueDate: body.dueDate ?? null,
        minimumCents: body.minimumPayment != null ? toCents(body.minimumPayment) : null,
        lender: body.lender,
        paymentFrequency: body.paymentFrequency,
        accountId: body.accountId ?? null,
      })
      .returning();

    return Response.json({ success: true, data: row, message: "Debt created" }, { status: 201 });
  });
}

export async function PATCH(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = await readJson(request);
    const b = body as Record<string, unknown>;
    const id = Number(b.id);
    if (!Number.isInteger(id)) throw new ApiError(400, "id is required");

    const updates: Record<string, unknown> = {};
    if (b.name !== undefined) updates.name = String(b.name).slice(0, 120);
    if (b.remainingAmount !== undefined) updates.remainingCents = toCents(Number(b.remainingAmount));
    if (b.dueDate !== undefined) updates.dueDate = b.dueDate;
    if (b.archived !== undefined) updates.archived = Boolean(b.archived);

    const [row] = await db()
      .update(schema.debts)
      .set(updates)
      .where(and(eq(schema.debts.id, id), eq(schema.debts.userId, user.id)))
      .returning();
    if (!row) throw new ApiError(404, "Debt not found");
    return Response.json({ success: true, data: row, message: "Debt updated" });
  });
}
