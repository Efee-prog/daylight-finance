import type { Metadata } from "next";

import { AuthForm } from "@/features/auth/auth-form";
import { resolveLocale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/sign-in">): Promise<Metadata> {
  const { locale } = await params;
  return { title: createTranslator(resolveLocale(locale)).t("auth.signIn") };
}

export default async function SignInPage({
  params,
}: PageProps<"/[locale]/sign-in">) {
  const { locale } = await params;
  return <AuthForm mode="sign-in" locale={resolveLocale(locale)} />;
}
