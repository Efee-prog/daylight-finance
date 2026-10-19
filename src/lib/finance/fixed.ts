/**
 * Fixed-point decimal arithmetic on BigInt.
 *
 * Why this exists: IEEE-754 doubles cannot represent 0.1 exactly, so
 * `0.1 + 0.2 !== 0.3`. In a ledger those errors accumulate and the reported
 * balance stops matching the sum of its rows. Every number in Daylight that
 * participates in a financial result therefore travels as an integer.
 *
 * Two representations are used, deliberately kept apart by the type system:
 *
 *   - `Fixed`  — a quantity or a unit price, scaled by 10^8. Eight decimals
 *                covers satoshi-level crypto precision and fractional share
 *                lots, and is what the database columns NUMERIC(28,8) hold.
 *   - minor units — a money amount in the smallest unit of its currency
 *                (kuruş, cent). See `money.ts`.
 *
 * Multiplying two Fixed values is the only operation that loses information,
 * so it takes an explicit rounding mode and never rounds silently.
 */

export const FIXED_SCALE = 8;
const SCALE_FACTOR = 10n ** BigInt(FIXED_SCALE);

/** A decimal scaled by 10^FIXED_SCALE. Branded so a raw bigint cannot slip in. */
export type Fixed = bigint & { readonly __fixed: unique symbol };

export const FIXED_ZERO = 0n as Fixed;
export const FIXED_ONE = SCALE_FACTOR as Fixed;

export type RoundingMode = "half-up" | "down";

export class FixedParseError extends Error {
  constructor(input: string, reason: string) {
    super(`Cannot parse "${input}" as a decimal: ${reason}`);
    this.name = "FixedParseError";
  }
}

const DECIMAL_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

/**
 * Parses a decimal string into `Fixed`.
 *
 * Accepts an optional sign, an optional fractional part, and surrounding
 * whitespace. Digits beyond FIXED_SCALE are rejected rather than truncated:
 * silently dropping a digit the user typed is a data-integrity bug, not a
 * formatting detail. Thousand separators are not accepted here — locale-aware
 * input is normalised in `parseLocaleDecimal` before it reaches this function.
 */
export function fixedFromString(input: string): Fixed {
  const text = input.trim();
  if (text === "") throw new FixedParseError(input, "value is empty");
  if (!DECIMAL_PATTERN.test(text)) {
    throw new FixedParseError(input, "expected digits with a single '.'");
  }

  const negative = text.startsWith("-");
  const unsigned = text.replace(/^[+-]/, "");
  const [whole, fraction = ""] = unsigned.split(".");

  if (fraction.length > FIXED_SCALE) {
    throw new FixedParseError(
      input,
      `at most ${FIXED_SCALE} decimal places are supported`,
    );
  }

  const padded = fraction.padEnd(FIXED_SCALE, "0");
  const magnitude = BigInt(`${whole || "0"}${padded}`);
  return (negative ? -magnitude : magnitude) as Fixed;
}

/**
 * Parses a decimal that may use either European or English conventions:
 * "1.234,56" and "1,234.56" both mean one thousand two hundred thirty-four
 * and fifty-six hundredths. CSV files exported from Turkish and English
 * locales both land here, so the ambiguity has to be resolved explicitly.
 *
 * The rule: the *last* separator present decides the decimal point, and any
 * earlier separators must be valid thousand groupings. "1,234" is therefore
 * one thousand two hundred thirty-four, while "1,23" is one point two three —
 * a three-digit group reads as grouping, anything else as a decimal part.
 */
