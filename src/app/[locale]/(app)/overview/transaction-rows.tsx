import { CASH_FLOW_SIGN, type Transaction } from "@/lib/finance/types";
import type { Locale } from "@/lib/i18n/config";
import { formatDate, formatMoney } from "@/lib/i18n/format";
import { createTranslator } from "@/lib/i18n/translate";

/**
 * A compact transaction list.
 *
 * Rendered as a definition-style list rather than a table on small screens and
 * a three-column grid above that, because squeezing a five-column table into
 * 360px is what produces horizontal scrolling. Direction is shown with a
 * leading sign and the type name, not with colour alone.
 */
export function TransactionRows({
  transactions,
  labels,
  locale,
}: {
  transactions: readonly Transaction[];
  labels: Record<string, string>;
  locale: Locale;
}) {
  const { t } = createTranslator(locale);

  if (transactions.length === 0) {
    return (
      <p className="py-6 text-sm text-muted">
        {t("emptyStates.transactionsFilteredTitle")}
      </p>
    );
  }

  return (
    <ul className="flex flex-col">
      {transactions.map((transaction) => {
        const outgoing = CASH_FLOW_SIGN[transaction.kind] === -1;
        const category = transaction.categoryId
          ? (labels[transaction.categoryId] ?? t("categories.uncategorised"))
          : t("categories.uncategorised");

        return (
          <li
            key={transaction.id}
            className="flex items-baseline justify-between gap-4 border-b border-divider py-3 last:border-b-0"
          >
            <div className="min-w-0">
              <p className="truncate text-sm text-ink">
                {transaction.description || category}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                <span>{formatDate(transaction.occurredOn, locale)}</span>
                <span aria-hidden="true"> · </span>
                <span>{category}</span>
                <span aria-hidden="true"> · </span>
                <span>{t(`transactionKinds.${transaction.kind}`)}</span>
              </p>
            </div>
            <p
              className={`tabular shrink-0 text-sm font-medium ${
                outgoing ? "text-ink" : "text-positive"
              }`}
            >
              <span aria-hidden="true">{outgoing ? "−" : "+"}</span>
              {formatMoney(transaction.amount, locale)}
              <span className="sr-only">
                {" "}
                {t(outgoing ? "a11y.negativeAmount" : "a11y.positiveAmount")}
              </span>
            </p>
          </li>
        );
      })}
    </ul>
  );
}
