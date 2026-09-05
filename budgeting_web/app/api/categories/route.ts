import { asc } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { ApiError, handle, readJson } from "@/lib/http";
import { serializeCategory, spentByCategory } from "@/lib/serialize";

const { categories } = schema;

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const [rows, spent] = await Promise.all([
      db().select().from(categories).orderBy(asc(categories.name)),
      spentByCategory(),
    ]);
    return Response.json(rows.map((row) => serializeCategory(row, spent.get(row.id) ?? 0)));
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const body = await readJson(request);
    const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
    const name = typeof b.name === "string" ? b.name.trim() : "";
    const color = typeof b.color === "string" && /^#[0-9a-fA-F]{6}$/.test(b.color) ? b.color : "#ffffff";
    if (!name) throw new ApiError(400, "name is required");
    if (name.length > 100) throw new ApiError(400, "name must be at most 100 characters");
    const [row] = await db().insert(categories).values({ name, color }).returning();
    return Response.json(serializeCategory(row, 0), { status: 201 });
  });
}
