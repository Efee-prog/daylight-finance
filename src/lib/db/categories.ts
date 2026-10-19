import { createClient } from "../supabase/server";
import type { Category } from "../finance/types";
import type { Translator } from "../i18n/translate";

/**
 * Category reads.
 *
 * Seeded categories carry a `system_key`, and the UI shows a translated label
 * for those. A category the user created or renamed has no key and is shown
 * exactly as they typed it — translating a user's own words would be wrong,
 * and an untranslated seed label would leave English in a Turkish interface.
 */

interface CategoryRow {
  id: string;
  name: string;
  kind: string;
  is_system: boolean;
  system_key: string | null;
}

export interface CategoryView extends Category {
  /** The label to display, already resolved for the active locale. */
  readonly label: string;
  readonly systemKey: string | null;
}

export async function listCategories(
  translator: Translator,
): Promise<CategoryView[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, kind, is_system, system_key")
    .order("kind")
    .order("name");

  if (error) throw new Error(`Could not load categories: ${error.message}`);

  return (data as CategoryRow[])
    .filter((row) => row.kind === "income" || row.kind === "expense")
    .map((row) => ({
      id: row.id,
      name: row.name,
      kind: row.kind as "income" | "expense",
      isSystem: row.is_system,
      systemKey: row.system_key,
      label:
        (row.system_key
          ? translator.tOptional(`categories.${row.system_key}`)
          : undefined) ?? row.name,
    }));
}

/** Lookup from id to display label, for tables and chart tooltips. */
export function categoryLabels(
  categories: readonly CategoryView[],
): Map<string, string> {
  return new Map(categories.map((category) => [category.id, category.label]));
}
