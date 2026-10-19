"use client";

import { useTransition } from "react";

import { useTranslator } from "@/components/i18n/locale-provider";
import type { Locale } from "@/lib/i18n/config";

import { signOut } from "./actions";

export function SignOutButton({ locale }: { locale: Locale }) {
  const { t } = useTranslator();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => void signOut(locale))}
      className="text-left text-xs text-muted underline underline-offset-4 hover:text-ink disabled:opacity-50"
    >
      {pending ? t("common.loading") : t("auth.signOut")}
    </button>
  );
}
