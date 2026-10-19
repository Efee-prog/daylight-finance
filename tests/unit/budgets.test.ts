import { beforeEach, describe, expect, it } from "vitest";

import {
  calculateBudgetUsage,
  transactionsInBudget,
} from "@/lib/finance/budgets";
import { fixedToString } from "@/lib/finance/fixed";
import { moneyToDecimalString } from "@/lib/finance/money";
import {
  expense,
  income,
  makeBudget,
  makeTransaction,
  resetIds,
  transferOut,
  try_,
  usd,
} from "../factories";

beforeEach(resetIds);

describe("what a budget counts", () => {
  const budget = makeBudget({ categoryId: "food", limit: try_("8000") });

  it("counts only expenses in its own category, currency and month", () => {
    const rows = [
      expense("5200", { categoryId: "food", occurredOn: "2026-10-12" }),
      expense("900", { categoryId: "housing", occurredOn: "2026-10-12" }),
      expense("700", { categoryId: "food", occurredOn: "2026-09-30" }),
      expense("600", { categoryId: "food", occurredOn: "2026-11-01" }),
      income("4000", { categoryId: "food", occurredOn: "2026-10-12" }),
      makeTransaction({
        kind: "expense",
        amount: usd("50"),
        categoryId: "food",
        occurredOn: "2026-10-12",
      }),
    ];

    expect(transactionsInBudget(budget, rows)).toHaveLength(1);
    const usage = calculateBudgetUsage(budget, rows);
    expect(moneyToDecimalString(usage.spent)).toBe("5200");
    expect(moneyToDecimalString(usage.remaining)).toBe("2800");
    expect(fixedToString(usage.ratio!)).toBe("0.65");
    expect(usage.status).toBe("under");
  });

  it("ignores transfers out, so funding a goal is not overspending", () => {
    const rows = [transferOut("3000", { categoryId: "food" })];
    const usage = calculateBudgetUsage(budget, rows);
    expect(moneyToDecimalString(usage.spent)).toBe("0");
    expect(usage.status).toBe("under");
  });

  it("covers the whole month including the last day", () => {
    const rows = [
      expense("100", { categoryId: "food", occurredOn: "2026-10-01" }),
      expense("100", { categoryId: "food", occurredOn: "2026-10-31" }),
    ];
    expect(transactionsInBudget(budget, rows)).toHaveLength(2);
  });

  it("handles February in a leap year", () => {
    const february = makeBudget({
      categoryId: "food",
      periodStart: "2028-02-01",
    });
    const rows = [
      expense("100", { categoryId: "food", occurredOn: "2028-02-29" }),
    ];
    expect(transactionsInBudget(february, rows)).toHaveLength(1);
  });
});

describe("thresholds", () => {
  const budget = makeBudget({ categoryId: "food", limit: try_("1000") });

  const usageFor = (amount: string) =>
    calculateBudgetUsage(budget, [
      expense(amount, { categoryId: "food", occurredOn: "2026-10-05" }),
    ]);

  it("reports under below 80 percent", () => {
    expect(usageFor("799.99").status).toBe("under");
  });

  it("reports approaching at exactly 80 percent", () => {
    expect(usageFor("800").status).toBe("approaching");
  });

  it("reports approaching at exactly the limit, not exceeded", () => {
    const usage = usageFor("1000");
    expect(usage.status).toBe("approaching");
    expect(moneyToDecimalString(usage.remaining)).toBe("0");
    expect(fixedToString(usage.ratio!)).toBe("1");
  });

  it("reports exceeded one minor unit over the limit", () => {
    const usage = usageFor("1000.01");
    expect(usage.status).toBe("exceeded");
    expect(moneyToDecimalString(usage.remaining)).toBe("-0.01");
  });
});

describe("degenerate limits", () => {
  it("returns a null ratio for a zero limit instead of dividing by zero", () => {
    const budget = makeBudget({ categoryId: "food", limit: try_("0") });
    const usage = calculateBudgetUsage(budget, [
      expense("150", { categoryId: "food", occurredOn: "2026-10-05" }),
    ]);
    expect(usage.ratio).toBeNull();
    expect(usage.status).toBe("invalid");
    // The spending itself is still reported, because it happened.
    expect(moneyToDecimalString(usage.spent)).toBe("150");
  });

  it("treats a negative limit as invalid", () => {
    const budget = makeBudget({ categoryId: "food", limit: try_("-500") });
    const usage = calculateBudgetUsage(budget, []);
    expect(usage.ratio).toBeNull();
    expect(usage.status).toBe("invalid");
  });
});

describe("no spending", () => {
  it("reports a full remaining balance at zero usage", () => {
    const budget = makeBudget({ categoryId: "food", limit: try_("8000") });
    const usage = calculateBudgetUsage(budget, []);
    expect(moneyToDecimalString(usage.spent)).toBe("0");
    expect(moneyToDecimalString(usage.remaining)).toBe("8000");
    expect(fixedToString(usage.ratio!)).toBe("0");
    expect(usage.status).toBe("under");
  });
});
