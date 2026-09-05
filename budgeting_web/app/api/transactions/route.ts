import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, handle, pageParams, readJson } from "@/lib/http";
import { toCents } from "@/lib/money";
import { isValidDateKey } from "@/lib/dates";

export const dynamic = "force-dynamic";

const TX_TYPES = ["income", "expense", "transfer", "savings", "debt_payment", "investment"] as const;

const createSchema = z
  .object({
    type: z.enum(TX_TYPES),
    amount: z.number().positive(),
    categoryId: z.number().int().positive().nullable().optional(),
    fromAccountId: z.number().int().positive().nullable().optional(),
    toAccountId: z.number().int().positive().nullable().optional(),
    date: z.string().refine(isValidDateKey, "date must be YYYY-MM-DD"),
    description: z.string().max(255).default(""),
    paymentMethod: z.string().max(30).optional(),
    merchant: z.string().max(120).optional(),
    notes: z.string().max(2000).optional(),
    recurring: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (v.type === "transfer") {
      if (!v.fromAccountId || !v.toAccountId) {
        ctx.addIssue({ code: "custom", message: "Transfer needs fromAccountId and toAccountId" });
      } else if (v.fromAccountId === v.toAccountId) {
        ctx.addIssue({ code: "custom", message: "Transfer accounts must differ" });
      }
      return;
    }
    if (v.type === "income") {
      if (!v.toAccountId) ctx.addIssue({ code: "custom", message: "Income needs toAccountId" });
      return;
    }
    // expense, savings, debt_payment, investment: money leaves an account
    if (!v.fromAccountId) {
      ctx.addIssue({ code: "custom", message: `${v.type} needs fromAccountId` });
    }
  });

export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const url = new URL(request.url);
    const { page, pageSize } = pageParams(request);

    const conds = [eq(schema.transactions.userId, user.id), isNull(schema.transactions.deletedAt)];
    const type = url.searchParams.get("type");
    if (type && (TX_TYPES as readonly string[]).includes(type)) {
      conds.push(eq(schema.transactions.type, type));
    }
    const categoryId = url.searchParams.get("category_id");
    if (categoryId && Number.isInteger(Number(categoryId))) {
      conds.push(eq(schema.transactions.categoryId, Number(categoryId)));
    }
    const accountId = url.searchParams.get("account_id");
    if (accountId && Number.isInteger(Number(accountId))) {
      const accId = Number(accountId);
      conds.push(
        sql`(${schema.transactions.fromAccountId} = ${accId} or ${schema.transactions.toAccountId} = ${accId})`
      );
    }
    const search = url.searchParams.get("q");
    if (search) {
      const like = `%${search.replace(/[%_]/g, "")}%`;
      conds.push(
        sql`(${schema.transactions.description} ilike ${like} or ${schema.transactions.merchant} ilike ${like} or ${schema.transactions.notes} ilike ${like})`
      );
    }
    const from = url.searchParams.get("from");
    if (from && isValidDateKey(from)) conds.push(gte(schema.transactions.date, from));
    const to = url.searchParams.get("to");
    if (to && isValidDateKey(to)) conds.push(lte(schema.transactions.date, to));
    const minAmount = url.searchParams.get("min_amount");
    if (minAmount && Number(minAmount) > 0) {
      conds.push(gte(schema.transactions.amountCents, toCents(Number(minAmount))));
    }

    const where = and(...conds);

    const [{ count }] = await db()
      .select({ count: sql<number>`count(*)` })
      .from(schema.transactions)
      .where(where);

    const rows = await db()
      .select({
        tx: schema.transactions,
        category: schema.categories,
      })
      .from(schema.transactions)
      .leftJoin(schema.categories, eq(schema.transactions.categoryId, schema.categories.id))
      .where(where)
      .orderBy(desc(schema.transactions.date), desc(schema.transactions.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return Response.json({
      success: true,
      data: {
        items: rows.map((r) => ({ ...r.tx, category: r.category })),
        page,
        pageSize,
        total: Number(count),
      },
      message: null,
    });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = createSchema.parse(await readJson(request));

    // Validate referenced accounts belong to the user (data isolation)
    const accountIds = [...new Set([body.fromAccountId, body.toAccountId].filter((v): v is number => typeof v === "number"))];
    if (accountIds.length > 0) {
      const owned = await db()
        .select({ id: schema.accounts.id })
        .from(schema.accounts)
        .where(eq(schema.accounts.userId, user.id));
      const ownedIds = new Set(owned.map((o) => o.id));
      for (const id of accountIds) {
        if (!ownedIds.has(id)) throw new ApiError(400, "Invalid account reference");
      }
    }
    if (body.categoryId) {
      const [cat] = await db()
        .select({ id: schema.categories.id })
        .from(schema.categories)
        .where(and(eq(schema.categories.id, body.categoryId), eq(schema.categories.userId, user.id)));
      if (!cat) throw new ApiError(400, "Invalid category reference");
    }

    const [row] = await db()
      .insert(schema.transactions)
      .values({
        userId: user.id,
        type: body.type,
        amountCents: toCents(body.amount),
        categoryId: body.categoryId ?? null,
        fromAccountId: body.fromAccountId ?? null,
        toAccountId: body.toAccountId ?? null,
        date: body.date,
        description: body.description,
        paymentMethod: body.paymentMethod,
        merchant: body.merchant,
        notes: body.notes,
        recurring: body.recurring,
      })
      .returning();

    return Response.json(
      { success: true, data: row, message: "Transaction created successfully" },
      { status: 201 }
    );
  });
}
