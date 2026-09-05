import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, handle, readJson } from "@/lib/http";
import { toCents } from "@/lib/money";
import { isValidDateKey } from "@/lib/dates";
import { loadBudgetProgress } from "@/lib/budgets-server";

export const dynamic = "force-dynamic";

const createSchema = z
  .object({
    name: z.string().max(100).optional(),
    categoryId: z.number().int().positive().nullable().optional(),
    accountId: z.number().int().positive().nullable().optional(),
    amount: z.number().positive(),
    period: z.enum(["weekly", "monthly", "custom"]).default("monthly"),
    startDate: z.string().refine(isValidDateKey).nullable().optional(),
    endDate: z.string().refine(isValidDateKey).nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.period === "custom") {
      if (!v.startDate || !v.endDate) {
        ctx.addIssue({ code: "custom", message: "Custom budgets need startDate and endDate" });
      } else if (v.startDate > v.endDate) {
        ctx.addIssue({ code: "custom", message: "startDate must be before endDate" });
      }
    }
    if (!v.categoryId && !v.accountId && !v.name) {
      ctx.addIssue({
        code: "custom",
        message: "Overall budgets need a name to identify them",
      });
    }
  });

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const budgets = await loadBudgetProgress(user.id);
    return Response.json({ success: true, data: budgets, message: null });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = createSchema.parse(await readJson(request));

    // ownership checks for referenced category/account (isolation)
    if (body.categoryId) {
      const [cat] = await db()
        .select({ id: schema.categories.id })
        .from(schema.categories)
        .where(and(eq(schema.categories.id, body.categoryId), eq(schema.categories.userId, user.id)));
      if (!cat) throw new ApiError(400, "Invalid category reference");
    }
    if (body.accountId) {
      const [acc] = await db()
        .select({ id: schema.accounts.id, userId: schema.accounts.userId })
        .from(schema.accounts)
        .where(eq(schema.accounts.id, body.accountId));
      if (!acc || acc.userId !== user.id) throw new ApiError(400, "Invalid account reference");
    }

    const [row] = await db()
      .insert(schema.budgets)
      .values({
        userId: user.id,
        name: body.name?.trim() ?? "",
        categoryId: body.categoryId ?? null,
        accountId: body.accountId ?? null,
        amountCents: toCents(body.amount),
        period: body.period,
        startDate: body.startDate ?? null,
        endDate: body.endDate ?? null,
      })
      .returning();

    return Response.json(
      { success: true, data: row, message: "Budget created successfully" },
      { status: 201 }
    );
  });
}

