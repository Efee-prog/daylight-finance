/**
 * Locale-aware formatting of money, numbers, percentages and dates.
 *
 * Two rules hold everywhere in this file:
 *
 *  1. Amounts are handed to Intl as *decimal strings*, never as JavaScript
 *     numbers. Intl accepts a string and formats it exactly, so a balance of
 *     9.007.199.254.740.993,99 ₺ renders correctly instead of being rounded by
 *     the double conversion on the way in.
 *  2. Fraction digits come from Daylight's own currency table, not from Intl's
 *     defaults. Intl renders XAU with two decimals; Daylight tracks it with
 *     four, and the displayed precision has to match the stored precision.
 *
 * No amount is ever assembled by concatenating a symbol onto a number.
 */

import {
  type Fixed,
  fixedToString,
} from "../finance/fixed";
import {
  type CurrencyCode,
  type Money,
  currencyExponent,
  moneyToDecimalString,
} from "../finance/money";
import { INTL_LOCALE, type Locale } from "./config";

// Intl formatter construction is not free and these are called per table row,
// so each distinct configuration is built once and reused.
const numberFormatters = new Map<string, Intl.NumberFormat>();
const dateFormatters = new Map<string, Intl.DateTimeFormat>();

function numberFormatter(
  locale: Locale,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = `${locale}:${JSON.stringify(options)}`;
  let formatter = numberFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(INTL_LOCALE[locale], options);
    numberFormatters.set(key, formatter);
  }
  return formatter;
}

function dateFormatter(
  locale: Locale,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${locale}:${JSON.stringify(options)}`;
  let formatter = dateFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(INTL_LOCALE[locale], options);
    dateFormatters.set(key, formatter);
  }
  return formatter;
}

// Intl types the argument as number | bigint, but the specification accepts a
// string and formats it without precision loss. This narrow assertion is the
// one place that fact is relied upon.
type IntlValue = Parameters<Intl.NumberFormat["format"]>[0];
const asIntlValue = (decimal: string) => decimal as unknown as IntlValue;

export interface MoneyFormatOptions {
  /**
   * Drop the fraction part. Used for large headline figures where two decimals
   * add noise rather than information. Off by default: a transaction amount
   * must always show its kuruş.
   */
  readonly compactFraction?: boolean;
  /** Render the code (TRY) rather than the symbol (₺). */
  readonly useCode?: boolean;
  /** Always show a leading + or −, for change indicators. */
  readonly signDisplay?: Intl.NumberFormatOptions["signDisplay"];
}

/**
 * Formats Money for display, e.g. ₺12.450,75 in Turkish and
 * TRY 12,450.75 in English.
 */
export function formatMoney(
  amount: Money,
  locale: Locale,
  options: MoneyFormatOptions = {},
): string {
  const digits = options.compactFraction ? 0 : currencyExponent(amount.currency);
  return numberFormatter(locale, {
    style: "currency",
    currency: amount.currency,
    currencyDisplay: options.useCode ? "code" : "symbol",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    signDisplay: options.signDisplay,
  }).format(asIntlValue(moneyToDecimalString(amount)));
}

/**
 * The currency's own symbol or code on its own, for labelling a column or
 * stating which currency a total is expressed in.
 */
export function formatCurrencyName(
  currency: CurrencyCode,
  locale: Locale,
): string {
  const parts = numberFormatter(locale, {
    style: "currency",
    currency,
    currencyDisplay: "symbol",
  }).formatToParts(asIntlValue("0"));
  return parts.find((part) => part.type === "currency")?.value ?? currency;
}

/** Formats a bare quantity, such as units of an asset. */
export function formatQuantity(
  quantity: Fixed,
  locale: Locale,
  maximumFractionDigits = 8,
): string {
  return numberFormatter(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(asIntlValue(fixedToString(quantity)));
}

/** Formats a unit price, which may need more precision than a money amount. */
export function formatUnitPrice(
  price: Fixed,
  currency: CurrencyCode,
  locale: Locale,
): string {
  return numberFormatter(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: currencyExponent(currency),
    maximumFractionDigits: Math.max(currencyExponent(currency), 4),
  }).format(asIntlValue(fixedToString(price)));
}

/**
 * Formats a 0–1 ratio as a percentage: %18,5 in Turkish, 18.5% in English.
 *
 * `null` means the ratio is undefined — no income, a zero budget limit — and
 * is rendered as an em dash rather than 0%, which would be a different claim.
 */
export function formatPercent(
  ratio: Fixed | null,
  locale: Locale,
  maximumFractionDigits = 1,
): string {
  if (ratio === null) return "—";
  return numberFormatter(locale, {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(asIntlValue(fixedToString(ratio)));
}

export type DateStyle = "short" | "medium" | "long";

/**
 * Formats a YYYY-MM-DD calendar date.
 *
 * The date is pinned to UTC noon before formatting. A calendar date has no
 * time, so any timezone applied to midnight risks shifting the day; noon is
 * far enough from both boundaries that no real timezone can move it.
 */
export function formatDate(
  date: string,
  locale: Locale,
  style: DateStyle = "medium",
): string {
  const options: Intl.DateTimeFormatOptions =
    style === "short"
      ? { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }
      : style === "long"
        ? { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }
        : { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" };
  return dateFormatter(locale, options).format(new Date(`${date}T12:00:00Z`));
}

/** Formats a YYYY-MM period as a month label for a chart axis. */
export function formatMonth(
  period: string,
  locale: Locale,
  style: "short" | "long" = "short",
): string {
  return dateFormatter(locale, {
    month: style,
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${period}-01T12:00:00Z`));
}

/** Formats an inclusive date range, e.g. "1 – 31 Eki 2026". */
export function formatDateRange(
  start: string,
  end: string,
  locale: Locale,
): string {
  const options: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  };
  return dateFormatter(locale, options).formatRange(
    new Date(`${start}T12:00:00Z`),
    new Date(`${end}T12:00:00Z`),
  );
}

/**
 * Formats a precise instant, used for "price recorded at" disclosures where
 * the time of day is part of the information.
 */
export function formatTimestamp(
  isoTimestamp: string,
  locale: Locale,
  timeZone: string,
): string {
  return dateFormatter(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(isoTimestamp));
}

/**
 * How long ago an observation was made, in whole days, as a localised phrase.
 * Used to disclose a stale manual price.
 */
export function formatRelativeDays(
  days: number,
  locale: Locale,
): string {
  return new Intl.RelativeTimeFormat(INTL_LOCALE[locale], {
    numeric: "auto",
  }).format(-Math.abs(days), "day");
}
