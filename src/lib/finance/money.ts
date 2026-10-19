/**
 * Money: an integer amount in a currency's smallest unit, plus the currency.
 *
 * The currency is part of the value, not metadata alongside it. That is what
 * makes it impossible to write `total = tryAmount + usdAmount` by accident:
 * every binary operation asserts the codes match, and summing a mixed list
 * returns one total per currency rather than a single meaningless number.
 * Combining those totals requires an exchange rate the user has supplied —
 * see `convert()`, which refuses to guess.
 */

import {
  type Fixed,
  FIXED_SCALE,
  type RoundingMode,
  fixedFromString,
  fixedToString,
} from "./fixed";

/** Currencies Daylight knows how to store and format, with their exponents. */
export const CURRENCIES = {
  TRY: { exponent: 2 },
  USD: { exponent: 2 },
  EUR: { exponent: 2 },
  GBP: { exponent: 2 },
  JPY: { exponent: 0 },
  XAU: { exponent: 4 },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export const CURRENCY_CODES = Object.keys(CURRENCIES) as CurrencyCode[];

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === "string" && value in CURRENCIES;
}

export function currencyExponent(currency: CurrencyCode): number {
  return CURRENCIES[currency].exponent;
}

export interface Money {
  /** Amount in the currency's smallest unit. 12345n TRY is ₺123.45. */
  readonly minor: bigint;
  readonly currency: CurrencyCode;
}

export class CurrencyMismatchError extends Error {
  constructor(
    readonly left: CurrencyCode,
    readonly right: CurrencyCode,
  ) {
    super(
      `Cannot combine ${left} and ${right} without an exchange rate. ` +
        `Convert one side explicitly first.`,
    );
    this.name = "CurrencyMismatchError";
  }
}

export class UnknownCurrencyError extends Error {
  constructor(code: string) {
    super(`Unsupported currency code: ${code}`);
    this.name = "UnknownCurrencyError";
  }
}

export function money(minor: bigint | number, currency: CurrencyCode): Money {
  if (!isCurrencyCode(currency)) throw new UnknownCurrencyError(currency);
  if (typeof minor === "number" && !Number.isInteger(minor)) {
    throw new TypeError(
      `Minor units must be an integer, received ${minor}. ` +
        `Use moneyFromDecimalString for a value like "12.34".`,
    );
  }
  return { minor: BigInt(minor), currency };
}

export function zeroMoney(currency: CurrencyCode): Money {
  return money(0n, currency);
}

/** Builds Money from a plain decimal string such as "1234.56". */
export function moneyFromDecimalString(
  value: string,
  currency: CurrencyCode,
): Money {
  return moneyFromFixed(fixedFromString(value), currency);
}

/**
 * Converts a `Fixed` (8 decimals) to minor units, rounding half-up.
 *
 * This is the single place where precision is intentionally dropped, and the
 * only reason it is lossy is that currencies have a smallest unit: there is no
 * such thing as a third of a kuruş in a ledger entry.
 */
export function moneyFromFixed(
  value: Fixed,
  currency: CurrencyCode,
  mode: RoundingMode = "half-up",
): Money {
  const exponent = currencyExponent(currency);
  const divisor = 10n ** BigInt(FIXED_SCALE - exponent);
  const quotient = value / divisor;
  const remainder = value % divisor;
  if (remainder === 0n || mode === "down") {
    return money(quotient, currency);
  }
  const twice = (remainder < 0n ? -remainder : remainder) * 2n;
  const rounded = twice >= divisor ? quotient + (value < 0n ? -1n : 1n) : quotient;
  return money(rounded, currency);
}

/** Converts Money back to a `Fixed`, losslessly. */
export function moneyToFixed(value: Money): Fixed {
  const exponent = currencyExponent(value.currency);
  return (value.minor * 10n ** BigInt(FIXED_SCALE - exponent)) as Fixed;
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new CurrencyMismatchError(a.currency, b.currency);
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.minor + b.minor, a.currency);
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.minor - b.minor, a.currency);
}

