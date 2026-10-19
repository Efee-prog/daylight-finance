import type { Metadata } from "next";
import Link from "next/link";

import { CashFlowChart } from "@/components/charts/cash-flow-chart";
import {
  Button,
  EmptyState,
  MetricDisplay,
  Notice,
  PageHeader,
  Section,
} from "@/components/ui/primitives";
import { requireSession } from "@/lib/auth/session";
import {
  recentMonthPeriods,
  today,
  trailingMonthsRange,
} from "@/lib/dates/ranges";
import { categoryLabels, listCategories } from "@/lib/db/categories";
import { loadAllTransactions } from "@/lib/db/transactions";
import {
  buildMonthlyCashFlow,
  calculateCashBalance,
  calculateExpenses,
  calculateIncome,
  calculateNetCashFlow,
  calculateSavingsRate,
  calculateSpendingByCategory,
  filterByDateRange,
} from "@/lib/finance/cashflow";
import {
  currenciesIn,
  currencyExponent,
  zeroMoney,
} from "@/lib/finance/money";
import { resolveLocale } from "@/lib/i18n/config";
import { formatDateRange, formatMoney, formatPercent } from "@/lib/i18n/format";
import { createTranslator } from "@/lib/i18n/translate";

import { TransactionRows } from "./transaction-rows";

const TREND_MONTHS = 6;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/overview">): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: createTranslator(resolveLocale(locale)).t("navigation.overview"),
  };
}

function greetingKey(hour: number) {
  if (hour < 12) return "overview.greetingMorning" as const;
  if (hour < 18) return "overview.greetingAfternoon" as const;
  return "overview.greetingEvening" as const;
}

/**
 * The Overview screen.
 *
 * Everything on this page is derived from the user's own rows by the pure
 * functions in lib/finance. Nothing is seeded, sampled or interpolated: where
 * there is no data the page says so rather than rendering a zero, and where a
 * figure is undefined (a savings rate with no income) it shows a dash with an
 * explanation instead of 0%.
 */
