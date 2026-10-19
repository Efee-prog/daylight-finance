"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { useTranslator } from "@/components/i18n/locale-provider";
import {
  Button,
  FormField,
  Input,
  Select,
} from "@/components/ui/primitives";
import type { CategoryView } from "@/lib/db/categories";
import { CURRENCY_CODES, type CurrencyCode } from "@/lib/finance/money";
import { TRANSACTION_KINDS, type TransactionKind } from "@/lib/finance/types";
import type { Locale } from "@/lib/i18n/config";

import {
  type TransactionFormState,
  createTransaction,
  editTransaction,
} from "./actions";

export interface TransactionFormValues {
  readonly id?: string;
  readonly kind: TransactionKind;
  readonly amount: string;
  readonly currency: CurrencyCode;
  readonly occurredOn: string;
  readonly description: string;
  readonly categoryId: string | null;
}

/**
 * The create/edit form.
 *
 * The category list is filtered to the selected kind, so an expense cannot be
 * filed under an income category — the server checks the same pairing, since a
 * mismatch would quietly corrupt every budget fed by that category.
 */
export function TransactionForm({
  locale,
  categories,
  defaultCurrency,
  today,
  initial,
  onDone,
}: {
  locale: Locale;
  categories: readonly CategoryView[];
  defaultCurrency: CurrencyCode;
  today: string;
  initial?: TransactionFormValues;
  onDone?: () => void;
}) {
  const { t } = useTranslator();
  const [kind, setKind] = useState<TransactionKind>(initial?.kind ?? "expense");
  const formRef = useRef<HTMLFormElement>(null);

  const [state, formAction, pending] = useActionState<
    TransactionFormState,
    FormData
  >(
    async (previous, formData) =>
      initial?.id
        ? editTransaction(locale, initial.id, previous, formData)
        : createTransaction(locale, previous, formData),
    {},
  );

  useEffect(() => {
    if (state.success) {
      if (!initial?.id) formRef.current?.reset();
      onDone?.();
    }
  }, [state.success, initial?.id, onDone]);

  const needsCategory = kind === "income" || kind === "expense";
  const relevantCategories = categories.filter((category) =>
    kind === "income" ? category.kind === "income" : category.kind === "expense",
  );

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      className="flex flex-col gap-5 border border-divider bg-surface p-5 sm:p-6"
    >
      {state.error ? (
        <p
          role="alert"
          className="border-l-2 border-negative px-3 py-2 text-sm text-negative"
        >
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          id="kind"
          label={t("transactions.fieldKind")}
          error={state.fieldErrors?.kind}
        >
          <Select
            id="kind"
            name="kind"
            value={kind}
            onChange={(event) =>
              setKind(event.target.value as TransactionKind)
            }
          >
            {TRANSACTION_KINDS.map((value) => (
              <option key={value} value={value}>
                {t(`transactionKinds.${value}`)}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField
          id="occurredOn"
          label={t("transactions.fieldDate")}
          error={state.fieldErrors?.occurredOn}
          required
          requiredLabel={t("common.required")}
        >
          <Input
            id="occurredOn"
            name="occurredOn"
            type="date"
            defaultValue={initial?.occurredOn ?? today}
            max={today}
            required
            invalid={Boolean(state.fieldErrors?.occurredOn)}
          />
        </FormField>

        <FormField
          id="amount"
          label={t("transactions.fieldAmount")}
          error={state.fieldErrors?.amount}
          required
          requiredLabel={t("common.required")}
        >
          <Input
            id="amount"
            name="amount"
            // `inputMode="decimal"` gives a numeric keypad on mobile while
            // still accepting both "1.234,56" and "1,234.56" as typed.
            inputMode="decimal"
            autoComplete="off"
            placeholder="0,00"
            defaultValue={initial?.amount}
            required
            invalid={Boolean(state.fieldErrors?.amount)}
          />
        </FormField>

        <FormField
          id="currency"
          label={t("transactions.fieldCurrency")}
          error={state.fieldErrors?.currency}
        >
          <Select
            id="currency"
            name="currency"
            defaultValue={initial?.currency ?? defaultCurrency}
          >
            {CURRENCY_CODES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </Select>
        </FormField>

        {needsCategory ? (
          <FormField
            id="categoryId"
            label={t("transactions.fieldCategory")}
            error={state.fieldErrors?.categoryId}
            required
            requiredLabel={t("common.required")}
          >
            <Select
              id="categoryId"
              name="categoryId"
              defaultValue={initial?.categoryId ?? ""}
              invalid={Boolean(state.fieldErrors?.categoryId)}
            >
              <option value="">{t("validation.categoryRequired")}</option>
              {relevantCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </Select>
          </FormField>
        ) : null}

        <div className={needsCategory ? "sm:col-span-1" : "sm:col-span-2"}>
          <FormField
            id="description"
            label={t("transactions.fieldDescription")}
            error={state.fieldErrors?.description}
            requiredLabel={t("common.optional")}
            required
          >
            <Input
              id="description"
              name="description"
              maxLength={240}
              placeholder={t("transactions.descriptionPlaceholder")}
              defaultValue={initial?.description}
            />
          </FormField>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Disabled while the action is in flight, so an impatient second
            click cannot create a duplicate record. */}
        <Button type="submit" disabled={pending}>
          {pending ? t("common.saving") : t("common.save")}
        </Button>
        {onDone ? (
          <Button type="button" variant="quiet" onClick={onDone}>
            {t("common.cancel")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
