import type { Metadata } from "next";

import { PlannedModule } from "@/components/ui/planned-module";
import { requireSession } from "@/lib/auth/session";
import { resolveLocale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/goals">): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: createTranslator(resolveLocale(locale)).t("navigation.goals"),
  };
}

export default async function GoalsPage({
  params,
}: PageProps<"/[locale]/goals">) {
  const { locale: raw } = await params;
  const locale = resolveLocale(raw);
  await requireSession(locale);

  return (
    <PlannedModule
      locale={locale}
      titleKey="goals.title"
      subtitleKey="goals.subtitle"
      emptyTitleKey="emptyStates.goalsTitle"
      emptyBodyKey="emptyStates.goalsBody"
      readyNote={{
        tr:
          "Hedef tabloları, para birimi tutarlılığını zorlayan tetikleyici ve ilerleme " +
          "hesaplaması (birikmiş, kalan, yüzde, fazla çekim koruması) yazıldı ve test edildi. " +
          "Hedef bakiyesi nakit bakiyeye bilinçli olarak eklenmez. Eksik olan bu ekran.",
        en:
          "The goal tables, the trigger enforcing currency consistency and the progress " +
          "calculation (saved, remaining, percentage and the overdraw guard) are written " +
          "and tested. A goal balance is deliberately never added to the cash balance. " +
          "Only this screen is missing.",
      }}
    />
  );
}
