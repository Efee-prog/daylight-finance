import { describe, expect, it } from "vitest";

import {
  DivisionByZeroError,
  FixedParseError,
  fixedAdd,
  fixedDivide,
  fixedFromInteger,
  fixedFromString,
  fixedMultiply,
  fixedSubtract,
  fixedToNumber,
  fixedToString,
  parseLocaleDecimal,
} from "@/lib/finance/fixed";

describe("fixedFromString", () => {
  it("round-trips plain decimals", () => {
    expect(fixedToString(fixedFromString("1234.56"))).toBe("1234.56");
    expect(fixedToString(fixedFromString("0.00000001"))).toBe("0.00000001");
    expect(fixedToString(fixedFromString("-0.5"))).toBe("-0.5");
    expect(fixedToString(fixedFromString("42"))).toBe("42");
    expect(fixedToString(fixedFromString(".25"))).toBe("0.25");
  });

  it("holds magnitudes that exceed Number.MAX_SAFE_INTEGER", () => {
    const huge = fixedFromString("9007199254740993.99");
    expect(fixedToString(huge)).toBe("9007199254740993.99");
  });

  it("rejects more precision than it can store, instead of truncating", () => {
    expect(() => fixedFromString("1.123456789")).toThrow(FixedParseError);
  });

  it("rejects malformed input", () => {
    for (const bad of ["", "   ", "abc", "1.2.3", "1,5", "--1", "1e5", "₺5"]) {
      expect(() => fixedFromString(bad), bad).toThrow(FixedParseError);
    }
  });
});

describe("arithmetic", () => {
  it("adds decimals exactly where floating point cannot", () => {
    // 0.1 + 0.2 === 0.30000000000000004 as doubles. The whole module exists
    // so that this assertion can be exact.
    const sum = fixedAdd(fixedFromString("0.1"), fixedFromString("0.2"));
    expect(fixedToString(sum)).toBe("0.3");
  });

  it("keeps a long run of small amounts exact", () => {
    let total = fixedFromString("0");
    for (let i = 0; i < 1000; i += 1) {
      total = fixedAdd(total, fixedFromString("0.01"));
    }
    expect(fixedToString(total)).toBe("10");
  });

  it("subtracts to exact zero", () => {
    const result = fixedSubtract(
      fixedFromString("1.1"),
      fixedFromString("1.1"),
    );
    expect(fixedToString(result)).toBe("0");
  });

  it("multiplies with half-up rounding away from zero", () => {
    // 0.000000005 rounds to 0.00000001, and the negative case is symmetric.
    const up = fixedMultiply(
      fixedFromString("0.0000001"),
      fixedFromString("0.05"),
    );
    expect(fixedToString(up)).toBe("0.00000001");

    const down = fixedMultiply(
      fixedFromString("-0.0000001"),
      fixedFromString("0.05"),
    );
    expect(fixedToString(down)).toBe("-0.00000001");
  });

  it("truncates towards zero in down mode", () => {
    const result = fixedMultiply(
      fixedFromString("0.0000001"),
      fixedFromString("0.05"),
      "down",
    );
    expect(fixedToString(result)).toBe("0");
  });

  it("divides to the configured precision", () => {
    const third = fixedDivide(fixedFromInteger(1), fixedFromInteger(3));
    expect(fixedToString(third)).toBe("0.33333333");
  });

  it("refuses to divide by zero rather than returning Infinity", () => {
    expect(() => fixedDivide(fixedFromInteger(1), fixedFromInteger(0))).toThrow(
      DivisionByZeroError,
    );
  });
});

describe("parseLocaleDecimal", () => {
  it("reads Turkish formatting", () => {
    expect(fixedToString(parseLocaleDecimal("1.234,56"))).toBe("1234.56");
    expect(fixedToString(parseLocaleDecimal("12.450,75"))).toBe("12450.75");
    expect(fixedToString(parseLocaleDecimal("0,5"))).toBe("0.5");
  });

  it("reads English formatting", () => {
    expect(fixedToString(parseLocaleDecimal("1,234.56"))).toBe("1234.56");
    expect(fixedToString(parseLocaleDecimal("12,450.75"))).toBe("12450.75");
  });

  it("treats a lone three-digit group as thousands, not a decimal", () => {
    // This is the ambiguous case that silently corrupts CSV imports: "1,234"
    // must be one thousand two hundred thirty-four.
    expect(fixedToString(parseLocaleDecimal("1,234"))).toBe("1234");
    expect(fixedToString(parseLocaleDecimal("1.234"))).toBe("1234");
  });

  it("treats a non-three-digit group as a decimal part", () => {
    expect(fixedToString(parseLocaleDecimal("1,23"))).toBe("1.23");
    expect(fixedToString(parseLocaleDecimal("1.2345"))).toBe("1.2345");
    expect(fixedToString(parseLocaleDecimal("0,123"))).toBe("0.123");
  });

  it("handles negatives, spaces and non-breaking spaces", () => {
    expect(fixedToString(parseLocaleDecimal(" -1.234,50 "))).toBe("-1234.5");
    expect(fixedToString(parseLocaleDecimal("1 234,50"))).toBe("1234.5");
  });

  it("rejects malformed grouping", () => {
    for (const bad of ["1.23.456,78", "1,2345,678.00", "1.2,3.4"]) {
      expect(() => parseLocaleDecimal(bad), bad).toThrow(FixedParseError);
    }
  });
});

describe("fixedToNumber", () => {
  it("converts for display only", () => {
    expect(fixedToNumber(fixedFromString("1234.56"))).toBeCloseTo(1234.56, 8);
  });
});
