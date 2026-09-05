import { eq } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { ApiError, handle, readJson } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { DEFAULT_CATEGORIES } from "@/lib/defaults";

const signupSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  name: z.string().min(1).max(120),
  currency: z.string().length(3).default("UGX"),
  country: z.string().max(60).optional(),
});

export async function POST(request: Request) {
  return handle(async () => {
    if (!rateLimit(`signup:${clientIp(request)}`, 5, 60_000)) {
      throw new ApiError(429, "Too many attempts. Try again in a minute.");
    }
    const body = signupSchema.parse(await readJson(request));
    const email = body.email.toLowerCase().trim();

    const [existing] = await db().select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email));
    if (existing) throw new ApiError(409, "An account with this email already exists");

    const [user] = await db()
      .insert(schema.users)
      .values({
        email,
        passwordHash: await hashPassword(body.password),
        name: body.name.trim(),
        currency: body.currency.toUpperCase(),
        country: body.country,
      })
      .returning();

    // Per-user default categories (spec #5) + first-run starter account
    await db().insert(schema.categories).values(
      DEFAULT_CATEGORIES.map((c) => ({
        userId: user.id,
        name: c.name,
        kind: c.kind,
        color: c.color,
      }))
    );

    await createSession(user.id);
    return Response.json(
      {
        success: true,
        data: { id: user.id, email: user.email, name: user.name, currency: user.currency },
        message: "Account created successfully",
      },
      { status: 201 }
    );
  });
}
