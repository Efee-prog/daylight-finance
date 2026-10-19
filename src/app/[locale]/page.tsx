import { redirect } from "next/navigation";

import { resolveLocale } from "@/lib/i18n/config";

/** The locale root is not a page of its own; Overview is the home screen. */
export default async function LocaleRootPage({
  params,
}: PageProps<"/[locale]">) {
  const { locale } = await params;
  redirect(`/${resolveLocale(locale)}/overview`);
}
