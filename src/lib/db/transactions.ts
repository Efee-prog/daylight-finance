import { createClient } from "../supabase/server";
import {
  type CurrencyCode,
  type Money,
  isCurrencyCode,
  money,
  moneyFromDecimalString,
} from "../finance/money";
import type { DateRange, Transaction, TransactionKind } from "../finance/types";
import { isTransactionKind } from "../finance/types";

/**
 * Transaction reads and writes.
 *
 * Money columns are selected with a `::text` cast. PostgREST serialises
 * BIGINT and NUMERIC as JSON numbers, and `JSON.parse` turns those into
 * doubles — which would quietly round any balance past 2^53 and defeat the
 * whole point of storing minor units as integers. Reading them as text and
 * parsing into BigInt keeps the value exact from Postgres to the screen.
 *
 * Nothing here accepts a user id. The caller is identified by the verified
 * session, and Row Level Security scopes every statement to that user, so a
 * forged id in a request body has nothing to attach itself to.
 */

const TRANSACTION_COLUMNS =
  "id, kind, amount_minor::text, currency, occurred_on, description, " +
  "category_id, goal_id, asset_id";

interface TransactionRow {
  id: string;
  kind: string;
  amount_minor: string;
  currency: string;
  occurred_on: string;
  description: string;
  category_id: string | null;
  goal_id: string | null;
  asset_id: string | null;
}

export class MalformedRowError extends Error {
  constructor(table: string, id: string, detail: string) {
    super(`Malformed ${table} row ${id}: ${detail}`);
    this.name = "MalformedRowError";
  }
}

/**
 * Maps a database row to the domain type.
 *
 * Validates rather than casts. A row that violates an invariant the schema is
 * supposed to guarantee is a bug worth surfacing loudly, not something to
 * paper over with a default that would silently distort a total.
 */
function toTransaction(row: TransactionRow): Transaction {
  if (!isTransactionKind(row.kind)) {
    throw new MalformedRowError("transaction", row.id, `kind "${row.kind}"`);
  }
  if (!isCurrencyCode(row.currency)) {
    throw new MalformedRowError(
      "transaction",
      row.id,
      `currency "${row.currency}"`,
    );
  }
  return {
    id: row.id,
    kind: row.kind,
    amount: money(BigInt(row.amount_minor), row.currency),
    occurredOn: row.occurred_on,
    description: row.description,
    categoryId: row.category_id,
    goalId: row.goal_id,
    assetId: row.asset_id,
  };
}

export interface TransactionFilters {
  readonly range?: DateRange;
  readonly kinds?: readonly TransactionKind[];
  readonly categoryIds?: readonly string[];
  readonly currency?: CurrencyCode;
  readonly search?: string;
  readonly minAmount?: Money;
  readonly maxAmount?: Money;
}

export type TransactionSort =
  | "date-desc"
  | "date-asc"
  | "amount-desc"
  | "amount-asc";

export interface ListResult {
  readonly transactions: Transaction[];
  readonly total: number;
}

/**
 * Lists transactions for the signed-in user.
 *
 * Paginated at the database rather than in memory, because a few years of
 * daily records is tens of thousands of rows and shipping all of them to
 * render one page is how a dashboard becomes slow.
 */
