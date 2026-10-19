import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { DesktopNav, MobileNav } from "@/components/navigation/app-nav";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { requireSession } from "@/lib/auth/session";
import { resolveLocale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";

/**
 * The authenticated shell.
 *
 * `requireSession` runs here so every page beneath it can assume a verified
 * user, and an expired session lands on sign-in rather than on a page full of
 * empty figures. It is not the security boundary - Row Level Security is -
 * but it is what makes the signed-out experience coherent.
 */
export default async function AppLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale: raw } = await params;
  const locale = resolveLocale(raw);
  const session = await requireSession(locale);
  const { t } = createTranslator(locale);

  const accountPanel = (
    <>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-ink">
          {session.displayName || session.email}
        </p>
        {session.displayName ? (
          <p className="truncate text-xs text-muted">{session.email}</p>
        ) : null}
      </div>
      <LanguageSwitcher current={locale} />
      <SignOutButton locale={locale} />
    </>
  );

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-20 focus:rounded-sm focus:bg-ink focus:px-3 focus:py-2 focus:text-sm focus:text-paper"
      >
        {t("navigation.skipToContent")}
      </a>

      <MobileNav locale={locale}>{accountPanel}</MobileNav>
      <DesktopNav locale={locale}>{accountPanel}</DesktopNav>

      <main
        id="main"
        /* pb-24 on small screens clears the fixed bottom navigation. */
        className="min-w-0 flex-1 px-5 pt-8 pb-24 sm:px-8 lg:px-12 lg:py-10 lg:pb-16"
      >
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-10">
          {children}
        </div>
      </main>
    </div>
  );
}
