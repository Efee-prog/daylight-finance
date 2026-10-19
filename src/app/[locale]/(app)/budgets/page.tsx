import type { Metadata } from "next";

import { PlannedModule } from "@/components/ui/planned-module";
import { requireSession } from "@/lib/auth/session";
import { resolveLocale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/budgets">): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: createTranslator(resolveLocale(locale)).t("navigation.budgets"),
  };
}

export default async function BudgetsPage({
  params,
}: PageProps<"/[locale]/budgets">) {
  const { locale: raw } = await params;
  const locale = resolveLocale(raw);
  await requireSession(locale);

  return (
    <PlannedModule
      locale={locale}
      titleKey="budgets.title"
      subtitleKey="budgets.subtitle"
      emptyTitleKey="emptyStates.budgetsTitle"
      emptyBodyKey="emptyStates.budgetsBody"
      readyNote={{
        tr:
          "Bütçe tablosu, RLS politikaları ve kullanım hesaplaması (harcanan, kalan, " +
          "yüzde, limit aşımı; sıfır ve negatif limit dahil) yazıldı ve birim testleriyle " +
          "doğrulandı. Eksik olan yalnızca bu ekranın formları ve listesi.",
        en:
          "The budgets table, its RLS policies and the usage calculation (spent, " +
          "remaining, percentage and overrun, including zero and negative limits) are " +
          "written and covered by unit tests. Only this screen's forms and list are missing.",
      }}
    />
  );
}
