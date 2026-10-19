import { createTranslator } from "@/lib/i18n/translate";
import { resolveLocale } from "@/lib/i18n/config";

/**
 * The signed-out shell.
 *
 * An asymmetric two-column composition: the brand statement holds the left
 * third on a sage field, the form sits on paper to its right. Deliberately not
 * a centred card on a gradient, which is the default look this product is
 * trying not to have.
 */
export default async function AuthLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  const { t } = createTranslator(resolveLocale(locale));

  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <aside className="flex flex-col justify-between gap-12 bg-sage px-8 py-12 lg:px-12 lg:py-16">
        <p className="font-serif text-title text-ink">{t("brand.name")}</p>
        <div className="max-w-sm">
          <p className="font-serif text-display text-ink">
            {t("brand.tagline")}
          </p>
          <p className="mt-6 text-sm leading-relaxed text-muted">
            {t("brand.supporting")}
          </p>
        </div>
        <p className="text-xs text-muted">
          {/* Stated plainly on the sign-in screen: this build holds whatever
              the user types and nothing else. */}
          {locale === "tr"
            ? "Banka hesabı bağlantısı yoktur. Yalnızca kendi girdiğiniz kayıtlar saklanır."
            : "No bank connection. Only the records you enter yourself are stored."}
        </p>
      </aside>
      <main className="flex items-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
