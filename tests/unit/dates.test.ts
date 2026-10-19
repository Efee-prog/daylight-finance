import { describe, expect, it } from "vitest";

import {
  InvalidDateError,
  addMonthsToPeriod,
  assertCalendarDate,
  daysInMonth,
  isCalendarDate,
  monthKey,
  monthRange,
  periodRange,
  previousMonthRange,
  recentMonthPeriods,
  today,
  trailingMonthsRange,
} from "@/lib/dates/ranges";

describe("validation", () => {
  it("accepts real calendar dates", () => {
    expect(isCalendarDate("2026-10-19")).toBe(true);
    expect(isCalendarDate("2028-02-29")).toBe(true);
  });

  it("rejects dates that do not exist", () => {
    for (const bad of [
      "2026-02-30",
      "2026-13-01",
      "2026-00-10",
      "2026-10-32",
      "2027-02-29",
      "19.10.2026",
      "2026-10-9",
      "",
    ]) {
      expect(isCalendarDate(bad), bad).toBe(false);
    }
    expect(() => assertCalendarDate("2026-02-30")).toThrow(InvalidDateError);
  });
});

describe("month boundaries", () => {
  it("knows month lengths including leap years", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });

  it("builds an inclusive month range", () => {
    expect(monthRange("2026-10-19")).toEqual({
      start: "2026-10-01",
      end: "2026-10-31",
    });
    expect(monthRange("2028-02-05")).toEqual({
      start: "2028-02-01",
      end: "2028-02-29",
    });
  });

  it("derives the period key", () => {
    expect(monthKey("2026-10-19")).toBe("2026-10");
  });
});

describe("period arithmetic", () => {
  it("rolls over year boundaries in both directions", () => {
    expect(addMonthsToPeriod("2026-12", 1)).toBe("2027-01");
    expect(addMonthsToPeriod("2026-01", -1)).toBe("2025-12");
    expect(addMonthsToPeriod("2026-10", -12)).toBe("2025-10");
    expect(addMonthsToPeriod("2026-10", 15)).toBe("2028-01");
  });

  it("lists trailing periods oldest first", () => {
    expect(recentMonthPeriods("2026-10-19", 3)).toEqual([
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
    expect(recentMonthPeriods("2026-01-15", 2)).toEqual(["2025-12", "2026-01"]);
    expect(recentMonthPeriods("2026-10-19", 0)).toEqual([]);
  });

  it("spans a trailing range from the first to the last day", () => {
    expect(trailingMonthsRange("2026-10-19", 6)).toEqual({
      start: "2026-05-01",
      end: "2026-10-31",
    });
  });

  it("builds a range from a period key", () => {
    expect(periodRange("2026-02")).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
    });
  });

  it("finds the comparable previous month", () => {
    expect(previousMonthRange("2026-03-31")).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
    });
  });
});

describe("today", () => {
  it("resolves the calendar date in the requested timezone", () => {
    // 2026-10-19T22:30Z is already the 20th in Istanbul (UTC+3) and still the
    // 19th in Los Angeles. A naive UTC slice would report the 19th for both.
    const instant = new Date("2026-10-19T22:30:00.000Z");
    expect(today("Europe/Istanbul", instant)).toBe("2026-10-20");
    expect(today("America/Los_Angeles", instant)).toBe("2026-10-19");
    expect(today("UTC", instant)).toBe("2026-10-19");
  });
});
