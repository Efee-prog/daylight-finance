/**
 * Locale configuration.
 *
 * Turkish is the default: Daylight is built for a Turkish-speaking user first,
 * and English is the equal-weight second language rather than the base one.
 */

export const LOCALES = ["tr", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "tr";

/** The BCP 47 tag Intl is given for each locale. */
export const INTL_LOCALE: Record<Locale, string> = {
  tr: "tr-TR",
  en: "en-US",
};

/** Cookie that remembers the choice across page loads and sessions. */
export const LOCALE_COOKIE = "daylight_locale";
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Picks a locale from an untrusted value, falling back to the default.
 * Used for the URL segment, the cookie and the Accept-Language header alike,
 * so none of them can push an unsupported tag into Intl.
 */
export function resolveLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Best match from an Accept-Language header, for a first-time visitor. */
export function localeFromAcceptLanguage(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  const tags = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="))
        ?.slice(2);
      return { tag: (tag ?? "").toLowerCase(), quality: q ? Number(q) : 1 };
    })
    .filter((entry) => entry.tag !== "" && !Number.isNaN(entry.quality))
    .sort((a, b) => b.quality - a.quality);

  for (const { tag } of tags) {
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}
