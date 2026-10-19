import type { Route } from "next";

import type { Locale } from "./i18n/config";

/**
 * Builds in-app hrefs.
 *
 * Next's typed-route checking cannot narrow a path assembled at runtime, and
 * every route in Daylight sits under the dynamic `[locale]` segment, so every
 * href is assembled. Rather than scattering an `as Route` cast across each
 * Link, the assertion lives here once. The segment is constrained to the
 * app's actual sections, which is what keeps a typo from compiling.
 */
export const APP_SECTIONS = [
  "overview",
  "transactions",
  "budgets",
  "goals",
  "portfolio",
  "insights",
  "settings",
] as const;

export type AppSection = (typeof APP_SECTIONS)[number];

export type AuthSection = "sign-in" | "sign-up";

export function appPath(
  locale: Locale,
  section: AppSection,
  search?: string,
): Route {
  return `/${locale}/${section}${search ? `?${search}` : ""}` as Route;
}

export function authPath(locale: Locale, section: AuthSection): Route {
  return `/${locale}/${section}` as Route;
}

/** Replaces the locale segment of the current path, keeping everything else. */
export function withLocale(pathname: string, locale: Locale): Route {
  const segments = pathname.split("/");
  // segments[0] is the empty string before the leading slash.
  segments[1] = locale;
  return segments.join("/") as Route;
}
