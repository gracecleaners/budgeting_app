import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    return Response.json({ success: true, data: user, message: null });
  });
}
