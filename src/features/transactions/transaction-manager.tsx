"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { useTranslator } from "@/components/i18n/locale-provider";
import { Button, EmptyState, cx } from "@/components/ui/primitives";
import type { CategoryView } from "@/lib/db/categories";
import type { CurrencyCode } from "@/lib/finance/money";
import { CASH_FLOW_SIGN } from "@/lib/finance/types";
import type { Locale } from "@/lib/i18n/config";
import { formatDate, formatMoney } from "@/lib/i18n/format";

import { removeTransaction } from "./actions";
import { TransactionForm, type TransactionFormValues } from "./transaction-form";

export interface TransactionListItem {
  readonly id: string;
  readonly kind: TransactionFormValues["kind"];
  readonly amountMinor: string;
  readonly currency: CurrencyCode;
  readonly amountDecimal: string;
  readonly occurredOn: string;
  readonly description: string;
  readonly categoryId: string | null;
}

/**
 * The transactions screen: list, create, edit and delete.
 *
 * Deleting asks first and the dialog states exactly which record will go and
 * what else will change as a result, because a user cannot weigh a destructive
 * action they cannot see the contents of. After any write the server
 * revalidates the affected routes, so balances, budgets and charts recompute
 * from the database rather than being patched client-side.
 */
export function TransactionManager({
  locale,
  categories,
  defaultCurrency,
  today,
  items,
  hasAnyRecords,
}: {
  locale: Locale;
  categories: readonly CategoryView[];
  defaultCurrency: CurrencyCode;
  today: string;
  items: readonly TransactionListItem[];
  hasAnyRecords: boolean;
}) {
  const { t } = useTranslator();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [creating, setCreating] = useState(searchParams.get("new") === "1");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const labels = new Map(categories.map((c) => [c.id, c.label]));

  function closeCreate() {
    setCreating(false);
    // Drop ?new=1 so a refresh does not reopen the form.
    if (searchParams.get("new")) router.replace(`/${locale}/transactions`);
  }

  function confirmDelete(id: string) {
    startTransition(async () => {
      const result = await removeTransaction(locale, id);
      if (result.error) {
        setDeleteError(result.error);
        return;
      }
      setDeleteError(null);
      setConfirmingId(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center gap-3">
        {creating ? null : (
          <Button onClick={() => setCreating(true)}>
            {t("transactions.addTransaction")}
          </Button>
        )}
      </div>

      {creating ? (
        <section aria-label={t("transactions.newTransaction")}>
          <h2 className="mb-3 font-serif text-title text-ink">
            {t("transactions.newTransaction")}
          </h2>
          <TransactionForm
            locale={locale}
            categories={categories}
            defaultCurrency={defaultCurrency}
            today={today}
            onDone={closeCreate}
          />
        </section>
      ) : null}

      {deleteError ? (
        <p
          role="alert"
          className="border-l-2 border-negative px-3 py-2 text-sm text-negative"
        >
          {deleteError}
        </p>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          title={t(
            hasAnyRecords
              ? "emptyStates.transactionsFilteredTitle"
              : "emptyStates.transactionsTitle",
          )}
          body={t(
            hasAnyRecords
              ? "emptyStates.transactionsFilteredBody"
              : "emptyStates.transactionsBody",
          )}
          action={
            hasAnyRecords ? null : (
              <Button onClick={() => setCreating(true)}>
                {t("transactions.addTransaction")}
              </Button>
            )
          }
        />
      ) : (
        <ul className="flex flex-col">
          {items.map((item) => {
            const outgoing = CASH_FLOW_SIGN[item.kind] === -1;
            const category = item.categoryId
              ? (labels.get(item.categoryId) ?? t("categories.uncategorised"))
              : t("categories.uncategorised");
            const money = formatMoney(
              { minor: BigInt(item.amountMinor), currency: item.currency },
              locale,
            );

            if (editingId === item.id) {
              return (
                <li key={item.id} className="border-b border-divider py-4">
                  <h2 className="mb-3 font-serif text-title text-ink">
                    {t("transactions.editTransaction")}
                  </h2>
                  <TransactionForm
                    locale={locale}
                    categories={categories}
                    defaultCurrency={defaultCurrency}
                    today={today}
                    initial={{
                      id: item.id,
                      kind: item.kind,
                      amount: item.amountDecimal,
                      currency: item.currency,
                      occurredOn: item.occurredOn,
                      description: item.description,
                      categoryId: item.categoryId,
                    }}
                    onDone={() => {
                      setEditingId(null);
                      router.refresh();
                    }}
                  />
                </li>
              );
            }

            return (
              <li key={item.id} className="border-b border-divider">
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">
                      {item.description || category}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      <span>{formatDate(item.occurredOn, locale)}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{category}</span>
                      <span aria-hidden="true"> · </span>
                      <span>{t(`transactionKinds.${item.kind}`)}</span>
                    </p>
                  </div>

                  <p
                    className={cx(
                      "tabular shrink-0 text-sm font-medium",
                      outgoing ? "text-ink" : "text-positive",
                    )}
                  >
                    <span aria-hidden="true">{outgoing ? "−" : "+"}</span>
                    {money}
                  </p>

                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="quiet"
                      className="px-2 py-1 text-xs"
                      onClick={() => setEditingId(item.id)}
                    >
                      {t("common.edit")}
                    </Button>
                    <Button
                      variant="quiet"
                      className="px-2 py-1 text-xs"
                      onClick={() => {
                        setConfirmingId(item.id);
                        setDeleteError(null);
                      }}
                    >
                      {t("common.delete")}
                    </Button>
                  </div>
                </div>

                {confirmingId === item.id ? (
                  <div
                    role="alertdialog"
                    aria-label={t("transactions.deleteTitle")}
                    className="mb-4 border-l-2 border-negative bg-surface px-4 py-4"
                  >
                    <p className="text-sm font-medium text-ink">
                      {t("transactions.deleteTitle")}
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted">
                      {t("transactions.deleteBody", {
                        date: formatDate(item.occurredOn, locale),
                        amount: money,
                        description: item.description || category,
                      })}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      {t("transactions.deleteConsequence")}
                    </p>
                    <div className="mt-4 flex gap-2">
                      <Button
                        variant="danger"
                        disabled={pending}
                        onClick={() => confirmDelete(item.id)}
                      >
                        {pending ? t("common.deleting") : t("common.delete")}
                      </Button>
                      <Button
                        variant="quiet"
                        onClick={() => setConfirmingId(null)}
                      >
                        {t("common.cancel")}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
