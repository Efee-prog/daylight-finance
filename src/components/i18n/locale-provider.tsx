"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

import { type Locale } from "@/lib/i18n/config";
import { type Translator, createTranslator } from "@/lib/i18n/translate";

/**
 * Makes the translator available to Client Components.
 *
 * Server Components call `createTranslator(locale)` directly - no context
 * needed, and no catalogue shipped to the browser for pages that are fully
 * server-rendered. This provider exists only for the interactive parts.
 */
const LocaleContext = createContext<Translator | null>(null);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const translator = useMemo(() => createTranslator(locale), [locale]);
  return (
    <LocaleContext.Provider value={translator}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useTranslator(): Translator {
  const translator = useContext(LocaleContext);
  if (!translator) {
    throw new Error("useTranslator must be used inside a LocaleProvider");
  }
  return translator;
}
