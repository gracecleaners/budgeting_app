import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, handle, readJson } from "@/lib/http";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  kind: z.enum(["income", "expense"]).default("expense"),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export async function GET(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const kind = new URL(request.url).searchParams.get("kind");
    const conds = [eq(schema.categories.userId, user.id), eq(schema.categories.archived, false)];
    if (kind === "income" || kind === "expense") conds.push(eq(schema.categories.kind, kind));

    const rows = await db()
      .select({
        id: schema.categories.id,
        name: schema.categories.name,
        kind: schema.categories.kind,
        color: schema.categories.color,
        spentCents: sql<number>`(
          select coalesce(sum(t.amount_cents), 0) from transactions t
          where t.category_id = ${schema.categories.id} and t.type = 'expense' and t.deleted_at is null
        )`,
      })
      .from(schema.categories)
      .where(and(...conds))
      .orderBy(asc(schema.categories.name));

    return Response.json({
      success: true,
      data: rows.map((r) => ({ ...r, spentCents: Number(r.spentCents) })),
      message: null,
    });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = createSchema.parse(await readJson(request));
    const [row] = await db()
      .insert(schema.categories)
      .values({
        userId: user.id,
        name: body.name.trim(),
        kind: body.kind,
        color: body.color,
      })
      .returning();
    return Response.json(
      { success: true, data: row, message: "Category created" },
      { status: 201 }
    );
  });
}