export function parseLocaleDecimal(input: string): Fixed {
  const text = input.trim().replace(/\s| /g, "");
  if (text === "") throw new FixedParseError(input, "value is empty");

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");

  if (lastComma === -1 && lastDot === -1) return fixedFromString(text);

  let decimalSep: string;
  if (lastComma === -1) decimalSep = ".";
  else if (lastDot === -1) decimalSep = ",";
  else decimalSep = lastComma > lastDot ? "," : ".";

  const groupSep = decimalSep === "," ? "." : ",";
  const [intPart, ...rest] = text.split(decimalSep);
  if (rest.length > 1) {
    throw new FixedParseError(input, "more than one decimal separator");
  }
  const fractionPart = rest[0] ?? "";

  // A single separator with exactly three trailing digits is a thousand
  // group, not a decimal point: "1,234" is 1234, never 1.234.
  if (rest.length === 1 && !intPart.includes(groupSep)) {
    const digitsOnly = /^\d+$/.test(fractionPart);
    if (digitsOnly && fractionPart.length === 3 && !/^[+-]?0$/.test(intPart)) {
      return fixedFromString(`${intPart}${fractionPart}`);
    }
  }

  const sign = /^[+-]/.test(intPart) ? intPart[0] : "";
  const groups = intPart.replace(/^[+-]/, "").split(groupSep);
  if (groups.length > 1) {
    const [first, ...others] = groups;
    if (first.length === 0 || first.length > 3) {
      throw new FixedParseError(input, "malformed thousand grouping");
    }
    if (others.some((g) => g.length !== 3)) {
      throw new FixedParseError(input, "malformed thousand grouping");
    }
  }

  return fixedFromString(`${sign}${groups.join("")}.${fractionPart || "0"}`);
}

export function fixedFromInteger(value: number | bigint): Fixed {
  if (typeof value === "number" && !Number.isInteger(value)) {
    throw new FixedParseError(String(value), "expected an integer");
  }
  return (BigInt(value) * SCALE_FACTOR) as Fixed;
}

export function fixedAdd(a: Fixed, b: Fixed): Fixed {
  return (a + b) as Fixed;
}

export function fixedSubtract(a: Fixed, b: Fixed): Fixed {
  return (a - b) as Fixed;
}

export function fixedNegate(a: Fixed): Fixed {
  return -a as Fixed;
}

export function fixedCompare(a: Fixed, b: Fixed): -1 | 0 | 1 {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function fixedIsZero(a: Fixed): boolean {
  return a === 0n;
}

export function fixedIsNegative(a: Fixed): boolean {
  return a < 0n;
}

/** Rounds a scaled BigInt back down to FIXED_SCALE after a multiplication. */
function rescale(raw: bigint, divisor: bigint, mode: RoundingMode): bigint {
  const quotient = raw / divisor;
  const remainder = raw % divisor;
  if (remainder === 0n || mode === "down") return quotient;
  // Half-up away from zero: 2.5 -> 3, -2.5 -> -3. Matches how brokerage
  // statements and Turkish invoices round, and keeps |x| symmetric.
  const twice = (remainder < 0n ? -remainder : remainder) * 2n;
  if (twice >= divisor) return quotient + (raw < 0n ? -1n : 1n);
  return quotient;
}

export function fixedMultiply(
  a: Fixed,
  b: Fixed,
  mode: RoundingMode = "half-up",
): Fixed {
  return rescale(a * b, SCALE_FACTOR, mode) as Fixed;
}

export class DivisionByZeroError extends Error {
  constructor() {
    super("Division by zero");
    this.name = "DivisionByZeroError";
  }
}

export function fixedDivide(
  a: Fixed,
  b: Fixed,
  mode: RoundingMode = "half-up",
): Fixed {
  if (b === 0n) throw new DivisionByZeroError();
  return rescale(a * SCALE_FACTOR, b, mode) as Fixed;
}

/** Renders a `Fixed` without locale formatting — for storage and tests. */
export function fixedToString(value: Fixed): string {
  const negative = value < 0n;
  const magnitude = negative ? -value : value;
  const whole = magnitude / SCALE_FACTOR;
  const fraction = (magnitude % SCALE_FACTOR)
    .toString()
    .padStart(FIXED_SCALE, "0")
    .replace(/0+$/, "");
  const sign = negative ? "-" : "";
  return fraction ? `${sign}${whole}.${fraction}` : `${sign}${whole}`;
}

/**
 * Converts to a `number` for chart libraries and Intl formatting only.
 *
 * Never feed the result back into a calculation: that is exactly the precision
 * loss this module exists to prevent.
 */
export function fixedToNumber(value: Fixed): number {
  return Number(value) / Number(SCALE_FACTOR);
}
