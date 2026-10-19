import type { Metadata } from "next";
import { Suspense } from "react";

import { PageHeader, Section } from "@/components/ui/primitives";
import { TransactionManager } from "@/features/transactions/transaction-manager";
import { requireSession } from "@/lib/auth/session";
import { today } from "@/lib/dates/ranges";
import { listCategories } from "@/lib/db/categories";
import { listTransactions } from "@/lib/db/transactions";
import { moneyToDecimalString } from "@/lib/finance/money";
import { resolveLocale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/transactions">): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: createTranslator(resolveLocale(locale)).t("navigation.transactions"),
  };
}

const PAGE_SIZE = 50;

/**
 * The transactions screen.
 *
 * Reads the first page from the database rather than everything the user has
 * ever recorded: pagination belongs in SQL, because a few years of daily
 * entries is tens of thousands of rows.
 */
export default async function TransactionsPage({
  params,
}: PageProps<"/[locale]/transactions">) {
  const { locale: raw } = await params;
  const locale = resolveLocale(raw);
  const session = await requireSession(locale);
  const translator = createTranslator(locale);
  const { t } = translator;

  const [{ transactions, total }, categories] = await Promise.all([
    listTransactions({ pageSize: PAGE_SIZE }),
    listCategories(translator),
  ]);

  const items = transactions.map((transaction) => ({
    id: transaction.id,
    kind: transaction.kind,
    // BigInt cannot cross the server/client boundary, so the exact integer
    // travels as a string and is rebuilt as a BigInt for formatting.
    amountMinor: transaction.amount.minor.toString(),
    currency: transaction.amount.currency,
    // The decimal form is what the edit form puts back in the amount field.
    amountDecimal: moneyToDecimalString(transaction.amount),
    occurredOn: transaction.occurredOn,
    description: transaction.description,
    categoryId: transaction.categoryId,
  }));

  return (
    <>
      <PageHeader
        title={t("transactions.title")}
        subtitle={t("transactions.subtitle")}
      />

      <Section
        description={
          total > 0 ? t("common.resultCount", { count: total }) : undefined
        }
      >
        {/* useSearchParams needs a Suspense boundary during prerender. */}
        <Suspense
          fallback={<p className="text-sm text-muted">{t("common.loading")}</p>}
        >
          <TransactionManager
            locale={locale}
            categories={categories}
            defaultCurrency={session.defaultCurrency}
            today={today(session.timeZone)}
            items={items}
            hasAnyRecords={total > 0}
          />
        </Suspense>
      </Section>
    </>
  );
}
