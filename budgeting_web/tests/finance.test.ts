import { describe, expect, it } from "vitest";

import {
  accountBalance,
  budgetUsage,
  cashFlow,
  debtToIncomeRatio,
  expensesByCategory,
  healthScore,
  pctChange,
  savingsRate,
  suggestedMonthlyContribution,
  totalBalances,
  totalExpenses,
  totalIncome,
} from "@/lib/finance";
import { toCents, fromCents, formatMoney } from "@/lib/money";

const acc = (id: number, opening = 0) => ({ id, openingBalanceCents: opening });

describe("money", () => {
  it("converts to cents without float drift", () => {
    expect(toCents(0.1 + 0.2)).toBe(30); // 0.30000000000000004 -> 30
    expect(toCents("19.99")).toBe(1999);
    expect(fromCents(42500000)).toBe(425000);
  });
  it("formats currency", () => {
    expect(formatMoney(42500000, "UGX")).toBe("UGX 425,000");
    expect(formatMoney(-15050, "UGX")).toBe("UGX -150.50");
  });
});

describe("income/expense rules", () => {
  const txs = [
    { type: "income", amountCents: 2_000_000, date: "2026-09-01", toAccountId: 1 },
    { type: "expense", amountCents: 600_000, date: "2026-09-02", fromAccountId: 1 },
    { type: "expense", amountCents: 150_000, date: "2026-09-03", fromAccountId: 2 },
    // transfer must not affect income/expense
    { type: "transfer", amountCents: 200_000, date: "2026-09-04", fromAccountId: 1, toAccountId: 2 },
  ];

  it("counts income and excludes transfers", () => {
    expect(totalIncome(txs)).toBe(2_000_000);
  });
  it("counts expenses and excludes transfers", () => {
    expect(totalExpenses(txs)).toBe(750_000);
  });
  it("computes cash flow", () => {
    expect(cashFlow(txs)).toBe(1_250_000);
  });
});

describe("account balances", () => {
  it("applies opening balance and transaction effects", () => {
    const a1 = acc(1, 100_000);
    const txs = [
      { type: "income", amountCents: 50_000, date: "x", toAccountId: 1 },
      { type: "expense", amountCents: 20_000, date: "x", fromAccountId: 1 },
      { type: "transfer", amountCents: 10_000, date: "x", fromAccountId: 1, toAccountId: 2 },
    ];
    expect(accountBalance(a1, txs)).toBe(120_000);
    expect(accountBalance(acc(2), txs)).toBe(10_000);
  });
  it("totals all accounts", () => {
    const txs = [{ type: "transfer", amountCents: 5_000, date: "x", fromAccountId: 1, toAccountId: 2 }];
    expect(totalBalances([acc(1, 10_000), acc(2)], txs)).toBe(10_000);
  });
});

describe("budgets", () => {
  it("computes usage and statuses", () => {
    expect(budgetUsage(500_000, 350_000)).toMatchObject({ percent: 70, status: "on_track" });
    expect(budgetUsage(500_000, 400_000).status).toBe("warning");
    expect(budgetUsage(500_000, 460_000).status).toBe("almost_exceeded");
    expect(budgetUsage(500_000, 550_000).status).toBe("exceeded");
    expect(budgetUsage(500_000, 550_000).remainingCents).toBe(-50_000);
  });
});

describe("expenses by category", () => {
  it("groups and sorts descending", () => {
    const cats = [
      { id: 1, name: "Food", kind: "expense", color: "#f00" },
      { id: 2, name: "Transport", kind: "expense", color: "#0f0" },
    ];
    const txs = [
      { type: "expense", amountCents: 10, date: "x", categoryId: 1 },
      { type: "expense", amountCents: 30, date: "x", categoryId: 2 },
      { type: "expense", amountCents: 20, date: "x", categoryId: 1 },
      { type: "income", amountCents: 99, date: "x", categoryId: 1 }, // excluded
    ];
    const result = expensesByCategory(txs, cats);
    expect(result[0]).toMatchObject({ name: "Food", cents: 30 });
    expect(result[1]).toMatchObject({ name: "Transport", cents: 30 });
  });
});

describe("goals", () => {
  it("suggests monthly contributions", () => {
    const target = "2027-09-01";
    expect(suggestedMonthlyContribution(5_000_000, 2_750_000, target)).toBe(187_500);
    expect(suggestedMonthlyContribution(1_000_000, 1_000_000, target)).toBe(0);
    expect(suggestedMonthlyContribution(1_000_000, 0, null)).toBeNull();
  });
});

describe("ratios & health", () => {
  it("computes savings rate and DTI", () => {
    expect(savingsRate(2_000_000, 400_000)).toBe(20);
    expect(debtToIncomeRatio(800_000, 6_500_000)).toBe(12);
    expect(debtToIncomeRatio(100, 0)).toBe(100);
  });
  it("scores health and labels it", () => {
    const result = healthScore({
      incomeCents: 6_500_000,
      expenseCents: 2_100_000,
      savedCents: 1_500_000,
      debtCents: 800_000,
      budgetAdherencePct: 90,
    });
    expect(result.score).toBeGreaterThan(60);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.factors).toHaveLength(5);
    expect(result.label).toMatch(/Good|Excellent/);
  });
  it("pctChange handles zero base", () => {
    expect(pctChange(110, 100)).toBe(10);
    expect(pctChange(50, 0)).toBeNull();
    expect(pctChange(0, 0)).toBe(0);
  });
});
