import { describe, expect, it } from "vitest";

import { fixedFromString } from "@/lib/finance/fixed";
import { moneyFromDecimalString } from "@/lib/finance/money";
import {
  DEFAULT_LOCALE,
  LOCALES,
  localeFromAcceptLanguage,
  resolveLocale,
} from "@/lib/i18n/config";
import {
  formatDate,
  formatMoney,
  formatMonth,
  formatPercent,
  formatQuantity,
  formatUnitPrice,
} from "@/lib/i18n/format";
import { en } from "@/lib/i18n/messages/en";
import { tr } from "@/lib/i18n/messages/tr";
import { createTranslator, interpolate } from "@/lib/i18n/translate";

/**
 * Intl separates a currency code from the number with a non-breaking space
 * (U+00A0), not a plain one. Normalising the actual value keeps that invisible
 * character out of this file, where it would be impossible to review.
 */
function normalizeSpaces(value: string): string {
  return value.replace(/\s/g, " ");
}

/** Collects every dot path in a catalogue, for structural comparison. */
function paths(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") return [prefix];
  if (typeof value !== "object" || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) =>
    paths(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("catalogue integrity", () => {
  it("has the same keys in both languages", () => {
    const turkish = paths(tr).sort();
    const english = paths(en).sort();
    expect(english).toEqual(turkish);
  });

  it("has no empty strings", () => {
    for (const catalogue of [tr, en]) {
      const empties = paths(catalogue).filter((path) => {
        const value = path
          .split(".")
          .reduce<unknown>(
            (node, key) => (node as Record<string, unknown>)[key],
            catalogue,
          );
        return typeof value === "string" && value.trim() === "";
      });
      expect(empties).toEqual([]);
    }
  });

  it("uses matching placeholders in both languages", () => {
    const placeholders = (text: string) =>
      [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

    for (const path of paths(tr)) {
      const read = (catalogue: unknown) =>
        path
          .split(".")
          .reduce<unknown>(
            (node, key) => (node as Record<string, unknown>)[key],
            catalogue,
          ) as string;
      // A placeholder present in one language but not the other means one of
      // them silently drops a value at runtime.
      expect(placeholders(read(en)), path).toEqual(placeholders(read(tr)));
    }
  });

  it("renders Turkish characters intact", () => {
    expect(tr.categories.dining_out).toBe("Yeme-içme");
    expect(tr.insights.title).toBe("Analizler");
    expect(tr.navigation.skipToContent).toBe("İçeriğe geç");
    expect(tr.settings.timeZoneHint).toContain("“Bugün”");
  });
});

describe("locale resolution", () => {
  it("defaults to Turkish", () => {
    expect(DEFAULT_LOCALE).toBe("tr");
    expect(LOCALES).toEqual(["tr", "en"]);
  });

  it("falls back for anything unsupported", () => {
    expect(resolveLocale("en")).toBe("en");
    expect(resolveLocale("de")).toBe("tr");
    expect(resolveLocale(undefined)).toBe("tr");
    expect(resolveLocale({ nope: true })).toBe("tr");
  });

  it("reads Accept-Language by quality", () => {
    expect(localeFromAcceptLanguage("en-GB,en;q=0.9,tr;q=0.8")).toBe("en");
    expect(localeFromAcceptLanguage("tr-TR,tr;q=0.9,en;q=0.8")).toBe("tr");
    expect(localeFromAcceptLanguage("de-DE,fr;q=0.9,en;q=0.5")).toBe("en");
    expect(localeFromAcceptLanguage("de-DE")).toBe("tr");
    expect(localeFromAcceptLanguage(null)).toBe("tr");
  });
});

describe("translation", () => {
  it("looks up nested keys", () => {
    expect(createTranslator("tr").t("navigation.overview")).toBe("Genel Bakış");
    expect(createTranslator("en").t("navigation.overview")).toBe("Overview");
  });

  it("fills placeholders", () => {
    expect(
      createTranslator("tr").t("common.page", { current: 2, total: 7 }),
    ).toBe("Sayfa 2 / 7");
    expect(
      createTranslator("en").t("common.page", { current: 2, total: 7 }),
    ).toBe("Page 2 of 7");
  });

  it("leaves an unfilled placeholder visible rather than printing undefined", () => {
    expect(interpolate("Sayfa {current} / {total}", { current: 1 })).toBe(
      "Sayfa 1 / {total}",
    );
  });

  it("returns undefined for a runtime key that does not exist", () => {
    const t = createTranslator("tr");
    expect(t.tOptional("categories.groceries")).toBe("Market");
    // A user-created category has no system key, so the caller must fall back
    // to the user's own text instead of printing a raw key.
    expect(t.tOptional("categories.my_own_category")).toBeUndefined();
  });
});

describe("money formatting", () => {
  const amount = moneyFromDecimalString("12450.75", "TRY");

  it("matches the documented Turkish and English forms", () => {
    expect(formatMoney(amount, "tr")).toBe("₺12.450,75");
    expect(normalizeSpaces(formatMoney(amount, "en"))).toBe("TRY 12,450.75");
  });

  it("keeps precision beyond Number.MAX_SAFE_INTEGER", () => {
    const huge = moneyFromDecimalString("9007199254740993.99", "TRY");
    expect(formatMoney(huge, "tr")).toBe("₺9.007.199.254.740.993,99");
  });

  it("uses the stored precision, not Intl's default, for XAU", () => {
    // Intl renders XAU with two decimals; Daylight stores four.
    const gold = moneyFromDecimalString("2.5075", "XAU");
    expect(normalizeSpaces(formatMoney(gold, "en"))).toBe("XAU 2.5075");
  });

  it("omits minor units for currencies that have none", () => {
    expect(formatMoney(moneyFromDecimalString("1500", "JPY"), "tr")).toBe(
      "¥1.500",
    );
  });

  it("can drop the fraction for headline figures", () => {
    expect(formatMoney(amount, "tr", { compactFraction: true })).toBe("₺12.451");
  });

  it("can show an explicit sign for change indicators", () => {
    expect(
      formatMoney(moneyFromDecimalString("250", "TRY"), "tr", {
        signDisplay: "always",
      }),
    ).toContain("+");
  });

  it("formats negative amounts", () => {
    const loss = moneyFromDecimalString("-842.10", "TRY");
    expect(formatMoney(loss, "tr")).toContain("842,10");
    expect(formatMoney(loss, "tr")).toContain("-");
  });
});

describe("percent, quantity and price formatting", () => {
  it("formats a ratio per locale", () => {
    expect(formatPercent(fixedFromString("0.185"), "tr")).toBe("%18,5");
    expect(formatPercent(fixedFromString("0.185"), "en")).toBe("18.5%");
  });

  it("renders an undefined ratio as a dash, never as zero percent", () => {
    expect(formatPercent(null, "tr")).toBe("—");
    expect(formatPercent(null, "en")).toBe("—");
  });

  it("formats fractional quantities without trailing noise", () => {
    expect(formatQuantity(fixedFromString("0.0415"), "en")).toBe("0.0415");
    expect(formatQuantity(fixedFromString("40"), "tr")).toBe("40");
  });

  it("gives unit prices extra precision", () => {
    expect(
      normalizeSpaces(formatUnitPrice(fixedFromString("0.1234"), "TRY", "en")),
    ).toBe("TRY 0.1234");
  });
});

describe("date formatting", () => {
  it("formats a calendar date in both locales", () => {
    expect(formatDate("2026-10-19", "tr")).toBe("19 Eki 2026");
    expect(formatDate("2026-10-19", "en")).toBe("Oct 19, 2026");
  });

  it("does not shift the day across timezones", () => {
    // The first of the month must not render as the last day of the previous
    // one, which is what happens if a calendar date is parsed as midnight UTC
    // and then formatted in a negative-offset zone.
    expect(formatDate("2026-10-01", "tr")).toContain("1 Eki");
    expect(formatDate("2026-01-01", "en")).toContain("Jan 1");
  });

  it("formats a month label for chart axes", () => {
    expect(formatMonth("2026-10", "tr")).toBe("Eki 2026");
    expect(formatMonth("2026-10", "en")).toBe("Oct 2026");
  });

  it("formats a short numeric date", () => {
    expect(formatDate("2026-10-19", "tr", "short")).toBe("19.10.2026");
  });
});
