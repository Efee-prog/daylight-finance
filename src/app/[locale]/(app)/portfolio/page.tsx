import type { Metadata } from "next";

import { PlannedModule } from "@/components/ui/planned-module";
import { requireSession } from "@/lib/auth/session";
import { resolveLocale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/portfolio">): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: createTranslator(resolveLocale(locale)).t("navigation.portfolio"),
  };
}

export default async function PortfolioPage({
  params,
}: PageProps<"/[locale]/portfolio">) {
  const { locale: raw } = await params;
  const locale = resolveLocale(raw);
  await requireSession(locale);

  return (
    <PlannedModule
      locale={locale}
      titleKey="portfolio.title"
      subtitleKey="portfolio.subtitle"
      emptyTitleKey="emptyStates.portfolioTitle"
      emptyBodyKey="emptyStates.portfolioBody"
      readyNote={{
        tr:
          "Varlık, işlem ve fiyat geçmişi tabloları ile ortalama maliyet motoru " +
          "(komisyon dahil maliyet, gerçekleşmiş/gerçekleşmemiş kâr-zarar, fazla satış " +
          "koruması, fiyatı olmayan varlığın toplamdan dışlanması, çoklu para biriminde " +
          "tek toplam üretmeme) yazıldı ve test edildi. Eksik olan bu ekran.",
        en:
          "The asset, trade and price-history tables and the average-cost engine are " +
          "written and tested: cost including fees, realised and unrealised profit, the " +
          "oversell guard, excluding unpriced assets from totals, and refusing to produce " +
          "a single total across currencies. Only this screen is missing.",
      }}
    />
  );
}
