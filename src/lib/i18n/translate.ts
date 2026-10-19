/**
 * Message lookup.
 *
 * Keys are dot paths into the catalogue ("transactions.deleteTitle") and are
 * typed: only paths that actually exist compile, so a renamed key breaks the
 * build instead of rendering a blank label. Placeholders are {name} and are
 * substituted positionally by name, never by string concatenation of
 * pre-formatted fragments.
 */

import { type Locale } from "./config";
import { type Messages, tr } from "./messages/tr";
import { en } from "./messages/en";

const CATALOGUES: Record<Locale, Messages> = { tr, en };

/** Every dot path that resolves to a string in the catalogue. */
export type MessageKey = DotPaths<Messages>;

type DotPaths<T> = {
  [K in keyof T & string]: T[K] extends string
    ? K
    : T[K] extends Record<string, unknown>
      ? `${K}.${DotPaths<T[K]>}`
      : never;
}[keyof T & string];

export type MessageValues = Record<string, string | number>;

function lookup(messages: Messages, key: string): string | undefined {
  let current: unknown = messages;
  for (const segment of key.split(".")) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === "string" ? current : undefined;
}

/**
 * Fills {placeholders}. A placeholder with no matching value is left as-is
 * rather than replaced with "undefined", which makes the gap obvious in
 * development instead of shipping a broken sentence.
 */
export function interpolate(template: string, values?: MessageValues): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = values[name];
    return value === undefined ? match : String(value);
  });
}

export interface Translator {
  readonly locale: Locale;
  /** Translates a key, filling any {placeholders}. */
  readonly t: (key: MessageKey, values?: MessageValues) => string;
  /**
   * Translates a key built at runtime, such as a category's `system_key`.
   * Returns `undefined` when the key is absent so the caller can fall back to
   * the user's own stored text rather than printing a raw key.
   */
  readonly tOptional: (key: string, values?: MessageValues) => string | undefined;
  readonly messages: Messages;
}

export function createTranslator(locale: Locale): Translator {
  const messages = CATALOGUES[locale];
  return {
    locale,
    messages,
    t: (key, values) => interpolate(lookup(messages, key) ?? key, values),
    tOptional: (key, values) => {
      const template = lookup(messages, key);
      return template === undefined
        ? undefined
        : interpolate(template, values);
    },
  };
}

export function getMessages(locale: Locale): Messages {
  return CATALOGUES[locale];
}
