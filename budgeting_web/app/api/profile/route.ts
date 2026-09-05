import { eq } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, handle, readJson } from "@/lib/http";
import { toCents } from "@/lib/money";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  currency: z.string().length(3).optional(),
  country: z.string().max(60).nullable().optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  monthlyIncomeTarget: z.number().min(0).nullable().optional(),
});

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const [row] = await db()
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        currency: schema.users.currency,
        country: schema.users.country,
        theme: schema.users.theme,
        monthlyIncomeTargetCents: schema.users.monthlyIncomeTargetCents,
      })
      .from(schema.users)
      .where(eq(schema.users.id, user.id));
    return Response.json({ success: true, data: row, message: null });
  });
}

export async function PATCH(request: Request) {
  return handle(async () => {
    const session = await requireUser();
    const body = updateSchema.parse(await readJson(request));

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.currency !== undefined) updates.currency = body.currency.toUpperCase();
    if (body.country !== undefined) updates.country = body.country;
    if (body.theme !== undefined) updates.theme = body.theme;
    if (body.monthlyIncomeTarget !== undefined) {
      updates.monthlyIncomeTargetCents = body.monthlyIncomeTarget === null ? null : toCents(body.monthlyIncomeTarget);
    }

    const [row] = await db()
      .update(schema.users)
      .set(updates)
      .where(eq(schema.users.id, session.id))
      .returning({
        id: schema.users.id,
        name: schema.users.name,
        currency: schema.users.currency,
        theme: schema.users.theme,
      });
    if (!row) throw new ApiError(404, "User not found");
    return Response.json({ success: true, data: row, message: "Profile updated" });
  });
}
