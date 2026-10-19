"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSession } from "@/lib/auth/session";
import { CURRENCY_CODES, type CurrencyCode } from "@/lib/finance/money";
import { LOCALES, type Locale, resolveLocale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";
import { createClient } from "@/lib/supabase/server";

export interface SettingsFormState {
  readonly error?: string;
  readonly success?: boolean;
}

const schema = z.object({
  displayName: z.string().trim().max(80),
  locale: z.enum(LOCALES),
  defaultCurrency: z.enum(CURRENCY_CODES as [CurrencyCode, ...CurrencyCode[]]),
  timeZone: z.string().trim().min(1).max(64),
});

/**
 * Saves display preferences.
 *
 * `default_currency` is a display default for new records only. It never
 * rewrites the currency of anything already stored — a user switching their
 * default to USD has not been paid in dollars retroactively, and silently
 * relabelling their history would corrupt every total they had checked.
 */
export async function saveSettings(
  rawLocale: Locale,
  _previous: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const locale = resolveLocale(rawLocale);
  const session = await requireSession(locale);
  const { t } = createTranslator(locale);

  const parsed = schema.safeParse({
    displayName: formData.get("displayName") ?? "",
    locale: formData.get("locale"),
    defaultCurrency: formData.get("defaultCurrency"),
    timeZone: formData.get("timeZone"),
  });

  if (!parsed.success) return { error: t("errors.validationFailed") };

  // Rejects anything Intl cannot resolve, so a bad value cannot make every
  // date on the dashboard throw later.
  try {
    new Intl.DateTimeFormat("en", { timeZone: parsed.data.timeZone });
  } catch {
    return { error: t("errors.validationFailed") };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName,
      locale: parsed.data.locale,
      default_currency: parsed.data.defaultCurrency,
      time_zone: parsed.data.timeZone,
    })
    .eq("id", session.userId);

  if (error) return { error: t("errors.genericBody") };

  revalidatePath(`/${parsed.data.locale}/settings`);
  revalidatePath(`/${parsed.data.locale}/overview`);
  return { success: true };
}
