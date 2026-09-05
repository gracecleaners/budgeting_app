import { eq } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";
import { ApiError, handle, readJson } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/ratelimit";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  return handle(async () => {
    if (!rateLimit(`login:${clientIp(request)}`, 10, 60_000)) {
      throw new ApiError(429, "Too many attempts. Try again in a minute.");
    }
    const body = loginSchema.parse(await readJson(request));
    const email = body.email.toLowerCase().trim();

    const [user] = await db().select().from(schema.users).where(eq(schema.users.email, email));
    // Same message for unknown email and wrong password (no account enumeration)
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      throw new ApiError(401, "Invalid email or password");
    }

    await createSession(user.id);
    return Response.json({
      success: true,
      data: { id: user.id, email: user.email, name: user.name, currency: user.currency },
      message: "Logged in",
    });
  });
}
