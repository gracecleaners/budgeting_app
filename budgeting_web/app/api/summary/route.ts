import { handle } from "@/lib/http";
import { computeSummary } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => Response.json(await computeSummary()));
}
