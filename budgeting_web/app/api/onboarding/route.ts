import { eq } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, handle, readJson } from "@/lib/http";
import { toCents } from "@/lib/money";
import { isValidDateKey } from "@/lib/dates";

const schemaBody = z.object({
  currency: z.string().length(3),
  monthlyIncome: z.number().min(0).optional(),
  accounts: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        type: z.enum(["cash", "bank", "mobile_money", "savings", "investment", "digital_wallet"]),
        openingBalance: z.number().min(0),
        institution: z.string().max(120).optional(),
      })
    )
    .max(6)
    .optional(),
  goals: z
    .array(
      z.object({
        name: z.string().min(1).max(120),
        targetAmount: z.number().positive(),
        targetDate: z.string().refine(isValidDateKey).nullable().optional(),
        priority: z.enum(["low", "medium", "high"]).default("medium"),
      })
    )
    .max(6)
    .optional(),
  budgets: z
    .array(
      z.object({
        categoryId: z.number().int().positive(),
        amount: z.number().positive(),
        period: z.enum(["weekly", "monthly"]).default("monthly"),
      })
    )
    .max(10)
    .optional(),
});



export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = schemaBody.parse(await readJson(request));

    // Validate category ownership up front so the transaction can't half-run
    if (body.budgets?.length) {
      const owned = await db()
        .select({ id: schema.categories.id })
        .from(schema.categories)
        .where(eq(schema.categories.userId, user.id));
      const ids = new Set(owned.map((c) => c.id));
      for (const b of body.budgets) {
        if (!ids.has(b.categoryId)) throw new ApiError(400, "Invalid category in budgets");
      }
    }

    const result = await db().transaction(async (tx) => {
      // profile prefs
      await tx
        .update(schema.users)
        .set({
          currency: body.currency.toUpperCase(),
          monthlyIncomeTargetCents: body.monthlyIncome ? toCents(body.monthlyIncome) : null,
          onboardedAt: new Date(),
        })
        .where(eq(schema.users.id, user.id));

      if (body.accounts?.length) {
        await tx.insert(schema.accounts).values(
          body.accounts.map((a) => ({
            userId: user.id,
            name: a.name.trim(),
            type: a.type,
            openingBalance: toCents(a.openingBalance).toString(),
            currency: body.currency.toUpperCase(),
            institution: a.institution,
          }))
        );
      }

      if (body.goals?.length) {
        await tx.insert(schema.savingsGoals).values(
          body.goals.map((g) => ({
            userId: user.id,
            name: g.name.trim(),
            targetCents: toCents(g.targetAmount),
            targetDate: g.targetDate ?? null,
            priority: g.priority,
          }))
        );
      }

      if (body.budgets?.length) {
        await tx.insert(schema.budgets).values(
          body.budgets.map((b) => ({
            userId: user.id,
            categoryId: b.categoryId,
            amountCents: toCents(b.amount),
            period: b.period,
          }))
        );
      }

      return { ok: true };
    });

    return Response.json({
      success: true,
      data: result,
      message: "Onboarding complete",
    });
  });
}