export default async function OverviewPage({
  params,
}: PageProps<"/[locale]/overview">) {
  const { locale: raw } = await params;
  const locale = resolveLocale(raw);
  const session = await requireSession(locale);
  const translator = createTranslator(locale);
  const { t } = translator;

  const currency = session.defaultCurrency;
  const todayDate = today(session.timeZone);
  const range = trailingMonthsRange(todayDate, 1);
  const trendRange = trailingMonthsRange(todayDate, TREND_MONTHS);

  const [allTransactions, categories] = await Promise.all([
    loadAllTransactions(),
    listCategories(translator),
  ]);

  const labels = categoryLabels(categories);
  const periodTransactions = filterByDateRange(allTransactions, range);
  const trendTransactions = filterByDateRange(allTransactions, trendRange);

  // The balance spans every record ever entered; the summary figures are
  // scoped to the selected month. Mixing the two is a common way for a
  // dashboard to state a number nobody can reconcile.
  const balances = calculateCashBalance(allTransactions);
  const income = calculateIncome(periodTransactions);
  const expenses = calculateExpenses(periodTransactions);
  const net = calculateNetCashFlow(periodTransactions);
  const savingsRate = calculateSavingsRate(periodTransactions, currency);

  const series = buildMonthlyCashFlow(
    trendTransactions,
    recentMonthPeriods(todayDate, TREND_MONTHS),
    currency,
  );

  const spending = calculateSpendingByCategory(periodTransactions, currency);
  const topCategory = spending[0];

  const hourInZone = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hour12: false,
      timeZone: session.timeZone,
    }).format(new Date()),
  );

  // Chart libraries take numbers, so the conversion happens once, here, at
  // the presentation edge - and uses the currency's own exponent rather than
  // assuming two decimal places.
  const majorDivisor = 10 ** currencyExponent(currency);
  const toMajor = (minor: bigint) => Number(minor) / majorDivisor;

  const balanceCurrencies = currenciesIn(balances);
  const balance = balances[currency] ?? zeroMoney(currency);
  const isEmpty = allTransactions.length === 0;

  return (
    <>
      <PageHeader
        title={`${t(greetingKey(hourInZone))}${
          session.displayName ? `, ${session.displayName}` : ""
        }`}
        subtitle={formatDateRange(range.start, range.end, locale)}
        actions={
          <Link href={`/${locale}/transactions?new=1`}>
            <Button>{t("transactions.addTransaction")}</Button>
          </Link>
        }
      />

      {isEmpty ? (
        <EmptyState
          title={t("emptyStates.transactionsTitle")}
          body={t("emptyStates.transactionsBody")}
          action={
            <Link href={`/${locale}/transactions?new=1`}>
              <Button>{t("transactions.addTransaction")}</Button>
            </Link>
          }
        />
      ) : (
        <>
          <Section>
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-2">
                <MetricDisplay
                  size="large"
                  label={t("overview.cashBalance")}
                  value={formatMoney(balance, locale)}
                  hint={t("overview.cashBalanceHint")}
                  tone={balance.minor < 0n ? "negative" : "neutral"}
                />
              </div>
              <MetricDisplay
                label={t("overview.income")}
                value={formatMoney(income[currency] ?? zeroMoney(currency), locale)}
                tone="positive"
              />
              <MetricDisplay
                label={t("overview.expenses")}
                value={formatMoney(
                  expenses[currency] ?? zeroMoney(currency),
                  locale,
                )}
              />
              <MetricDisplay
                label={t("overview.netCashFlow")}
                value={formatMoney(net[currency] ?? zeroMoney(currency), locale)}
                tone={
                  (net[currency]?.minor ?? 0n) < 0n ? "negative" : "positive"
                }
              />
              <MetricDisplay
                label={t("overview.savingsRate")}
                value={formatPercent(savingsRate, locale)}
                hint={
                  savingsRate === null
                    ? t("overview.savingsRateUnavailable")
                    : t("insights.savingsFormula")
                }
                tone={savingsRate === null ? "muted" : "neutral"}
              />
            </div>

            {balanceCurrencies.length > 1 ? (
              <Notice tone="caution">
                {t("overview.multiCurrencyNotice")}
                <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
                  {balanceCurrencies.map((code) => {
                    const amount = balances[code];
                    return amount ? (
                      <li key={code} className="tabular text-ink">
                        {formatMoney(amount, locale, { useCode: true })}
                      </li>
                    ) : null;
                  })}
                </ul>
              </Notice>
            ) : null}
          </Section>

          <Section
            title={t("overview.trendTitle")}
            description={t("overview.trendSubtitle", { months: TREND_MONTHS })}
          >
            <CashFlowChart
              points={series.map((point) => ({
                period: point.period,
                income: point.hasData ? toMajor(point.income.minor) : null,
                expenses: point.hasData ? toMajor(point.expenses.minor) : null,
                hasData: point.hasData,
              }))}
              locale={locale}
              currency={currency}
            />
          </Section>

          <Section
            title={t("overview.insightsTitle")}
            className="max-w-prose"
          >
            {topCategory ? (
              <ul className="flex flex-col gap-3 text-sm leading-relaxed text-ink">
                <li className="border-l-2 border-olive pl-4">
                  {t("insightMessages.topCategory", {
                    category: topCategory.categoryId
                      ? (labels.get(topCategory.categoryId) ??
                        t("categories.uncategorised"))
                      : t("categories.uncategorised"),
                  })}
                </li>
                {savingsRate !== null && savingsRate > 0n ? (
                  <li className="border-l-2 border-olive pl-4">
                    {t("insightMessages.savedShare", {
                      percent: formatPercent(savingsRate, locale).replace(
                        /[%\s]/g,
                        "",
                      ),
                    })}
                  </li>
                ) : null}
              </ul>
            ) : (
              <div>
                <p className="text-sm text-ink">
                  {t("insightMessages.notEnoughData")}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {t("insightMessages.notEnoughDataHint")}
                </p>
              </div>
            )}
          </Section>

          <Section
            title={t("overview.recentTransactions")}
            actions={
              <Link
                href={`/${locale}/transactions`}
                className="text-xs text-muted underline underline-offset-4 hover:text-ink"
              >
                {t("overview.viewAllTransactions")}
              </Link>
            }
          >
            <TransactionRows
              transactions={allTransactions.slice(0, 6)}
              labels={Object.fromEntries(labels)}
              locale={locale}
            />
          </Section>
        </>
      )}
    </>
  );
}
