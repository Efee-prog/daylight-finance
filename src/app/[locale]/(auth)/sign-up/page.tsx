import type { Metadata } from "next";

import { AuthForm } from "@/features/auth/auth-form";
import { resolveLocale } from "@/lib/i18n/config";
import { createTranslator } from "@/lib/i18n/translate";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/sign-up">): Promise<Metadata> {
  const { locale } = await params;
  return { title: createTranslator(resolveLocale(locale)).t("auth.signUp") };
}

export default async function SignUpPage({
  params,
}: PageProps<"/[locale]/sign-up">) {
  const { locale } = await params;
  return <AuthForm mode="sign-up" locale={resolveLocale(locale)} />;
}
