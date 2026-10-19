"use client";

import { usePathname, useRouter } from "next/navigation";

import { useTranslator } from "@/components/i18n/locale-provider";
import { LOCALES, type Locale } from "@/lib/i18n/config";
import { cx } from "@/components/ui/primitives";
import { withLocale } from "@/lib/routes";

/**
 * Switches language without losing the user's place.
 *
 * Only the locale segment of the path is swapped, so filters, the selected
 * period and the record being viewed all survive the change - which is the
 * difference between a language switch and being thrown back to the start.
 */
export function LanguageSwitcher({ current }: { current: Locale }) {
  const { t } = useTranslator();
  const pathname = usePathname();
  const router = useRouter();

  function switchTo(locale: Locale) {
    if (locale === current) return;
    router.push(withLocale(pathname, locale));
  }

  return (
    <div className="flex items-center gap-1">
      <span className="sr-only">{t("common.language")}</span>
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => switchTo(locale)}
          aria-current={locale === current ? "true" : undefined}
          className={cx(
            "rounded-sm px-2 py-1 text-xs uppercase transition-colors duration-150",
            locale === current
              ? "bg-sage font-semibold text-ink"
              : "text-muted hover:text-ink",
          )}
        >
          {locale}
        </button>
      ))}
    </div>
  );
}
