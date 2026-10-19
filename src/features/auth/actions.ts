"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { type Locale, resolveLocale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/supabase/env";

/**
 * Authentication Server Actions.
 *
 * Validation runs here, on the server, regardless of what the browser checked
 * first. Client-side validation is a convenience for the user; this is the
 * copy that decides. Error messages are looked up in the message catalogue so
 * they are translated, and they stay deliberately vague about *which* half of
 * a credential pair was wrong, which would otherwise confirm whether an email
 * is registered.
 */

const PASSWORD_MIN = 10;

const credentials = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(PASSWORD_MIN),
});

const signUpInput = credentials.extend({
  displayName: z.string().trim().max(80).optional(),
});

export interface AuthFormState {
  readonly error?: string;
  readonly fieldErrors?: Partial<Record<"email" | "password", string>>;
  readonly pendingEmail?: string;
}

export async function signIn(
  locale: Locale,
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const t = createTranslator(resolveLocale(locale)).t;
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const fieldErrors: AuthFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === "email") fieldErrors.email = t("validation.emailInvalid");
      if (issue.path[0] === "password") {
        fieldErrors.password = t("validation.passwordTooShort", {
          min: PASSWORD_MIN,
        });
      }
    }
    return { fieldErrors, error: t("errors.validationFailed") };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // One message for both "no such user" and "wrong password", so the form
    // cannot be used to enumerate which emails have accounts.
    return { error: t("auth.invalidCredentials") };
  }

  redirect(`/${locale}/overview`);
}

export async function signUp(
  locale: Locale,
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const t = createTranslator(resolveLocale(locale)).t;
  const parsed = signUpInput.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
  });

  if (!parsed.success) {
    const fieldErrors: AuthFormState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      if (issue.path[0] === "email") fieldErrors.email = t("validation.emailInvalid");
      if (issue.path[0] === "password") {
        fieldErrors.password = t("validation.passwordTooShort", {
          min: PASSWORD_MIN,
        });
      }
    }
    return { fieldErrors, error: t("errors.validationFailed") };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName ?? "" },
      emailRedirectTo: `${siteUrl()}/${locale}/overview`,
    },
  });

  if (error) {
    return {
      error: /already|registered|exists/i.test(error.message)
        ? t("auth.emailTaken")
        : t("errors.genericBody"),
    };
  }

  // When email confirmation is on, signUp returns a user without a session.
  // Saying "check your email" is the honest response; claiming the account is
  // ready would leave the user staring at a sign-in form they cannot pass.
  if (!data.session) return { pendingEmail: parsed.data.email };

  redirect(`/${locale}/overview`);
}

export async function signOut(locale: Locale): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(`/${locale}/sign-in`);
}
