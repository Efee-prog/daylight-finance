"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSession } from "@/lib/auth/session";
import { isCalendarDate } from "@/lib/dates/ranges";
import {
  deleteTransaction,
  getTransaction,
  insertTransaction,
  updateTransaction,
} from "@/lib/db/transactions";
import { FixedParseError, parseLocaleDecimal } from "@/lib/finance/fixed";
import {
  CURRENCY_CODES,
  type CurrencyCode,
  moneyFromFixed,
} from "@/lib/finance/money";
import { TRANSACTION_KINDS } from "@/lib/finance/types";
import { type Locale, resolveLocale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";

/**
 * Transaction write actions.
 *
 * Server-side validation is authoritative. The browser form checks the same
 * rules for immediacy, but nothing here trusts that it did: a request built by
 * hand gets the same treatment. The signed-in user comes from `requireSession`,
 * never from the submitted data, and Row Level Security scopes the statement
 * regardless.
 */

const MAX_DESCRIPTION = 240;
/**
 * A ceiling on a single entry. It exists to catch a mistyped amount - an extra
 * five zeros on a grocery bill - not to limit what a user may legitimately
 * record, which is why it is set far above any plausible real transaction.
 */
const MAX_AMOUNT_MINOR = 10n ** 15n;

export interface TransactionFormState {
  readonly error?: string;
  readonly fieldErrors?: Record<string, string>;
  readonly success?: boolean;
}

const baseSchema = z.object({
  kind: z.enum(TRANSACTION_KINDS),
  currency: z.enum(CURRENCY_CODES as [CurrencyCode, ...CurrencyCode[]]),
  occurredOn: z.string().refine(isCalendarDate),
  description: z.string().trim().max(MAX_DESCRIPTION),
  categoryId: z.string().uuid().nullable(),
  amount: z.string().trim().min(1),
});

function readForm(formData: FormData) {
  const rawCategory = formData.get("categoryId");
  return {
    kind: formData.get("kind"),
    currency: formData.get("currency"),
    occurredOn: formData.get("occurredOn"),
    description: formData.get("description") ?? "",
    categoryId:
      typeof rawCategory === "string" && rawCategory !== ""
        ? rawCategory
        : null,
    amount: formData.get("amount"),
  };
}

function validate(
  formData: FormData,
  locale: Locale,
):
  | { ok: true; value: {
      kind: (typeof TRANSACTION_KINDS)[number];
      currency: CurrencyCode;
      occurredOn: string;
      description: string;
      categoryId: string | null;
      amountMinor: bigint;
    } }
  | { ok: false; state: TransactionFormState } {
  const { t } = createTranslator(locale);
  const parsed = baseSchema.safeParse(readForm(formData));

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "");
      fieldErrors[field] =
        field === "occurredOn"
          ? t("validation.dateInvalid")
          : field === "amount"
            ? t("validation.amountRequired")
            : field === "currency"
              ? t("validation.currencyInvalid")
              : field === "description"
                ? t("validation.tooLong", { max: MAX_DESCRIPTION })
                : t("validation.required");
    }
    return { ok: false, state: { fieldErrors, error: t("errors.validationFailed") } };
  }

  const data = parsed.data;

  // Accepts both "1.234,56" and "1,234.56" so a Turkish keyboard and an
  // English one both work without the user thinking about it.
  let amountMinor: bigint;
  try {
    const fixed = parseLocaleDecimal(data.amount);
    amountMinor = moneyFromFixed(fixed, data.currency).minor;
  } catch (error) {
    return {
      ok: false,
      state: {
        fieldErrors: {
          amount:
            error instanceof FixedParseError
              ? t("validation.amountInvalid")
              : t("validation.amountInvalid"),
        },
        error: t("errors.validationFailed"),
      },
    };
  }

  if (amountMinor <= 0n) {
    return {
      ok: false,
      state: {
        fieldErrors: { amount: t("validation.amountPositive") },
        error: t("errors.validationFailed"),
      },
    };
  }
  if (amountMinor > MAX_AMOUNT_MINOR) {
    return {
      ok: false,
      state: {
        fieldErrors: { amount: t("validation.amountTooLarge") },
        error: t("errors.validationFailed"),
      },
    };
  }

  // An income row filed under an expense category would corrupt every budget
  // that category feeds, so the pairing is checked rather than assumed.
  if ((data.kind === "income" || data.kind === "expense") && !data.categoryId) {
    return {
      ok: false,
      state: {
        fieldErrors: { categoryId: t("validation.categoryRequired") },
        error: t("errors.validationFailed"),
      },
    };
  }

  return {
    ok: true,
    value: {
      kind: data.kind,
      currency: data.currency,
      occurredOn: data.occurredOn,
      description: data.description,
      // Transfers are not category spending, so any category sent with one is
      // dropped rather than stored and later counted.
      categoryId:
        data.kind === "income" || data.kind === "expense"
          ? data.categoryId
          : null,
      amountMinor,
    },
  };
}

export async function createTransaction(
  rawLocale: Locale,
  _previous: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const locale = resolveLocale(rawLocale);
  const session = await requireSession(locale);
  const { t } = createTranslator(locale);

  const result = validate(formData, locale);
  if (!result.ok) return result.state;

  try {
    await insertTransaction(session.userId, {
      kind: result.value.kind,
      amount: { minor: result.value.amountMinor, currency: result.value.currency },
      occurredOn: result.value.occurredOn,
      description: result.value.description,
      categoryId: result.value.categoryId,
    });
  } catch {
    // The underlying message may name a table or constraint; the user gets a
    // readable sentence while the detail stays server-side.
    return { error: t("errors.genericBody") };
  }

  revalidatePath(`/${locale}/transactions`);
  revalidatePath(`/${locale}/overview`);
  return { success: true };
}

export async function editTransaction(
  rawLocale: Locale,
  id: string,
  _previous: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const locale = resolveLocale(rawLocale);
  await requireSession(locale);
  const { t } = createTranslator(locale);

  const result = validate(formData, locale);
  if (!result.ok) return result.state;

  // Confirms the row is visible to this user before writing. RLS would reject
  // the update anyway, but this turns a silent no-op into a clear message.
  const existing = await getTransaction(id);
  if (!existing) return { error: t("errors.forbidden") };

  try {
    await updateTransaction(id, {
      kind: result.value.kind,
      amount: { minor: result.value.amountMinor, currency: result.value.currency },
      occurredOn: result.value.occurredOn,
      description: result.value.description,
      categoryId: result.value.categoryId,
    });
  } catch {
    return { error: t("errors.genericBody") };
  }

  revalidatePath(`/${locale}/transactions`);
  revalidatePath(`/${locale}/overview`);
  return { success: true };
}

export async function removeTransaction(
  rawLocale: Locale,
  id: string,
): Promise<TransactionFormState> {
  const locale = resolveLocale(rawLocale);
  await requireSession(locale);
  const { t } = createTranslator(locale);

  const existing = await getTransaction(id);
  if (!existing) return { error: t("errors.forbidden") };

  try {
    await deleteTransaction(id);
  } catch {
    return { error: t("errors.genericBody") };
  }

  revalidatePath(`/${locale}/transactions`);
  revalidatePath(`/${locale}/overview`);
  return { success: true };
}
