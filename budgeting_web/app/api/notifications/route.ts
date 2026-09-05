import { and, desc, eq, isNull } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ApiError, handle, readJson } from "@/lib/http";
import { loadBudgetProgress } from "@/lib/budgets-server";
import { todayKey } from "@/lib/dates";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const rows = await db()
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, user.id))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(50);
    const unread = rows.filter((r) => !r.readAt).length;
    return Response.json({ success: true, data: { items: rows, unread }, message: null });
  });
}

/** Mark one (id in body) or all notifications as read. */
export async function PATCH(request: Request) {
  return handle(async () => {
    const user = await requireUser();
    const body = await readJson(request);
    const b = body as Record<string, unknown>;

    if (b.all) {
      await db()
        .update(schema.notifications)
        .set({ readAt: new Date() })
        .where(and(eq(schema.notifications.userId, user.id), isNull(schema.notifications.readAt)));
      return Response.json({ success: true, data: null, message: "All marked as read" });
    }

    const id = Number(b.id);
    if (!Number.isInteger(id)) throw new ApiError(400, "id is required");
    await db()
      .update(schema.notifications)
      .set({ readAt: new Date() })
      .where(and(eq(schema.notifications.id, id), eq(schema.notifications.userId, user.id)));
    return Response.json({ success: true, data: null, message: "Marked as read" });
  });
}

/**
 * Regenerates alert notifications from live data (budgets, subscriptions,
 * debts, low balances). Idempotent per-day: skips if today's digest already
 * exists. Invoked by the client when the app shell loads.
 */
export async function POST() {
  return handle(async () => {
    const user = await requireUser();
    const today = todayKey();

    const [recent] = await db()
      .select({ id: schema.notifications.id })
      .from(schema.notifications)
      .where(and(eq(schema.notifications.userId, user.id), eq(schema.notifications.title, `Daily alerts ${today}`)))
      .limit(1);
    if (recent) {
      return Response.json({ success: true, data: { created: 0 }, message: "Alerts already up to date" });
    }

    const lines: { level: string; title: string; body: string }[] = [];

    // budget alerts
    const budgets = await loadBudgetProgress(user.id);
    for (const b of budgets) {
      if (b.alert === "exceeded") {
        lines.push({ level: "critical", title: `Budget exceeded: ${b.name}`, body: `${Math.round(b.percent)}% of your budget used.` });
      } else if (b.alert === "almost_exceeded") {
        lines.push({ level: "warning", title: `Budget almost exceeded: ${b.name}`, body: `${Math.round(b.percent)}% used.` });
      }
    }

    // subscriptions due within 7 days
    const subs = await db()
      .select()
      .from(schema.subscriptions)
      .where(and(eq(schema.subscriptions.userId, user.id), eq(schema.subscriptions.status, "active")));
    const weekAhead = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    for (const s of subs) {
      if (s.nextPaymentDate >= today && s.nextPaymentDate <= weekAhead) {
        lines.push({ level: "info", title: `Subscription due: ${s.name}`, body: `Next payment ${s.nextPaymentDate}.` });
      }
    }

    // upcoming debt due dates within 14 days
    const debtRows = await db()
      .select()
      .from(schema.debts)
      .where(and(eq(schema.debts.userId, user.id), eq(schema.debts.archived, false)));
    const twoWeeks = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
    for (const d of debtRows) {
      if (d.dueDate && d.remainingCents > 0 && d.dueDate >= today && d.dueDate <= twoWeeks) {
        lines.push({ level: "warning", title: `Debt payment approaching: ${d.name}`, body: `Due ${d.dueDate}.` });
      }
    }

    if (lines.length === 0) {
      return Response.json({ success: true, data: { created: 0 }, message: "No alerts today" });
    }

    await db().insert(schema.notifications).values(
      lines.map((l) => ({
        userId: user.id,
        level: l.level,
        title: `Daily alerts ${today}`,
        body: `${l.title} — ${l.body}`,
      }))
    );

    return Response.json({ success: true, data: { created: lines.length }, message: "Alerts generated" });
  });
}
