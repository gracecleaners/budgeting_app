import { describe, expect, it } from "vitest";

import {
  alertMessage,
  budgetLabel,
  budgetProgress,
  budgetWindow,
  spentForBudget,
  type BudgetRow,
  type TxRow,
} from "@/lib/budgets";
import { formatMoney } from "@/lib/money";

const fmt = (c: number) => formatMoney(c, "UGX");

const monthly = (over: Partial<BudgetRow> = {}): BudgetRow => ({
  id: 1,
  categoryId: null,
  accountId: null,
  name: "Overall",
  amountCents: 500_000,
  period: "monthly",
  startDate: null,
  endDate: null,
  ...over,
});

const tx = (over: Partial<TxRow> = {}): TxRow => ({
  type: "expense",
  amountCents: 100_000,
  date: "2026-09-15",
  categoryId: 7,
  fromAccountId: 1,
  ...over,
});

describe("budgetWindow", () => {
  it("monthly window covers the calendar month of 'today'", () => {
    const w = budgetWindow(monthly(), "2026-09-15");
    expect(w).toEqual({ from: "2026-09-01", to: "2026-09-30" });
  });

  it("weekly window is Sun-based and 7 days long", () => {
    // 2026-09-05 is a Saturday; the week starts Sunday 2026-08-30
    const w = budgetWindow(monthly({ period: "weekly" }), "2026-09-05");
    expect(w).toEqual({ from: "2026-08-30", to: "2026-09-05" });
  });

  it("custom window uses fixed dates", () => {
    const w = budgetWindow(
      monthly({ period: "custom", startDate: "2026-08-20", endDate: "2026-09-19" }),
      "2026-09-15"
    );
    expect(w).toEqual({ from: "2026-08-20", to: "2026-09-19" });
  });
});

describe("spentForBudget", () => {
  const txs = [
    tx(), // in window, category 7, account 1
    tx({ date: "2026-09-16", amountCents: 50_000 }), // in window
    tx({ date: "2026-08-31", amountCents: 999_000 }), // outside monthly window
    tx({ categoryId: 8, amountCents: 777_000 }), // different category
    tx({ type: "income", amountCents: 5_000_000 }), // income never counts
    tx({ type: "transfer", amountCents: 400_000 }), // transfers never count
  ];

  it("overall budget: sums all expenses in window regardless of category", () => {
    // 100_000 + 50_000 + 777_000 (different category is still an expense in window)
    expect(spentForBudget(monthly(), txs, "2026-09-15")).toBe(927_000);
  });

  it("category budget: only that category in window", () => {
    expect(spentForBudget(monthly({ categoryId: 7 }), txs, "2026-09-15")).toBe(150_000);
    expect(spentForBudget(monthly({ categoryId: 8 }), txs, "2026-09-15")).toBe(777_000);
    expect(spentForBudget(monthly({ categoryId: 99 }), txs, "2026-09-15")).toBe(0);
  });

  it("account budget: only expenses from that account", () => {
    expect(spentForBudget(monthly({ accountId: 1 }), txs, "2026-09-15")).toBe(927_000);
    expect(spentForBudget(monthly({ accountId: 2 }), txs, "2026-09-15")).toBe(0);
  });

  it("respects custom windows", () => {
    const b = monthly({ period: "custom", startDate: "2026-08-20", endDate: "2026-09-19" });
    // category budget now includes the 2026-08-31 expense too
    expect(spentForBudget(b, txs, "2026-09-15")).toBe(927_000 + 999_000);
  });
});

describe("budgetProgress", () => {
  it("maps spent to status via budgetUsage", () => {
    const p = budgetProgress(monthly({ amountCents: 500_000 }), [tx()], "2026-09-15");
    expect(p.spentCents).toBe(100_000);
    expect(p.percent).toBe(20);
    expect(p.status).toBe("on_track");
    expect(p.window.from).toBe("2026-09-01");
    expect(p.remainingCents).toBe(400_000);
  });

  it("flags exceeded when spending passes the cap", () => {
    const p = budgetProgress(monthly({ amountCents: 500_000 }), [tx({ amountCents: 600_000 })], "2026-09-15");
    expect(p.status).toBe("exceeded");
    expect(p.percent).toBe(120);
  });
});

describe("labels & alerts", () => {
  it("labels by name > category > account > fallback", () => {
    expect(budgetLabel(monthly({ name: "Groceries cap" }))).toBe("Groceries cap");
    expect(budgetLabel(monthly({ name: "", categoryId: 7 }), "Food")).toBe("Food");
    expect(budgetLabel(monthly({ name: "", accountId: 3 }), null, "Cash")).toBe("Cash");
    expect(budgetLabel(monthly({ name: "" }))).toBe("Overall");
  });

  it("alert messages by severity", () => {
    expect(alertMessage("Food", 100, fmt, 500_000, 600_000)).toContain("over budget");
    expect(alertMessage("Food", 92, fmt, 500_000, 460_000)).toContain("almost exceeded");
    expect(alertMessage("Food", 80, fmt, 500_000, 400_000)).toContain("watch");
    expect(alertMessage("Food", 55, fmt, 500_000, 275_000)).toContain("55% used");
  });
});
