import { notFound } from "next/navigation";

import { LocaleProvider } from "@/components/i18n/locale-provider";
import { isLocale } from "@/lib/i18n/config";

/**
 * Sets the language for everything below it.
 *
 * `lang` is written here rather than in the root layout because it has to
 * match the content: screen readers choose their pronunciation from it, and
 * announcing Turkish copy with an English voice is unintelligible.
 */
export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <LocaleProvider locale={locale}>
      <div lang={locale} className="min-h-dvh">
        {children}
      </div>
    </LocaleProvider>
  );
}
