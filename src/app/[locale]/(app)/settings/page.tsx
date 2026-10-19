import type { Metadata } from "next";

import { PageHeader, Section } from "@/components/ui/primitives";
import { SettingsForm } from "@/features/settings/settings-form";
import { requireSession } from "@/lib/auth/session";
import { resolveLocale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/settings">): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: createTranslator(resolveLocale(locale)).t("navigation.settings"),
  };
}

export default async function SettingsPage({
  params,
}: PageProps<"/[locale]/settings">) {
  const { locale: raw } = await params;
  const locale = resolveLocale(raw);
  const session = await requireSession(locale);
  const { t } = createTranslator(locale);

  return (
    <>
      <PageHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />
      <Section title={t("settings.sectionAppearance")}>
        <SettingsForm
          locale={locale}
          email={session.email}
          displayName={session.displayName}
          defaultCurrency={session.defaultCurrency}
          timeZone={session.timeZone}
        />
      </Section>
    </>
  );
}