export function negateMoney(a: Money): Money {
  return money(-a.minor, a.currency);
}

export function absMoney(a: Money): Money {
  return money(a.minor < 0n ? -a.minor : a.minor, a.currency);
}

export function compareMoney(a: Money, b: Money): -1 | 0 | 1 {
  assertSameCurrency(a, b);
  return a.minor < b.minor ? -1 : a.minor > b.minor ? 1 : 0;
}

export function isZeroMoney(a: Money): boolean {
  return a.minor === 0n;
}

export function isNegativeMoney(a: Money): boolean {
  return a.minor < 0n;
}

/** Scales Money by a `Fixed` factor — used for fee shares and allocations. */
export function multiplyMoney(
  a: Money,
  factor: Fixed,
  mode: RoundingMode = "half-up",
): Money {
  const scaleFactor = 10n ** BigInt(FIXED_SCALE);
  const raw = a.minor * factor;
  const quotient = raw / scaleFactor;
  const remainder = raw % scaleFactor;
  if (remainder === 0n || mode === "down") return money(quotient, a.currency);
  const twice = (remainder < 0n ? -remainder : remainder) * 2n;
  const rounded =
    twice >= scaleFactor ? quotient + (raw < 0n ? -1n : 1n) : quotient;
  return money(rounded, a.currency);
}

/**
 * A set of per-currency totals.
 *
 * Returned wherever a list may legitimately mix currencies. The UI shows each
 * currency on its own line and states that no combined total is available,
 * which is honest; a single fabricated number would not be.
 */
export type MoneyByCurrency = Partial<Record<CurrencyCode, Money>>;

export function sumByCurrency(amounts: readonly Money[]): MoneyByCurrency {
  const totals: MoneyByCurrency = {};
  for (const amount of amounts) {
    const running = totals[amount.currency];
    totals[amount.currency] = running
      ? addMoney(running, amount)
      : amount;
  }
  return totals;
}

export function currenciesIn(totals: MoneyByCurrency): CurrencyCode[] {
  return CURRENCY_CODES.filter((code) => totals[code] !== undefined);
}

/**
 * An exchange rate the user (or a future rate provider) supplied.
 * `asOf` is kept so the UI can disclose how stale a converted total is.
 */
export interface ExchangeRate {
  readonly from: CurrencyCode;
  readonly to: CurrencyCode;
  /** Units of `to` per one unit of `from`. */
  readonly rate: Fixed;
  readonly asOf: string;
}

export class MissingExchangeRateError extends Error {
  constructor(
    readonly from: CurrencyCode,
    readonly to: CurrencyCode,
  ) {
    super(`No exchange rate available from ${from} to ${to}`);
    this.name = "MissingExchangeRateError";
  }
}

export function convert(
  amount: Money,
  to: CurrencyCode,
  rates: readonly ExchangeRate[],
): Money {
  if (amount.currency === to) return amount;
  const direct = rates.find((r) => r.from === amount.currency && r.to === to);
  if (direct) {
    return moneyFromFixed(multiplyFixedByMoney(amount, direct.rate), to);
  }
  throw new MissingExchangeRateError(amount.currency, to);
}

function multiplyFixedByMoney(amount: Money, rate: Fixed): Fixed {
  const asFixed = moneyToFixed(amount);
  const scaleFactor = 10n ** BigInt(FIXED_SCALE);
  const raw = asFixed * rate;
  const quotient = raw / scaleFactor;
  const remainder = raw % scaleFactor;
  if (remainder === 0n) return quotient as Fixed;
  const twice = (remainder < 0n ? -remainder : remainder) * 2n;
  return (twice >= scaleFactor
    ? quotient + (raw < 0n ? -1n : 1n)
    : quotient) as Fixed;
}

/** Plain decimal string, e.g. "1234.56" — for CSV export and tests. */
export function moneyToDecimalString(value: Money): string {
  return fixedToString(moneyToFixed(value));
}
