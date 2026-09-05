import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, handle, readJson } from "@/lib/http";
import { toCents } from "@/lib/money";
import { isValidDateKey, todayKey } from "@/lib/dates";
import { nextRecurrence } from "@/lib/goals";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  template: z.record(z.string(), z.unknown()), // transaction payload (type/amount/accounts/category/description)
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]),
  nextDate: z.string().refine(isValidDateKey),
});

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const rows = await db()
      .select()
      .from(schema.recurringTransactions)
      .where(eq(schema.recurringTransactions.userId, user.id))
      .orderBy(asc(schema.recurringTransactions.nextDate));
    return Response.json({ success: true, data: rows, message: null });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = createSchema.parse(await readJson(request));

    // validate the template's accounts now, to fail fast
    const t = body.template as Record<string, unknown>;
    const accIds = [t.fromAccountId, t.toAccountId].filter((v): v is number => typeof v === "number");
    if (accIds.length > 0) {
      const owned = await db()
        .select({ id: schema.accounts.id })
        .from(schema.accounts)
        .where(eq(schema.accounts.userId, user.id));
      const ownedIds = new Set(owned.map((o) => o.id));
      for (const id of accIds) {
        if (!ownedIds.has(id)) throw new ApiError(400, "Invalid account in template");
      }
    }

    const [row] = await db()
      .insert(schema.recurringTransactions)
      .values({
        userId: user.id,
        template: body.template,
        frequency: body.frequency,
        nextDate: body.nextDate,
      })
      .returning();

    return Response.json(
      { success: true, data: row, message: "Recurring transaction created" },
      { status: 201 }
    );
  });
}

export async function DELETE(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id)) throw new ApiError(400, "id is required");
    const [row] = await db()
      .update(schema.recurringTransactions)
      .set({ active: false })
      .where(and(eq(schema.recurringTransactions.id, id), eq(schema.recurringTransactions.userId, user.id)))
      .returning({ id: schema.recurringTransactions.id });
    if (!row) throw new ApiError(404, "Recurring transaction not found");
    return Response.json({ success: true, data: row, message: "Recurring transaction stopped" });
  });
}

/**
 * Runs all due recurring items for the user (idempotent: each insert sets
 * lastRunDate and advances nextDate). Called by the client on dashboard load
 * and safe to call repeatedly — only due items execute.
 */
export async function PUT(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const today = todayKey();

    const due = await db()
      .select()
      .from(schema.recurringTransactions)
      .where(
        and(
          eq(schema.recurringTransactions.userId, user.id),
          eq(schema.recurringTransactions.active, true)
        )
      );

    let created = 0;
    for (const r of due) {
      if (r.nextDate > today) continue;
      const template = r.template as Record<string, unknown>;
      const [tx] = await db()
        .insert(schema.transactions)
        .values({
          userId: user.id,
          type: String(template.type ?? "expense"),
          amountCents: toCents(Number(template.amount ?? 0)),
          categoryId: typeof template.categoryId === "number" ? template.categoryId : null,
          fromAccountId: typeof template.fromAccountId === "number" ? template.fromAccountId : null,
          toAccountId: typeof template.toAccountId === "number" ? template.toAccountId : null,
          date: r.nextDate,
          description: String(template.description ?? "Recurring transaction"),
          recurring: true,
        })
        .returning({ id: schema.transactions.id });
      created += 1;
      await db()
        .update(schema.recurringTransactions)
        .set({ lastRunDate: r.nextDate, nextDate: nextRecurrence(r.nextDate, r.frequency as never) })
        .where(eq(schema.recurringTransactions.id, r.id));
      void tx;
    }

    return Response.json({ success: true, data: { created }, message: `${created} recurring transactions generated` });
  });
}
