import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, handle, readJson } from "@/lib/http";
import { toCents } from "@/lib/money";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["cash", "bank", "mobile_money", "savings", "investment", "digital_wallet"]).default("cash"),
  openingBalance: z.number().default(0),
  currency: z.string().length(3).optional(),
  institution: z.string().max(120).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const rows = await db()
      .select()
      .from(schema.accounts)
      .where(and(eq(schema.accounts.userId, user.id), eq(schema.accounts.archived, false)))
      .orderBy(asc(schema.accounts.createdAt));
    return Response.json({ success: true, data: rows, message: null });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = createSchema.parse(await readJson(request));

    const [row] = await db()
      .insert(schema.accounts)
      .values({
        userId: user.id,
        name: body.name.trim(),
        type: body.type,
        openingBalance: toCents(body.openingBalance).toString(),
        currency: body.currency ?? user.currency,
        institution: body.institution,
        color: body.color,
      })
      .returning();

    return Response.json(
      { success: true, data: row, message: "Account created successfully" },
      { status: 201 }
    );
  });
}

export async function PATCH(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = await readJson(request);
    const id = Number((body as Record<string, unknown>).id);
    if (!Number.isInteger(id)) throw new ApiError(400, "id is required");

    const updates: Record<string, unknown> = {};
    const b = body as Record<string, unknown>;
    if (b.name !== undefined) updates.name = String(b.name).slice(0, 100);
    if (b.institution !== undefined) updates.institution = b.institution;
    if (b.archived !== undefined) updates.archived = Boolean(b.archived);
    if (b.openingBalance !== undefined) {
      updates.openingBalance = toCents(Number(b.openingBalance)).toString();
    }

    const [row] = await db()
      .update(schema.accounts)
      .set(updates)
      .where(and(eq(schema.accounts.id, id), eq(schema.accounts.userId, user.id)))
      .returning();
    if (!row) throw new ApiError(404, "Account not found");
    return Response.json({ success: true, data: row, message: "Account updated" });
  });
}
