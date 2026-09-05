import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, handle, readJson } from "@/lib/http";
import { toCents } from "@/lib/money";
import { isValidDateKey } from "@/lib/dates";
import { goalProgress } from "@/lib/goals";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  targetAmount: z.number().positive(),
  targetDate: z.string().refine(isValidDateKey).nullable().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  description: z.string().max(500).optional(),
});

export async function GET() {
  return handle(async () => {
    const user = await requireUser();

    const [goalRows, contribRows] = await Promise.all([
      db()
        .select()
        .from(schema.savingsGoals)
        .where(and(eq(schema.savingsGoals.userId, user.id), eq(schema.savingsGoals.archived, false))),
      db()
        .select({ goalId: schema.savingsContributions.goalId, amountCents: schema.savingsContributions.amountCents })
        .from(schema.savingsContributions)
        .where(eq(schema.savingsContributions.userId, user.id)),
    ]);

    const savedByGoal = new Map<number, number>();
    for (const c of contribRows) {
      savedByGoal.set(c.goalId, (savedByGoal.get(c.goalId) ?? 0) + c.amountCents);
    }

    const data = goalRows.map((g) => {
      const savedCents = savedByGoal.get(g.id) ?? 0;
      const progress = goalProgress({
        targetCents: g.targetCents,
        savedCents,
        targetDate: g.targetDate,
      });
      return {
        id: g.id,
        name: g.name,
        targetCents: g.targetCents,
        savedCents,
        targetDate: g.targetDate,
        priority: g.priority,
        description: g.description,
        ...progress,
      };
    });

    return Response.json({ success: true, data, message: null });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = createSchema.parse(await readJson(request));

    const [row] = await db()
      .insert(schema.savingsGoals)
      .values({
        userId: user.id,
        name: body.name.trim(),
        targetCents: toCents(body.targetAmount),
        targetDate: body.targetDate ?? null,
        priority: body.priority,
        description: body.description,
      })
      .returning();

    return Response.json(
      { success: true, data: row, message: "Goal created" },
      { status: 201 }
    );
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
    if (b.targetAmount !== undefined) updates.targetCents = toCents(Number(b.targetAmount));
    if (b.targetDate !== undefined) updates.targetDate = b.targetDate;
    if (b.priority !== undefined) updates.priority = b.priority;
    if (b.description !== undefined) updates.description = b.description;
    if (b.archived !== undefined) updates.archived = Boolean(b.archived);

    const [row] = await db()
      .update(schema.savingsGoals)
      .set(updates)
      .where(and(eq(schema.savingsGoals.id, id), eq(schema.savingsGoals.userId, user.id)))
      .returning();
    if (!row) throw new ApiError(404, "Goal not found");
    return Response.json({ success: true, data: row, message: "Goal updated" });
  });
}

// keep isNull import referenced for future soft-delete support
void isNull;
