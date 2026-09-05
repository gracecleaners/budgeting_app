/**
 * Money helpers: all amounts cross the API as integer cents.
 * Prevents float drift (0.1 + 0.2 !== 0.3) in financial math (spec #36).
 */

export function toCents(value: string | number): number {
  const n = typeof value === "number" ? value : parseFloat(value);
  if (!Number.isFinite(n)) throw new Error(`Invalid amount: ${value}`);
  return Math.round(n * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function sumCents(values: number[]): number {
  return values.reduce((a, b) => a + b, 0);
}

/** Format integer cents as a currency string, e.g. 42500000 -> "UGX 425,000". */
export function formatMoney(cents: number, currency = "UGX"): string {
  const abs = Math.abs(cents) / 100;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(abs);
  return `${currency} ${cents < 0 ? "-" : ""}${formatted}`;
}
