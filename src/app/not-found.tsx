import Link from "next/link";

import { createTranslator } from "@/lib/i18n/translate";
import { DEFAULT_LOCALE } from "@/lib/i18n/config";

/**
 * The 404 page sits above the locale segment, so it cannot know the user's
 * language from the URL and falls back to the default.
 */
export default function NotFound() {
  const { t } = createTranslator(DEFAULT_LOCALE);

  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="max-w-md">
        <p className="font-serif text-title text-muted">{t("brand.name")}</p>
        <h1 className="mt-4 font-serif text-headline text-ink">
          {t("errors.notFoundTitle")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {t("errors.notFoundBody")}
        </p>
        <Link
          href={`/${DEFAULT_LOCALE}/overview`}
          className="mt-6 inline-block text-sm font-medium text-ink underline underline-offset-4"
        >
          {t("navigation.overview")}
        </Link>
      </div>
    </main>
  );
}
