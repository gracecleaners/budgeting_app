import { and, eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, handle } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

/** Streams the attachment back as a file (spec #25). */
export async function GET(_request: Request, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const id = Number((await params).id);

    const [row] = await db()
      .select()
      .from(schema.attachments)
      .where(and(eq(schema.attachments.id, id), eq(schema.attachments.userId, user.id)));
    if (!row) throw new ApiError(404, "Attachment not found");

    const bytes = Buffer.from(row.data, "base64");
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": row.mimeType,
        "Content-Disposition": `inline; filename="${row.filename.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return handle(async () => {
    const user = await requireUser();
    const id = Number((await params).id);
    const [row] = await db()
      .delete(schema.attachments)
      .where(and(eq(schema.attachments.id, id), eq(schema.attachments.userId, user.id)))
      .returning({ id: schema.attachments.id });
    if (!row) throw new ApiError(404, "Attachment not found");
    return Response.json({ success: true, data: { id: row.id }, message: "Attachment deleted" });
  });
}
