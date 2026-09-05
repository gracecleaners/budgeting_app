import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, handle, readJson } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
const MAX_BYTES = 2 * 1024 * 1024; // 2MB per receipt (base64 column)

const uploadSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().refine((m) => ALLOWED.includes(m), "Only JPEG, PNG, WebP, HEIC, or PDF"),
  dataBase64: z.string().max(Math.ceil(MAX_BYTES * 1.4)), // base64 overhead
});

export async function GET(_request: Request, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const txId = Number((await params).id);

    // ownership: the transaction must belong to the user
    const [tx] = await db()
      .select({ id: schema.transactions.id })
      .from(schema.transactions)
      .where(and(eq(schema.transactions.id, txId), eq(schema.transactions.userId, user.id)));
    if (!tx) throw new ApiError(404, "Transaction not found");

    const rows = await db()
      .select({
        id: schema.attachments.id,
        filename: schema.attachments.filename,
        mimeType: schema.attachments.mimeType,
        sizeBytes: schema.attachments.sizeBytes,
        createdAt: schema.attachments.createdAt,
      })
      .from(schema.attachments)
      .where(eq(schema.attachments.transactionId, txId))
      .orderBy(desc(schema.attachments.id));

    return Response.json({ success: true, data: rows, message: null });
  });
}

export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const txId = Number((await params).id);

    const [tx] = await db()
      .select({ id: schema.transactions.id })
      .from(schema.transactions)
      .where(and(eq(schema.transactions.id, txId), eq(schema.transactions.userId, user.id)));
    if (!tx) throw new ApiError(404, "Transaction not found");

    const body = uploadSchema.parse(await readJson(request));
    const sizeBytes = Math.floor((body.dataBase64.length * 3) / 4);
    if (sizeBytes > MAX_BYTES) {
      throw new ApiError(413, "Receipt is too large (max 2MB)");
    }

    const [row] = await db()
      .insert(schema.attachments)
      .values({
        userId: user.id,
        transactionId: txId,
        filename: body.filename.slice(0, 255),
        mimeType: body.mimeType,
        sizeBytes,
        data: body.dataBase64,
      })
      .returning({ id: schema.attachments.id, filename: schema.attachments.filename });

    return Response.json(
      { success: true, data: row, message: "Receipt attached" },
      { status: 201 }
    );
  });
}
