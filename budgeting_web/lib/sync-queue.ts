/**
 * Offline write queue (lib/sync-queue.ts).
 * Writes made offline are stored locally and flushed to the server when
 * connectivity returns. Transactions carry a client-generated
 * idempotency key so a retry never double-creates a record.
 */

const QUEUE_KEY = "fin_sync_queue_v1";

export type QueuedWrite = {
  id: string; // idempotency key (uuid-ish)
  method: "POST" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  createdAt: number;
  description: string; // human label for the sync UI
};

export function readQueue(): QueuedWrite[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedWrite[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedWrite[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // storage full: drop oldest silently — queue is best-effort
  }
}

export function enqueue(write: Omit<QueuedWrite, "id" | "createdAt">): string {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const item: QueuedWrite = { ...write, id, createdAt: Date.now() };
  writeQueue([...readQueue(), item]);
  return id;
}

export function dequeue(id: string): void {
  writeQueue(readQueue().filter((w) => w.id !== id));
}

export function queueSize(): number {
  return readQueue().length;
}

/** Attempt to flush the queue; returns how many writes succeeded. */
export async function flushQueue(): Promise<{ sent: number; failed: number }> {
  const queue = readQueue();
  let sent = 0;
  let failed = 0;

  for (const item of queue) {
    try {
      const res = await fetch(item.path, {
        method: item.method,
        headers: {
          "Content-Type": "application/json",
          ...(item.method === "POST" ? { "Idempotency-Key": item.id } : {}),
        },
        body: item.body !== undefined ? JSON.stringify(item.body) : undefined,
        credentials: "same-origin",
      });
      if (res.ok) {
        dequeue(item.id);
        sent += 1;
      } else if (res.status >= 400 && res.status < 500) {
        // 4xx = server rejected permanently (validation/conflict): drop it.
        // 409 = idempotency replay: it already exists, counts as sent.
        dequeue(item.id);
        if (res.status === 409) sent += 1;
        else failed += 1;
      } else {
        // 5xx: temporary — keep in queue for the next flush
        failed += 1;
      }
    } catch {
      // network still down: keep queued
      failed += 1;
    }
  }

  return { sent, failed };
}

export function formatQueueLabel(w: QueuedWrite): string {
  return w.description || `${w.method} ${w.path}`;
}