export async function listTransactions(options: {
  filters?: TransactionFilters;
  sort?: TransactionSort;
  page?: number;
  pageSize?: number;
}): Promise<ListResult> {
  const supabase = await createClient();
  const { filters = {}, sort = "date-desc" } = options;
  const pageSize = Math.min(Math.max(options.pageSize ?? 25, 1), 200);
  const page = Math.max(options.page ?? 1, 1);

  let query = supabase
    .from("transactions")
    .select(TRANSACTION_COLUMNS, { count: "exact" });

  if (filters.range) {
    query = query
      .gte("occurred_on", filters.range.start)
      .lte("occurred_on", filters.range.end);
  }
  if (filters.kinds?.length) query = query.in("kind", [...filters.kinds]);
  if (filters.categoryIds?.length) {
    query = query.in("category_id", [...filters.categoryIds]);
  }
  if (filters.currency) query = query.eq("currency", filters.currency);
  if (filters.minAmount) {
    query = query.gte("amount_minor", filters.minAmount.minor.toString());
  }
  if (filters.maxAmount) {
    query = query.lte("amount_minor", filters.maxAmount.minor.toString());
  }
  if (filters.search?.trim()) {
    // Escaped so a user searching for "100%" or "a_b" gets a literal match
    // instead of a wildcard pattern.
    const term = filters.search.trim().replace(/[%_\\]/g, "\\$&");
    query = query.ilike("description", `%${term}%`);
  }

  switch (sort) {
    case "date-asc":
      query = query.order("occurred_on", { ascending: true }).order("id");
      break;
    case "amount-desc":
      query = query.order("amount_minor", { ascending: false }).order("id");
      break;
    case "amount-asc":
      query = query.order("amount_minor", { ascending: true }).order("id");
      break;
    default:
      query = query
        .order("occurred_on", { ascending: false })
        .order("id", { ascending: false });
  }

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);

  if (error) throw new Error(`Could not load transactions: ${error.message}`);

  return {
    transactions: (data as unknown as TransactionRow[]).map(toTransaction),
    total: count ?? 0,
  };
}

/**
 * Every transaction inside a date range, for the aggregates the Overview and
 * Insights pages compute. Unpaginated on purpose: a monthly total has to see
 * every row in the month, so the range is the bound.
 */
export async function loadTransactionsInRange(
  range: DateRange,
): Promise<Transaction[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(TRANSACTION_COLUMNS)
    .gte("occurred_on", range.start)
    .lte("occurred_on", range.end)
    .order("occurred_on", { ascending: false })
    .order("id", { ascending: false });

  if (error) throw new Error(`Could not load transactions: ${error.message}`);
  return (data as unknown as TransactionRow[]).map(toTransaction);
}

/** Every transaction, for the all-time cash balance. */
export async function loadAllTransactions(): Promise<Transaction[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(TRANSACTION_COLUMNS)
    .order("occurred_on", { ascending: false });

  if (error) throw new Error(`Could not load transactions: ${error.message}`);
  return (data as unknown as TransactionRow[]).map(toTransaction);
}

export async function getTransaction(id: string): Promise<Transaction | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(TRANSACTION_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Could not load transaction: ${error.message}`);
  return data ? toTransaction(data as unknown as TransactionRow) : null;
}

export interface TransactionInput {
  readonly kind: TransactionKind;
  readonly amount: Money;
  readonly occurredOn: string;
  readonly description: string;
  readonly categoryId: string | null;
}

export async function insertTransaction(
  userId: string,
  input: TransactionInput,
): Promise<Transaction> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      kind: input.kind,
      // Sent as a string so the exact integer survives JSON serialisation.
      amount_minor: input.amount.minor.toString() as unknown as number,
      currency: input.amount.currency,
      occurred_on: input.occurredOn,
      description: input.description,
      category_id: input.categoryId,
    })
    .select(TRANSACTION_COLUMNS)
    .single();

  if (error) throw new Error(`Could not save transaction: ${error.message}`);
  return toTransaction(data as unknown as TransactionRow);
}

export async function updateTransaction(
  id: string,
  input: TransactionInput,
): Promise<Transaction> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .update({
      kind: input.kind,
      amount_minor: input.amount.minor.toString() as unknown as number,
      currency: input.amount.currency,
      occurred_on: input.occurredOn,
      description: input.description,
      category_id: input.categoryId,
    })
    .eq("id", id)
    .select(TRANSACTION_COLUMNS)
    .single();

  if (error) throw new Error(`Could not update transaction: ${error.message}`);
  return toTransaction(data as unknown as TransactionRow);
}

export async function deleteTransaction(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw new Error(`Could not delete transaction: ${error.message}`);
}

/** Parses a decimal string the user typed into Money. */
export function parseAmount(
  value: string,
  currency: CurrencyCode,
): Money {
  return moneyFromDecimalString(value, currency);
}
