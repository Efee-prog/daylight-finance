import { beforeEach, describe, expect, it } from "vitest";

import {
  buildMonthlyCashFlow,
  calculateCashBalance,
  calculateExpenses,
  calculateIncome,
  calculateNetCashFlow,
  calculateSavingsRate,
  calculateSpendingByCategory,
  filterByDateRange,
  ratioToPercent,
} from "@/lib/finance/cashflow";
import { fixedToString } from "@/lib/finance/fixed";
import { type Money, moneyToDecimalString } from "@/lib/finance/money";
import {
  expense,
  income,
  makeTransaction,
  resetIds,
  transferIn,
  transferOut,
  usd,
} from "../factories";

beforeEach(resetIds);

const decimal = (value: Money | undefined) =>
  value ? moneyToDecimalString(value) : undefined;

describe("empty ledger", () => {
  it("reports no totals rather than zeros for currencies with no rows", () => {
    expect(calculateIncome([])).toEqual({});
    expect(calculateExpenses([])).toEqual({});
    expect(calculateNetCashFlow([])).toEqual({});
    expect(calculateCashBalance([])).toEqual({});
  });

  it("has an undefined savings rate with no income", () => {
    expect(calculateSavingsRate([], "TRY")).toBeNull();
  });
});

describe("income and expenses", () => {
  it("sums income only from income rows", () => {
    const rows = [income("5000"), income("1250.50"), expense("300")];
    expect(decimal(calculateIncome(rows).TRY)).toBe("6250.5");
    expect(decimal(calculateExpenses(rows).TRY)).toBe("300");
  });

  it("handles an income-only ledger", () => {
    const rows = [income("4000")];
    expect(decimal(calculateNetCashFlow(rows).TRY)).toBe("4000");
    expect(fixedToString(calculateSavingsRate(rows, "TRY")!)).toBe("1");
  });

  it("handles an expense-only ledger without dividing by zero", () => {
    const rows = [expense("4000")];
    expect(decimal(calculateNetCashFlow(rows).TRY)).toBe("-4000");
    expect(calculateSavingsRate(rows, "TRY")).toBeNull();
  });

  it("sums a thousand small amounts exactly", () => {
    const rows = Array.from({ length: 1000 }, () => expense("0.01"));
    expect(decimal(calculateExpenses(rows).TRY)).toBe("10");
  });
});

describe("transfers", () => {
  const rows = [
    income("10000"),
    expense("2500"),
    transferOut("3000"),
    transferIn("500"),
  ];

  it("excludes transfers from income, expenses and net cash flow", () => {
    expect(decimal(calculateIncome(rows).TRY)).toBe("10000");
    expect(decimal(calculateExpenses(rows).TRY)).toBe("2500");
    expect(decimal(calculateNetCashFlow(rows).TRY)).toBe("7500");
  });

  it("includes transfers in the cash balance", () => {
    // 10000 - 2500 - 3000 + 500
    expect(decimal(calculateCashBalance(rows).TRY)).toBe("5000");
  });

  it("nets a matched transfer pair to zero in the balance", () => {
    const pair = [transferOut("1500"), transferIn("1500")];
    expect(decimal(calculateCashBalance(pair).TRY)).toBe("0");
    expect(calculateIncome(pair)).toEqual({});
    expect(calculateExpenses(pair)).toEqual({});
  });

  it("keeps the savings rate free of transfer effects", () => {
    // Moving 3000 into a goal must not look like spending.
    expect(fixedToString(calculateSavingsRate(rows, "TRY")!)).toBe("0.75");
  });
});

