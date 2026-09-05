import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, handle, readJson } from "@/lib/http";
import { toCents } from "@/lib/money";
import { isValidDateKey } from "@/lib/dates";
import { monthlyCost } from "@/lib/goals";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  amount: z.number().positive(),
  cycle: z.enum(["weekly", "monthly", "quarterly", "yearly"]).default("monthly"),
  nextPaymentDate: z.string().refine(isValidDateKey),
  categoryId: z.number().int().positive().nullable().optional(),
  accountId: z.number().int().positive().nullable().optional(),
});

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const rows = await db()
      .select()
      .from(schema.subscriptions)
      .where(eq(schema.subscriptions.userId, user.id))
      .orderBy(asc(schema.subscriptions.nextPaymentDate));

    const active = rows.filter((r) => r.status === "active");
    const monthlyTotalCents = active.reduce((a, r) => a + monthlyCost(r.amountCents, r.cycle), 0);
    const today = new Date().toISOString().slice(0, 10);
    const weekAhead = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);

    return Response.json({
      success: true,
      data: {
        items: rows.map((r) => ({ ...r, monthlyCostCents: monthlyCost(r.amountCents, r.cycle) })),
        totals: {
          monthly_cost_cents: monthlyTotalCents,
          annual_cost_cents: monthlyTotalCents * 12,
          due_this_week: active.filter(
            (r) => r.nextPaymentDate >= today && r.nextPaymentDate <= weekAhead
          ).length,
        },
      },
      message: null,
    });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = createSchema.parse(await readJson(request));

    const [row] = await db()
      .insert(schema.subscriptions)
      .values({
        userId: user.id,
        name: body.name.trim(),
        amountCents: toCents(body.amount),
        cycle: body.cycle,
        nextPaymentDate: body.nextPaymentDate,
        categoryId: body.categoryId ?? null,
        accountId: body.accountId ?? null,
      })
      .returning();

    return Response.json({ success: true, data: row, message: "Subscription created" }, { status: 201 });
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
    if (b.status !== undefined) {
      if (!["active", "paused", "cancelled"].includes(String(b.status))) {
        throw new ApiError(400, "Invalid status");
      }
      updates.status = b.status;
    }
    if (b.amount !== undefined) updates.amountCents = toCents(Number(b.amount));
    if (b.nextPaymentDate !== undefined) {
      if (!isValidDateKey(String(b.nextPaymentDate))) throw new ApiError(400, "Invalid date");
      updates.nextPaymentDate = b.nextPaymentDate;
    }

    const [row] = await db()
      .update(schema.subscriptions)
      .set(updates)
      .where(and(eq(schema.subscriptions.id, id), eq(schema.subscriptions.userId, user.id)))
      .returning();
    if (!row) throw new ApiError(404, "Subscription not found");
    return Response.json({ success: true, data: row, message: "Subscription updated" });
  });
}
