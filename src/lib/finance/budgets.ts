/**
 * Budget usage.
 *
 * A budget measures consumption, so only `expense` rows count. Transfers into
 * a savings goal, transfers to a brokerage account and investment purchases
 * are all excluded — otherwise saving money would look like overspending.
 */

import { type Fixed, fixedDivide } from "./fixed";
import {
  type Money,
  addMoney,
  moneyToFixed,
  negateMoney,
  zeroMoney,
} from "./money";
import type { Budget, Transaction } from "./types";
import { monthRange } from "../dates/ranges";
import { isWithinRange } from "./cashflow";

export type BudgetStatus = "under" | "approaching" | "exceeded" | "invalid";

/**
 * Usage at or above 80% of the limit is reported as "approaching".
 * Held as a pair of integers so the comparison stays exact.
 */
export const APPROACHING_NUMERATOR = 80n;
export const APPROACHING_DENOMINATOR = 100n;

export interface BudgetUsage {
  readonly budgetId: string;
  readonly categoryId: string;
  readonly limit: Money;
  readonly spent: Money;
  /** Limit − spent. Negative once the budget is exceeded. */
  readonly remaining: Money;
  /** Spent ÷ limit as a 0–1 ratio, or `null` when the limit is not positive. */
  readonly ratio: Fixed | null;
  readonly status: BudgetStatus;
}

/**
 * Expense rows that a budget counts: same category, same currency, inside the
 * budget's month.
 */
export function transactionsInBudget(
  budget: Budget,
  transactions: readonly Transaction[],
): Transaction[] {
  const range = monthRange(budget.periodStart);
  return transactions.filter(
    (t) =>
      t.kind === "expense" &&
      t.categoryId === budget.categoryId &&
      t.amount.currency === budget.limit.currency &&
      isWithinRange(t.occurredOn, range),
  );
}

/**
 * Computes usage for one budget.
 *
 * A zero or negative limit yields `ratio: null` and status `invalid` rather
 * than a division error or an unbounded percentage. The spent figure is still
 * reported, because it is real regardless of how the limit was set.
 */
export function calculateBudgetUsage(
  budget: Budget,
  transactions: readonly Transaction[],
): BudgetUsage {
  const currency = budget.limit.currency;
  const counted = transactionsInBudget(budget, transactions);
  const spent = counted.reduce(
    (total, t) => addMoney(total, t.amount),
    zeroMoney(currency),
  );
  const remaining = addMoney(budget.limit, negateMoney(spent));

  if (budget.limit.minor <= 0n) {
    return {
      budgetId: budget.id,
      categoryId: budget.categoryId,
      limit: budget.limit,
      spent,
      remaining,
      ratio: null,
      status: "invalid",
    };
  }

  const ratio = fixedDivide(moneyToFixed(spent), moneyToFixed(budget.limit));
  const status: BudgetStatus =
    spent.minor > budget.limit.minor
      ? "exceeded"
      : spent.minor * APPROACHING_DENOMINATOR >=
          budget.limit.minor * APPROACHING_NUMERATOR
        ? "approaching"
        : "under";

  return {
    budgetId: budget.id,
    categoryId: budget.categoryId,
    limit: budget.limit,
    spent,
    remaining,
    ratio,
    status,
  };
}

export function calculateBudgetUsages(
  budgets: readonly Budget[],
  transactions: readonly Transaction[],
): BudgetUsage[] {
  return budgets.map((budget) => calculateBudgetUsage(budget, transactions));
}
