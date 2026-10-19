/**
 * Test factories.
 *
 * Every value here is synthetic. No real person's financial data appears in
 * this repository, in tests or in seeds.
 */

import { fixedFromString } from "@/lib/finance/fixed";
import {
  type CurrencyCode,
  type Money,
  moneyFromDecimalString,
} from "@/lib/finance/money";
import type {
  Asset,
  AssetClass,
  AssetPrice,
  Budget,
  InvestmentTransaction,
  SavingsGoal,
  SavingsGoalEntry,
  Transaction,
  TransactionKind,
} from "@/lib/finance/types";

let sequence = 0;
const nextId = (prefix: string) => `${prefix}-${String(++sequence).padStart(4, "0")}`;

export function resetIds(): void {
  sequence = 0;
}

export function try_(amount: string): Money {
  return moneyFromDecimalString(amount, "TRY");
}

export function usd(amount: string): Money {
  return moneyFromDecimalString(amount, "USD");
}

export function makeTransaction(
  overrides: Partial<Transaction> & { kind: TransactionKind; amount: Money },
): Transaction {
  return {
    id: nextId("txn"),
    occurredOn: "2026-10-15",
    description: "Sample row",
    categoryId: null,
    goalId: null,
    assetId: null,
    ...overrides,
  };
}

export const income = (amount: string, overrides: Partial<Transaction> = {}) =>
  makeTransaction({ kind: "income", amount: try_(amount), ...overrides });

export const expense = (amount: string, overrides: Partial<Transaction> = {}) =>
  makeTransaction({ kind: "expense", amount: try_(amount), ...overrides });

export const transferOut = (
  amount: string,
  overrides: Partial<Transaction> = {},
) => makeTransaction({ kind: "transfer_out", amount: try_(amount), ...overrides });

export const transferIn = (
  amount: string,
  overrides: Partial<Transaction> = {},
) => makeTransaction({ kind: "transfer_in", amount: try_(amount), ...overrides });

export function makeBudget(overrides: Partial<Budget> = {}): Budget {
  return {
    id: nextId("bud"),
    categoryId: "cat-food",
    limit: try_("8000"),
    period: "monthly",
    periodStart: "2026-10-01",
    ...overrides,
  };
}

export function makeAsset(
  overrides: Partial<Asset> & { id?: string } = {},
): Asset {
  return {
    id: overrides.id ?? nextId("ast"),
    name: "Sample Equity",
    symbol: "SMPL",
    assetClass: "stock" as AssetClass,
    currency: "TRY" as CurrencyCode,
    description: "",
    ...overrides,
  };
}

export function makeTrade(
  // Quantity and unit price are accepted as decimal strings for readability in
  // tests, so they are omitted from the Partial before being re-declared —
  // intersecting `Fixed` with `string` would collapse them to `never`.
  overrides: Omit<Partial<InvestmentTransaction>, "quantity" | "unitPrice"> & {
    assetId: string;
    side: "buy" | "sell";
    quantity: string;
    unitPrice: string;
  },
): InvestmentTransaction {
  const { quantity, unitPrice, ...rest } = overrides;
  return {
    id: nextId("trd"),
    occurredOn: "2026-10-01",
    note: "",
    fee: try_("0"),
    ...rest,
    quantity: fixedFromString(quantity),
    unitPrice: fixedFromString(unitPrice),
  };
}

export function makePrice(
  assetId: string,
  price: string,
  asOf = "2026-10-18T09:00:00.000Z",
  currency: CurrencyCode = "TRY",
): AssetPrice {
  return { assetId, price: fixedFromString(price), currency, asOf };
}

export function makeGoal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    id: nextId("gol"),
    name: "Emergency fund",
    targetAmount: try_("50000"),
    targetDate: null,
    createdOn: "2026-01-01",
    description: "",
    archivedAt: null,
    ...overrides,
  };
}

export function makeGoalEntry(
  overrides: Partial<SavingsGoalEntry> & { goalId: string; amount: Money },
): SavingsGoalEntry {
  return {
    id: nextId("gen"),
    direction: "deposit",
    occurredOn: "2026-02-01",
    note: "",
    transactionId: null,
    ...overrides,
  };
}