describe("savings rate", () => {
  it("matches the documented formula (income - expenses) / income", () => {
    const rows = [income("10000"), expense("8200")];
    const rate = calculateSavingsRate(rows, "TRY")!;
    expect(fixedToString(rate)).toBe("0.18");
    expect(fixedToString(ratioToPercent(rate))).toBe("18");
  });

  it("can be negative when spending exceeds income", () => {
    const rows = [income("1000"), expense("1500")];
    expect(fixedToString(calculateSavingsRate(rows, "TRY")!)).toBe("-0.5");
  });

  it("is undefined for a currency with no income even when others have some", () => {
    const rows = [
      income("1000"),
      makeTransaction({ kind: "expense", amount: usd("40") }),
    ];
    expect(calculateSavingsRate(rows, "USD")).toBeNull();
    expect(fixedToString(calculateSavingsRate(rows, "TRY")!)).toBe("1");
  });
});

describe("multiple currencies", () => {
  const rows = [
    income("10000"),
    makeTransaction({ kind: "income", amount: usd("500") }),
    makeTransaction({ kind: "expense", amount: usd("120.50") }),
  ];

  it("keeps each currency separate instead of summing them", () => {
    const totals = calculateIncome(rows);
    expect(moneyToDecimalString(totals.TRY!)).toBe("10000");
    expect(moneyToDecimalString(totals.USD!)).toBe("500");
  });

  it("nets per currency", () => {
    const net = calculateNetCashFlow(rows);
    expect(moneyToDecimalString(net.TRY!)).toBe("10000");
    expect(moneyToDecimalString(net.USD!)).toBe("379.5");
  });
});

describe("date filtering", () => {
  const rows = [
    income("100", { occurredOn: "2026-09-30" }),
    income("200", { occurredOn: "2026-10-01" }),
    income("300", { occurredOn: "2026-10-31" }),
    income("400", { occurredOn: "2026-11-01" }),
  ];

  it("is inclusive at both ends", () => {
    const october = filterByDateRange(rows, {
      start: "2026-10-01",
      end: "2026-10-31",
    });
    expect(october).toHaveLength(2);
    expect(decimal(calculateIncome(october).TRY)).toBe("500");
  });
});

describe("spending by category", () => {
  it("ranks categories and reports shares that add to one", () => {
    const rows = [
      expense("6000", { categoryId: "housing" }),
      expense("3000", { categoryId: "food" }),
      expense("1000", { categoryId: "food" }),
      income("20000"),
    ];
    const breakdown = calculateSpendingByCategory(rows, "TRY");
    expect(breakdown.map((s) => s.categoryId)).toEqual(["housing", "food"]);
    expect(moneyToDecimalString(breakdown[0].total)).toBe("6000");
    expect(fixedToString(breakdown[0].share)).toBe("0.6");
    expect(fixedToString(breakdown[1].share)).toBe("0.4");
  });

  it("groups uncategorised spending under null without crashing", () => {
    const breakdown = calculateSpendingByCategory([expense("50")], "TRY");
    expect(breakdown[0].categoryId).toBeNull();
    expect(fixedToString(breakdown[0].share)).toBe("1");
  });

  it("returns an empty breakdown when there is no spending", () => {
    expect(calculateSpendingByCategory([income("100")], "TRY")).toEqual([]);
  });
});

describe("monthly series", () => {
  it("marks months with no data instead of charting them as zero", () => {
    const rows = [
      income("1000", { occurredOn: "2026-08-10" }),
      expense("400", { occurredOn: "2026-08-20" }),
      income("1200", { occurredOn: "2026-10-05" }),
    ];
    const series = buildMonthlyCashFlow(
      rows,
      ["2026-08", "2026-09", "2026-10"],
      "TRY",
    );

    expect(series.map((p) => p.hasData)).toEqual([true, false, true]);
    expect(moneyToDecimalString(series[0].net)).toBe("600");
    expect(moneyToDecimalString(series[1].net)).toBe("0");
    expect(series[1].hasData).toBe(false);
    expect(moneyToDecimalString(series[2].income)).toBe("1200");
  });

  it("keeps the axis stable for an empty ledger", () => {
    const series = buildMonthlyCashFlow([], ["2026-09", "2026-10"], "TRY");
    expect(series).toHaveLength(2);
    expect(series.every((p) => !p.hasData)).toBe(true);
  });
});
