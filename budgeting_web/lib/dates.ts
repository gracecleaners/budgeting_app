/** Local date keys "YYYY-MM-DD" — no UTC shifting on date-only values. */

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function isValidDateKey(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00`).getTime());
}

export type RangePreset =
  | "today"
  | "week"
  | "month"
  | "last_month"
  | "3m"
  | "6m"
  | "year"
  | "all"
  | "custom";

/** Resolve a preset (or custom from/to) into an inclusive [from, to] pair of date keys. */
export function resolveRange(
  preset: RangePreset,
  custom?: { from?: string; to?: string }
): { from: string | null; to: string | null } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const key = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  switch (preset) {
    case "today":
      return { from: key(now), to: key(now) };
    case "week": {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay()); // week starts Sunday
      return { from: key(start), to: key(now) };
    }
    case "month":
      return { from: key(new Date(y, m, 1)), to: key(new Date(y, m + 1, 0)) };
    case "last_month":
      return { from: key(new Date(y, m - 1, 1)), to: key(new Date(y, m, 0)) };
    case "3m":
      return { from: key(new Date(y, m - 2, 1)), to: key(new Date(y, m + 1, 0)) };
    case "6m":
      return { from: key(new Date(y, m - 5, 1)), to: key(new Date(y, m + 1, 0)) };
    case "year":
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    case "all":
      return { from: null, to: null };
    case "custom": {
      const from = custom?.from && isValidDateKey(custom.from) ? custom.from : null;
      const to = custom?.to && isValidDateKey(custom.to) ? custom.to : null;
      return { from, to };
    }
  }
}

/** Month key "YYYY-MM" for a date key. */
export function monthKeyOf(dateKey: string): string {
  return dateKey.slice(0, 7);
}

/** First and last day of the month containing the given date key. */
export function monthBounds(dateKey: string): { from: string; to: string } {
  const [y, m] = dateKey.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return {
    from: `${dateKey.slice(0, 7)}-01`,
    to: `${dateKey.slice(0, 7)}-${String(last).padStart(2, "0")}`,
  };
}
