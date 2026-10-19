import { EmptyState, Notice, PageHeader, Section } from "./primitives";
import type { Locale } from "@/lib/i18n/config";
import { createTranslator, type MessageKey } from "@/lib/i18n/translate";

/**
 * A module whose data model, calculations and tests exist but whose screens are
 * not built yet.
 *
 * It says so plainly. The alternative — rendering plausible-looking figures
 * from sample data — would be worse than an empty page: a finance tool that
 * shows numbers a user cannot trace to their own records has lost the only
 * thing it was for.
 */
export function PlannedModule({
  locale,
  titleKey,
  subtitleKey,
  emptyTitleKey,
  emptyBodyKey,
  readyNote,
}: {
  locale: Locale;
  titleKey: MessageKey;
  subtitleKey: MessageKey;
  emptyTitleKey: MessageKey;
  emptyBodyKey: MessageKey;
  /** What is already implemented beneath the surface, in both languages. */
  readyNote: Record<Locale, string>;
}) {
  const { t } = createTranslator(locale);

  return (
    <>
      <PageHeader title={t(titleKey)} subtitle={t(subtitleKey)} />
      <Section>
        <EmptyState title={t(emptyTitleKey)} body={t(emptyBodyKey)} />
        <Notice
          title={
            locale === "tr"
              ? "Bu ekran henüz hazır değil"
              : "This screen is not built yet"
          }
        >
          {readyNote[locale]}
        </Notice>
      </Section>
    </>
  );
}
