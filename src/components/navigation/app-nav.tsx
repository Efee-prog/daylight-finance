"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useTranslator } from "@/components/i18n/locale-provider";
import { cx } from "@/components/ui/primitives";
import type { Locale } from "@/lib/i18n/config";
import type { MessageKey } from "@/lib/i18n/translate";
import { type AppSection, appPath } from "@/lib/routes";

/**
 * Navigation, in two forms from one source of truth.
 *
 * Desktop gets a quiet left rail; narrow screens get a bottom bar for the
 * primary destinations plus a sheet for the rest. The mobile layout is a
 * different arrangement rather than a shrunken copy of the desktop one, which
 * is what produces the horizontal overflow this product is meant to avoid.
 */
interface NavItem {
  readonly segment: AppSection;
  readonly labelKey: MessageKey;
  /** Shown in the bottom bar on small screens. */
  readonly primary: boolean;
}

const NAV_ITEMS: readonly NavItem[] = [
  { segment: "overview", labelKey: "navigation.overview", primary: true },
  { segment: "transactions", labelKey: "navigation.transactions", primary: true },
  { segment: "budgets", labelKey: "navigation.budgets", primary: true },
  { segment: "goals", labelKey: "navigation.goals", primary: false },
  { segment: "portfolio", labelKey: "navigation.portfolio", primary: true },
  { segment: "insights", labelKey: "navigation.insights", primary: false },
  { segment: "settings", labelKey: "navigation.settings", primary: false },
];

function useActiveSegment(locale: Locale): string {
  const pathname = usePathname();
  const prefix = `/${locale}/`;
  const rest = pathname.startsWith(prefix)
    ? pathname.slice(prefix.length)
    : pathname.replace(/^\//, "");
  return rest.split("/")[0] ?? "";
}

export function DesktopNav({
  locale,
  children,
}: {
  locale: Locale;
  children?: React.ReactNode;
}) {
  const { t } = useTranslator();
  const active = useActiveSegment(locale);

  return (
    <nav
      aria-label={t("navigation.mainNavigation")}
      className="hidden lg:flex lg:w-60 lg:shrink-0 lg:flex-col lg:justify-between lg:border-r lg:border-divider lg:px-6 lg:py-8"
    >
      <div>
        <Link
          href={appPath(locale, "overview")}
          className="font-serif text-title text-ink"
        >
          {t("brand.name")}
        </Link>
        <ul className="mt-10 flex flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = active === item.segment;
            return (
              <li key={item.segment}>
                <Link
                  href={appPath(locale, item.segment)}
                  aria-current={isActive ? "page" : undefined}
                  className={cx(
                    "flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors duration-150",
                    isActive
                      ? "bg-sage font-medium text-ink"
                      : "text-muted hover:bg-sage/60 hover:text-ink",
                  )}
                >
                  {/* The active marker is a rule, not just a colour: tone
                      alone is not a reliable signal. */}
                  <span
                    aria-hidden="true"
                    className={cx(
                      "h-4 w-px",
                      isActive ? "bg-ink" : "bg-divider",
                    )}
                  />
                  {t(item.labelKey)}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </nav>
  );
}

export function MobileNav({
  locale,
  children,
}: {
  locale: Locale;
  children?: React.ReactNode;
}) {
  const { t } = useTranslator();
  const active = useActiveSegment(locale);
  const [open, setOpen] = useState(false);

  const primary = NAV_ITEMS.filter((item) => item.primary);
  const secondary = NAV_ITEMS.filter((item) => !item.primary);

  return (
    <>
      <header className="flex items-center justify-between border-b border-divider px-5 py-4 lg:hidden">
        <Link
          href={appPath(locale, "overview")}
          className="font-serif text-title text-ink"
        >
          {t("brand.name")}
        </Link>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="mobile-more"
          className="rounded-sm px-3 py-2 text-sm text-muted hover:bg-sage hover:text-ink"
        >
          {t(open ? "navigation.closeMenu" : "navigation.openMenu")}
        </button>
      </header>

      {open ? (
        <div
          id="mobile-more"
          className="border-b border-divider bg-surface px-5 py-3 lg:hidden"
        >
          <ul className="flex flex-col gap-0.5">
            {secondary.map((item) => (
              <li key={item.segment}>
                <Link
                  href={appPath(locale, item.segment)}
                  onClick={() => setOpen(false)}
                  aria-current={active === item.segment ? "page" : undefined}
                  className={cx(
                    "block rounded-sm px-3 py-2.5 text-sm",
                    active === item.segment
                      ? "bg-sage font-medium text-ink"
                      : "text-muted",
                  )}
                >
                  {t(item.labelKey)}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-col gap-3 border-t border-divider pt-3">
            {children}
          </div>
        </div>
      ) : null}

      <nav
        aria-label={t("navigation.mainNavigation")}
        className="fixed inset-x-0 bottom-0 z-10 border-t border-divider bg-paper/95 backdrop-blur lg:hidden"
      >
        <ul className="grid grid-cols-4">
          {primary.map((item) => {
            const isActive = active === item.segment;
            return (
              <li key={item.segment}>
                <Link
                  href={appPath(locale, item.segment)}
                  aria-current={isActive ? "page" : undefined}
                  className={cx(
                    "flex flex-col items-center gap-1 px-1 py-3 text-[11px] leading-tight",
                    isActive ? "font-semibold text-ink" : "text-muted",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cx(
                      "h-px w-5",
                      isActive ? "bg-ink" : "bg-transparent",
                    )}
                  />
                  <span className="text-center">{t(item.labelKey)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
