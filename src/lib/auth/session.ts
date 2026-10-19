import { redirect } from "next/navigation";

import { createClient } from "../supabase/server";
import { DEFAULT_LOCALE, type Locale } from "../i18n/config";
import type { CurrencyCode } from "../finance/money";
import { isCurrencyCode } from "../finance/money";

/**
 * The signed-in user plus their saved preferences.
 *
 * `id` here comes from a token the server verified against the auth service,
 * which is the only acceptable source for it. Nothing in the application reads
 * a user id from a request body, a query parameter or a hidden form field.
 */
export interface SessionContext {
  readonly userId: string;
  readonly email: string;
  readonly displayName: string;
  readonly locale: Locale;
  readonly defaultCurrency: CurrencyCode;
  readonly timeZone: string;
}

export interface MaybeSession {
  readonly session: SessionContext | null;
}

/**
 * Loads the session if there is one.
 *
 * Uses `getUser()`, not `getSession()`: the latter decodes whatever is in the
 * cookie without checking it, so it must never be trusted on the server.
 */
export async function getSession(): Promise<MaybeSession> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return { session: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, locale, default_currency, time_zone")
    .eq("id", user.id)
    .maybeSingle();

  return {
    session: {
      userId: user.id,
      email: user.email ?? "",
      displayName: profile?.display_name ?? "",
      locale: (profile?.locale === "en" ? "en" : DEFAULT_LOCALE) as Locale,
      defaultCurrency: isCurrencyCode(profile?.default_currency)
        ? profile.default_currency
        : "TRY",
      timeZone: profile?.time_zone ?? "Europe/Istanbul",
    },
  };
}

/**
 * Loads the session or sends the visitor to sign in.
 *
 * Every authenticated page and every Server Action that writes data calls
 * this. It is a usability guard rather than the security boundary: the real
 * enforcement is Row Level Security, so a request that somehow skipped this
 * still cannot read or write another user's rows.
 */
export async function requireSession(locale: Locale): Promise<SessionContext> {
  const { session } = await getSession();
  if (!session) redirect(`/${locale}/sign-in`);
  return session;
}
