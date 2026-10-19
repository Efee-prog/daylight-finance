"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";

import { useTranslator } from "@/components/i18n/locale-provider";
import { Button, FormField, Input, Select } from "@/components/ui/primitives";
import { CURRENCY_CODES, type CurrencyCode } from "@/lib/finance/money";
import { LOCALES, type Locale } from "@/lib/i18n/config";

import { type SettingsFormState, saveSettings } from "./actions";

const TIME_ZONES = [
  "Europe/Istanbul",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Dubai",
  "UTC",
] as const;

export function SettingsForm({
  locale,
  email,
  displayName,
  defaultCurrency,
  timeZone,
}: {
  locale: Locale;
  email: string;
  displayName: string;
  defaultCurrency: CurrencyCode;
  timeZone: string;
}) {
  const { t } = useTranslator();
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    SettingsFormState,
    FormData
  >(async (previous, formData) => {
    const result = await saveSettings(locale, previous, formData);
    if (result.success) {
      // The saved language may differ from the one in the URL, so navigate to
      // the locale the user just chose rather than leaving them on the old one.
      const chosen = formData.get("locale");
      if (typeof chosen === "string" && chosen !== locale) {
        router.push(`/${chosen}/settings`);
      }
    }
    return result;
  }, {});

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-6" noValidate>
      {state.error ? (
        <p role="alert" className="border-l-2 border-negative px-3 py-2 text-sm text-negative">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="border-l-2 border-positive px-3 py-2 text-sm text-ink">
          {t("settings.saved")}
        </p>
      ) : null}

      <FormField id="displayName" label={t("settings.displayName")}>
        <Input id="displayName" name="displayName" defaultValue={displayName} maxLength={80} />
      </FormField>

      <FormField id="email" label={t("settings.email")} hint={t("settings.emailReadOnly")}>
        <Input id="email" value={email} disabled readOnly />
      </FormField>

      <FormField id="locale" label={t("settings.language")}>
        <Select id="locale" name="locale" defaultValue={locale}>
          {LOCALES.map((value) => (
            <option key={value} value={value}>
              {value === "tr" ? "Türkçe" : "English"}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField
        id="defaultCurrency"
        label={t("settings.defaultCurrency")}
        hint={t("settings.defaultCurrencyHint")}
      >
        <Select id="defaultCurrency" name="defaultCurrency" defaultValue={defaultCurrency}>
          {CURRENCY_CODES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField id="timeZone" label={t("settings.timeZone")} hint={t("settings.timeZoneHint")}>
        <Select id="timeZone" name="timeZone" defaultValue={timeZone}>
          {TIME_ZONES.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </Select>
      </FormField>

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </form>
  );
}
