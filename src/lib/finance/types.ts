/**
 * The financial domain model.
 *
 * These types describe money as Daylight reasons about it, independently of
 * how Postgres stores it or how React renders it. Nothing in this file imports
 * from the database or the UI, which is what makes the calculation layer
 * testable in isolation.
 */

import type { Fixed } from "./fixed";
import type { CurrencyCode, Money } from "./money";

/**
 * What a cash-flow record means.
 *
 * Transfers are first-class and directional so that moving money into a
 * savings goal or a brokerage account never shows up as income or expense.
 * A transfer between two pools Daylight tracks is two rows — one `transfer_out`
 * and one `transfer_in` — which cancel in the cash balance and are invisible
 * to income, expense, budget and savings-rate figures.
 */
export const TRANSACTION_KINDS = [
  "income",
  "expense",
  "transfer_in",
  "transfer_out",
] as const;

export type TransactionKind = (typeof TRANSACTION_KINDS)[number];

export function isTransactionKind(value: unknown): value is TransactionKind {
  return (
    typeof value === "string" &&
    (TRANSACTION_KINDS as readonly string[]).includes(value)
  );
}

/** Which kinds move the cash balance, and in which direction. */
export const CASH_FLOW_SIGN: Record<TransactionKind, 1 | -1> = {
  income: 1,
  expense: -1,
  transfer_in: 1,
  transfer_out: -1,
};

/** Kinds that count towards income/expense summaries and budgets. */
export const OPERATIONAL_KINDS: readonly TransactionKind[] = [
  "income",
  "expense",
];

export interface Category {
  readonly id: string;
  readonly name: string;
  /** Categories are scoped to the kinds they may be used with. */
  readonly kind: Extract<TransactionKind, "income" | "expense">;
  readonly isSystem: boolean;
}

export interface Transaction {
  readonly id: string;
  readonly kind: TransactionKind;
  /** Always positive. Direction comes from `kind`, never from the sign. */
  readonly amount: Money;
  /** Calendar date in the user's timezone, as YYYY-MM-DD. */
  readonly occurredOn: string;
  readonly description: string;
  readonly categoryId: string | null;
  /** Set when this row is the cash side of a savings-goal movement. */
  readonly goalId: string | null;
  /** Set when this row is the cash side of an investment trade. */
  readonly assetId: string | null;
}

/** An inclusive calendar date range, both ends as YYYY-MM-DD. */
export interface DateRange {
  readonly start: string;
  readonly end: string;
}

export type BudgetPeriod = "monthly";

export interface Budget {
  readonly id: string;
  readonly categoryId: string;
  readonly limit: Money;
  readonly period: BudgetPeriod;
  /** First day of the month this budget applies to, as YYYY-MM-01. */
  readonly periodStart: string;
}

export interface SavingsGoal {
  readonly id: string;
  readonly name: string;
  readonly targetAmount: Money;
  readonly targetDate: string | null;
  readonly createdOn: string;
  readonly description: string;
  readonly archivedAt: string | null;
}

/**
 * A movement into or out of a savings goal.
 *
 * Goal balances are tracked separately from the cash balance on purpose: a
 * goal is an earmark on money the user already has, not a second pile of it.
 * Adding ₺1.000 to a goal does not change the cash balance. If the user also
 * moved the cash somewhere, they record a `transfer_out` transaction and link
 * it here via `transactionId`, so the two views stay reconcilable without the
 * same lira ever being counted twice as net worth.
 */
export interface SavingsGoalEntry {
  readonly id: string;
  readonly goalId: string;
  readonly amount: Money;
  readonly direction: "deposit" | "withdrawal";
  readonly occurredOn: string;
  readonly note: string;
  readonly transactionId: string | null;
}

export const ASSET_CLASSES = [
  "stock",
  "etf",
  "fund",
  "crypto",
  "gold",
  "other",
] as const;

export type AssetClass = (typeof ASSET_CLASSES)[number];

export interface Asset {
  readonly id: string;
  readonly name: string;
  readonly symbol: string;
  readonly assetClass: AssetClass;
  /** The currency this asset trades and is valued in. */
  readonly currency: CurrencyCode;
  readonly description: string;
}

export type InvestmentSide = "buy" | "sell";

export interface InvestmentTransaction {
  readonly id: string;
  readonly assetId: string;
  readonly side: InvestmentSide;
  /** Units traded, always positive. 8 decimal places. */
  readonly quantity: Fixed;
  /** Price per unit, in the asset's currency. */
  readonly unitPrice: Fixed;
  /** Commission and fees, in the asset's currency. Never negative. */
  readonly fee: Money;
  readonly occurredOn: string;
  readonly note: string;
}

/** A manually recorded valuation for an asset. */
export interface AssetPrice {
  readonly assetId: string;
  readonly price: Fixed;
  readonly currency: CurrencyCode;
  /** When this price was observed, as an ISO timestamp. */
  readonly asOf: string;
}
