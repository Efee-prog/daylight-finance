/**
 * Calendar arithmetic on YYYY-MM-DD strings.
 *
 * Daylight treats a transaction date as a *calendar date in the user's own
 * timezone*, not an instant. "19 October" is the same row whether the reader
 * is in Istanbul or Los Angeles, so the date never passes through a UTC
 * conversion where it could shift by a day. These helpers therefore work on
 * strings and small integers, and `new Date` appears only where UTC-pinned
 * construction makes month-end arithmetic safe.
 */

import type { DateRange } from "../finance/types";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class InvalidDateError extends Error {
  constructor(value: string) {
    super(`Expected a YYYY-MM-DD calendar date, received "${value}"`);
    this.name = "InvalidDateError";
  }
}

export function assertCalendarDate(value: string): void {
  if (!DATE_PATTERN.test(value)) throw new InvalidDateError(value);
  const [year, month, day] = value.split("-").map(Number);
  if (month < 1 || month > 12) throw new InvalidDateError(value);
  const maxDay = daysInMonth(year, month);
  if (day < 1 || day > maxDay) throw new InvalidDateError(value);
}

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    assertCalendarDate(value);
    return true;
  } catch {
    return false;
  }
}

export function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this one. Built in UTC so the
  // host timezone cannot shift the result.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Today's date in the given IANA timezone, as YYYY-MM-DD. */
export function today(timeZone: string, now: Date = new Date()): string {
  // `en-CA` yields ISO-ordered parts, which is what we want to reassemble.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** The YYYY-MM period a date belongs to. */
export function monthKey(date: string): string {
  assertCalendarDate(date);
  return date.slice(0, 7);
}

/** Inclusive range covering the whole calendar month containing `date`. */
export function monthRange(date: string): DateRange {
  assertCalendarDate(date);
  const [year, month] = date.split("-").map(Number);
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(daysInMonth(year, month))}`,
  };
}

/** Shifts a YYYY-MM period by a number of months. */
export function addMonthsToPeriod(period: string, delta: number): string {
  const [year, month] = period.split("-").map(Number);
  const zeroBased = year * 12 + (month - 1) + delta;
  return `${Math.floor(zeroBased / 12)}-${pad((zeroBased % 12) + 1)}`;
}

/**
 * The last `count` monthly periods ending with the month of `endDate`,
 * oldest first. Used to build a stable chart axis that keeps empty months
 * visible instead of collapsing them.
 */
export function recentMonthPeriods(endDate: string, count: number): string[] {
  if (count < 1) return [];
  const end = monthKey(endDate);
  return Array.from({ length: count }, (_, index) =>
    addMonthsToPeriod(end, index - (count - 1)),
  );
}

/** Inclusive range covering a whole YYYY-MM period. */
export function periodRange(period: string): DateRange {
  return monthRange(`${period}-01`);
}

/** Inclusive range covering the `count` months ending with `endDate`. */
export function trailingMonthsRange(endDate: string, count: number): DateRange {
  const periods = recentMonthPeriods(endDate, count);
  return {
    start: periodRange(periods[0]).start,
    end: periodRange(periods[periods.length - 1]).end,
  };
}

/** The equivalent range one period earlier, for period-over-period comparison. */
export function previousMonthRange(date: string): DateRange {
  const previous = addMonthsToPeriod(monthKey(date), -1);
  return periodRange(previous);
}
