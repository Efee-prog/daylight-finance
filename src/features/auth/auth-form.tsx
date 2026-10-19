"use client";

import Link from "next/link";
import { useActionState } from "react";

import { useTranslator } from "@/components/i18n/locale-provider";
import { Button, FormField, Input } from "@/components/ui/primitives";
import type { Locale } from "@/lib/i18n/config";

import { type AuthFormState, signIn, signUp } from "./actions";

/**
 * Sign-in and sign-up share one component because they share one layout and
 * one error surface; only the action and the copy differ.
 *
 * `useActionState` gives the pending flag that disables the submit button, so
 * a double submit cannot create two accounts or fire two sign-in attempts.
 */
export function AuthForm({
  mode,
  locale,
}: {
  mode: "sign-in" | "sign-up";
  locale: Locale;
}) {
  const { t } = useTranslator();
  const isSignUp = mode === "sign-up";

  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    async (previous, formData) =>
      isSignUp
        ? signUp(locale, previous, formData)
        : signIn(locale, previous, formData),
    {},
  );

  if (state.pendingEmail) {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="font-serif text-headline text-ink">
          {t("auth.checkEmail")}
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          {t("auth.checkEmailBody", { email: state.pendingEmail })}
        </p>
        <Link
          href={`/${locale}/sign-in`}
          className="mt-2 text-sm font-medium text-ink underline underline-offset-4"
        >
          {t("auth.signIn")}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-serif text-headline text-ink">
          {t(isSignUp ? "auth.signUpTitle" : "auth.signInTitle")}
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">
          {t(isSignUp ? "auth.signUpSubtitle" : "auth.signInSubtitle")}
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-5" noValidate>
        {state.error ? (
          <p
            role="alert"
            className="border-l-2 border-negative bg-surface px-3 py-2 text-sm text-negative"
          >
            {state.error}
          </p>
        ) : null}

        {isSignUp ? (
          <FormField
            id="displayName"
            label={t("auth.displayName")}
            requiredLabel={t("common.optional")}
            required
          >
            <Input
              id="displayName"
              name="displayName"
              autoComplete="name"
              maxLength={80}
            />
          </FormField>
        ) : null}

        <FormField
          id="email"
          label={t("auth.email")}
          error={state.fieldErrors?.email}
        >
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            invalid={Boolean(state.fieldErrors?.email)}
          />
        </FormField>

        <FormField
          id="password"
          label={t("auth.password")}
          hint={isSignUp ? t("auth.passwordHint") : undefined}
          error={state.fieldErrors?.password}
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            required
            invalid={Boolean(state.fieldErrors?.password)}
          />
        </FormField>

        <Button type="submit" disabled={pending}>
          {pending
            ? t("common.saving")
            : t(isSignUp ? "auth.signUp" : "auth.signIn")}
        </Button>
      </form>

      <p className="text-sm text-muted">
        {t(isSignUp ? "auth.hasAccount" : "auth.noAccount")}{" "}
        <Link
          href={`/${locale}/${isSignUp ? "sign-in" : "sign-up"}`}
          className="font-medium text-ink underline underline-offset-4"
        >
          {t(isSignUp ? "auth.signIn" : "auth.signUp")}
        </Link>
      </p>
    </div>
  );
}
