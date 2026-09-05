import { eq } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/lib/db";
import { hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { ApiError, handle, readJson } from "@/lib/http";

const changeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "New password must be at least 8 characters").max(200),
});

export async function POST(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = changeSchema.parse(await readJson(request));

    const [row] = await db().select().from(schema.users).where(eq(schema.users.id, user.id));
    if (!row || !(await verifyPassword(body.currentPassword, row.passwordHash))) {
      throw new ApiError(400, "Current password is incorrect");
    }

    await db()
      .update(schema.users)
      .set({ passwordHash: await hashPassword(body.newPassword) })
      .where(eq(schema.users.id, user.id));

    return Response.json({ success: true, data: null, message: "Password updated" });
  });
}
