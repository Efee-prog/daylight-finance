import type { Metadata } from "next";

import { PlannedModule } from "@/components/ui/planned-module";
import { requireSession } from "@/lib/auth/session";
import { resolveLocale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/insights">): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: createTranslator(resolveLocale(locale)).t("navigation.insights"),
  };
}

export default async function InsightsPage({
  params,
}: PageProps<"/[locale]/insights">) {
  const { locale: raw } = await params;
  const locale = resolveLocale(raw);
  await requireSession(locale);

  return (
    <PlannedModule
      locale={locale}
      titleKey="insights.title"
      subtitleKey="insights.subtitle"
      emptyTitleKey="emptyStates.insightsTitle"
      emptyBodyKey="emptyStates.insightsBody"
      readyNote={{
        tr:
          "Dönem karşılaştırması, kategori dağılımı ve tasarruf oranı hesaplamaları " +
          "yazıldı ve test edildi; veri olmayan ay ile sıfır değerli ay birbirinden " +
          "ayrılıyor. Genel Bakış ekranı bu fonksiyonların bir kısmını zaten kullanıyor.",
        en:
          "The period comparison, category breakdown and savings-rate calculations are " +
          "written and tested, and a month with no records is kept distinct from a month " +
          "that netted zero. The Overview screen already uses part of this.",
      }}
    />
  );
}
