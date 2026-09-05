import { describe, expect, it } from "vitest";

import { goalProgress, monthlyCost, nextRecurrence } from "@/lib/goals";

describe("goalProgress", () => {
  it("computes percent, remaining, and suggested monthly", () => {
    const p = goalProgress({
      targetCents: 5_000_000,
      savedCents: 2_750_000,
      targetDate: "2027-09-01",
    });
    expect(p.percent).toBe(55);
    expect(p.remainingCents).toBe(2_250_000);
    expect(p.suggestedMonthlyCents).toBe(187_500);
    expect(p.daysRemaining).toBeGreaterThan(0);
    expect(p.status).toBe("on_track");
  });

  it("achieved at 100%", () => {
    const p = goalProgress({ targetCents: 100, savedCents: 100, targetDate: "2027-01-01" });
    expect(p.status).toBe("achieved");
    expect(p.percent).toBe(100);
  });

  it("no target date -> no_date status", () => {
    const p = goalProgress({ targetCents: 100, savedCents: 10, targetDate: null });
    expect(p.status).toBe("no_date");
    expect(p.suggestedMonthlyCents).toBeNull();
  });

  it("behind when date passed with money remaining", () => {
    const p = goalProgress({
      targetCents: 1_000_000,
      savedCents: 100_000,
      targetDate: "2026-01-01",
    }, new Date("2026-09-05T00:00:00"));
    expect(p.status).toBe("behind");
    expect(p.suggestedMonthlyCents).toBe(900_000);
  });
});

describe("nextRecurrence", () => {
  it("monthly clamps to month end", () => {
    expect(nextRecurrence("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(nextRecurrence("2026-02-28", "monthly")).toBe("2026-03-28");
  });

  it("monthly handles year rollover", () => {
    expect(nextRecurrence("2026-12-15", "monthly")).toBe("2027-01-15");
  });

  it("daily rolls over month and year", () => {
    expect(nextRecurrence("2026-09-30", "daily")).toBe("2026-10-01");
    expect(nextRecurrence("2026-12-31", "daily")).toBe("2027-01-01");
  });

  it("weekly adds 7 days", () => {
    expect(nextRecurrence("2026-09-05", "weekly")).toBe("2026-09-12");
  });

  it("quarterly adds 3 months with clamping", () => {
    expect(nextRecurrence("2026-11-30", "quarterly")).toBe("2027-02-28");
  });

  it("yearly adds a year and clamps Feb 29", () => {
    expect(nextRecurrence("2028-02-29", "yearly")).toBe("2029-02-28");
    expect(nextRecurrence("2026-05-10", "yearly")).toBe("2027-05-10");
  });
});

describe("monthlyCost", () => {
  it("normalizes cycles to monthly", () => {
    expect(monthlyCost(45_000, "monthly")).toBe(45_000);
    expect(monthlyCost(480_000, "yearly")).toBe(40_000);
    expect(monthlyCost(150_000, "quarterly")).toBe(50_000);
    expect(monthlyCost(10_000, "weekly")).toBe(Math.round((10_000 * 52) / 12));
  });
});
