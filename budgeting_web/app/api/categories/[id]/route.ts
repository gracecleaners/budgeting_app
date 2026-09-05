import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { ApiError, handle, idFrom, readJson } from "@/lib/http";
import { serializeCategory, spentByCategory } from "@/lib/serialize";

const { categories } = schema;

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  return handle(async () => {
    const id = Number((await params).id);
    const [row] = await db().select().from(categories).where(eq(categories.id, id));
    if (!row) throw new ApiError(404, "Not found");
    const spent = (await spentByCategory()).get(row.id) ?? 0;
    return Response.json(serializeCategory(row, spent));
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const id = Number((await params).id);
    const body = await readJson(request);
    const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
    const updates: { name?: string; color?: string } = {};
    if (b.name !== undefined) {
      const name = typeof b.name === "string" ? b.name.trim() : "";
      if (!name) throw new ApiError(400, "name cannot be empty");
      if (name.length > 100) throw new ApiError(400, "name must be at most 100 characters");
      updates.name = name;
    }
    if (b.color !== undefined) {
      if (typeof b.color !== "string" || !/^#[0-9a-fA-F]{6}$/.test(b.color)) {
        throw new ApiError(400, "color must be a hex value like #ff5f57");
      }
      updates.color = b.color;
    }
    const [row] = await db()
      .update(categories)
      .set(updates)
      .where(eq(categories.id, id))
      .returning();
    if (!row) throw new ApiError(404, "Not found");
    const spent = (await spentByCategory()).get(row.id) ?? 0;
    return Response.json(serializeCategory(row, spent));
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return handle(async () => {
    const id = Number((await params).id);
    const [row] = await db().delete(categories).where(eq(categories.id, id)).returning();
    if (!row) throw new ApiError(404, "Not found");
    return new Response(null, { status: 204 });
  });
}
