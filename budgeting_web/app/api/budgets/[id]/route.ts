import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, handle, readJson } from "@/lib/http";
import { toCents } from "@/lib/money";
import { isValidDateKey } from "@/lib/dates";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z
  .object({
    name: z.string().max(100).optional(),
    amount: z.number().positive().optional(),
    period: z.enum(["weekly", "monthly", "custom"]).optional(),
    startDate: z.string().refine(isValidDateKey).nullable().optional(),
    endDate: z.string().refine(isValidDateKey).nullable().optional(),
  })
  .refine(
    (v) => v.period !== "custom" || (v.startDate != null && v.endDate != null),
    { message: "Custom budgets need startDate and endDate" }
  );

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const id = Number((await params).id);
    const body = updateSchema.parse(await readJson(request));

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.amount !== undefined) updates.amountCents = toCents(body.amount);
    if (body.period !== undefined) updates.period = body.period;
    if (body.startDate !== undefined) updates.startDate = body.startDate;
    if (body.endDate !== undefined) updates.endDate = body.endDate;

    const [row] = await db()
      .update(schema.budgets)
      .set(updates)
      .where(and(eq(schema.budgets.id, id), eq(schema.budgets.userId, user.id)))
      .returning({ id: schema.budgets.id });
    if (!row) throw new ApiError(404, "Budget not found");

    return Response.json({ success: true, data: row, message: "Budget updated" });
  });
}

/** Soft delete via archive flag — keeps history for reporting. */
export async function DELETE(_request: Request, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const id = Number((await params).id);
    const [row] = await db()
      .update(schema.budgets)
      .set({ archived: true, updatedAt: new Date() })
      .where(and(eq(schema.budgets.id, id), eq(schema.budgets.userId, user.id)))
      .returning({ id: schema.budgets.id });
    if (!row) throw new ApiError(404, "Budget not found");

    return Response.json({ success: true, data: { id: row.id }, message: "Budget deleted" });
  });
}
