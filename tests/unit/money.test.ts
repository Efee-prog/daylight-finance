import { describe, expect, it } from "vitest";

import { fixedFromString } from "@/lib/finance/fixed";
import {
  CurrencyMismatchError,
  MissingExchangeRateError,
  UnknownCurrencyError,
  addMoney,
  compareMoney,
  convert,
  currenciesIn,
  money,
  moneyFromDecimalString,
  moneyFromFixed,
  moneyToDecimalString,
  multiplyMoney,
  negateMoney,
  subtractMoney,
  sumByCurrency,
} from "@/lib/finance/money";

describe("money construction", () => {
  it("stores amounts as minor units", () => {
    expect(moneyFromDecimalString("123.45", "TRY").minor).toBe(12345n);
    expect(moneyFromDecimalString("0.01", "TRY").minor).toBe(1n);
  });

  it("respects currency exponents", () => {
    // JPY has no minor unit; XAU is tracked to four places.
    expect(moneyFromDecimalString("1500", "JPY").minor).toBe(1500n);
    expect(moneyToDecimalString(moneyFromDecimalString("1500", "JPY"))).toBe(
      "1500",
    );
    expect(moneyFromDecimalString("2.5", "XAU").minor).toBe(25000n);
  });

  it("rejects a fractional minor unit passed as a number", () => {
    expect(() => money(12.5, "TRY")).toThrow(TypeError);
  });

  it("rejects unknown currencies", () => {
    expect(() => money(1n, "XYZ" as never)).toThrow(UnknownCurrencyError);
  });
});

describe("moneyFromFixed rounding", () => {
  it("rounds half-up away from zero at the minor unit", () => {
    expect(moneyFromFixed(fixedFromString("1.005"), "TRY").minor).toBe(101n);
    expect(moneyFromFixed(fixedFromString("-1.005"), "TRY").minor).toBe(-101n);
    expect(moneyFromFixed(fixedFromString("1.004"), "TRY").minor).toBe(100n);
  });

  it("truncates in down mode", () => {
    expect(
      moneyFromFixed(fixedFromString("1.009"), "TRY", "down").minor,
    ).toBe(100n);
  });
});

describe("currency safety", () => {
  it("refuses to add different currencies", () => {
    const lira = moneyFromDecimalString("100", "TRY");
    const dollar = moneyFromDecimalString("100", "USD");
    expect(() => addMoney(lira, dollar)).toThrow(CurrencyMismatchError);
    expect(() => subtractMoney(lira, dollar)).toThrow(CurrencyMismatchError);
    expect(() => compareMoney(lira, dollar)).toThrow(CurrencyMismatchError);
  });

  it("keeps mixed currencies in separate buckets when summing", () => {
    const totals = sumByCurrency([
      moneyFromDecimalString("100.50", "TRY"),
      moneyFromDecimalString("20", "USD"),
      moneyFromDecimalString("9.50", "TRY"),
    ]);
    expect(moneyToDecimalString(totals.TRY!)).toBe("110");
    expect(moneyToDecimalString(totals.USD!)).toBe("20");
    expect(currenciesIn(totals)).toEqual(["TRY", "USD"]);
  });

  it("converts only with a supplied rate", () => {
    const dollar = moneyFromDecimalString("100", "USD");
    expect(() => convert(dollar, "TRY", [])).toThrow(MissingExchangeRateError);

    const converted = convert(dollar, "TRY", [
      {
        from: "USD",
        to: "TRY",
        rate: fixedFromString("41.25"),
        asOf: "2026-10-18",
      },
    ]);
    expect(moneyToDecimalString(converted)).toBe("4125");
  });

  it("returns the same value when converting to its own currency", () => {
    const lira = moneyFromDecimalString("10", "TRY");
    expect(convert(lira, "TRY", [])).toBe(lira);
  });
});

describe("arithmetic", () => {
  it("negates and sums exactly", () => {
    const a = moneyFromDecimalString("0.10", "TRY");
    const b = moneyFromDecimalString("0.20", "TRY");
    expect(moneyToDecimalString(addMoney(a, b))).toBe("0.3");
    expect(moneyToDecimalString(addMoney(a, negateMoney(b)))).toBe("-0.1");
  });

  it("scales by a fixed factor with half-up rounding", () => {
    const amount = moneyFromDecimalString("100", "TRY");
    expect(moneyToDecimalString(multiplyMoney(amount, fixedFromString("0.185")))).toBe(
      "18.5",
    );
    // 0.005 of 101.00 is 0.505 -> 0.51
    expect(
      moneyToDecimalString(
        multiplyMoney(moneyFromDecimalString("101", "TRY"), fixedFromString("0.005")),
      ),
    ).toBe("0.51");
  });

  it("handles very large balances without precision loss", () => {
    const huge = moneyFromDecimalString("9007199254740993.99", "TRY");
    const sum = addMoney(huge, moneyFromDecimalString("0.01", "TRY"));
    expect(moneyToDecimalString(sum)).toBe("9007199254740994");
  });
});
