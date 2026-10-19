/**
 * Savings-goal progress.
 *
 * A goal is an *earmark* on money the user already holds, not a second pile of
 * money. That is the single most important rule in this file: goal balances
 * are never added to the cash balance to produce net worth, or the same lira
 * would be counted twice. A goal entry may optionally reference the cash
 * transaction that accompanied it (`transactionId`), which is how the two
 * views stay reconcilable without being summed together.
 */

import { type Fixed, fixedDivide } from "./fixed";
import {
  type Money,
  addMoney,
  moneyToFixed,
  negateMoney,
  zeroMoney,
} from "./money";
import type { SavingsGoal, SavingsGoalEntry } from "./types";

export type GoalStatus = "on-track" | "reached" | "empty" | "invalid";

export interface GoalProgress {
  readonly goalId: string;
  readonly target: Money;
  /** Deposits minus withdrawals. */
  readonly saved: Money;
  /** Target minus saved; zero once the goal is reached, never negative. */
  readonly remaining: Money;
  /** Saved / target as a 0-1 ratio, or `null` for a non-positive target. */
  readonly ratio: Fixed | null;
  readonly status: GoalStatus;
  readonly entryCount: number;
}

export class GoalCurrencyMismatchError extends Error {
  constructor(goalId: string) {
    super(
      `Savings goal ${goalId} has entries in a different currency than its target`,
    );
    this.name = "GoalCurrencyMismatchError";
  }
}

/**
 * Sums a goal's entries and compares them to its target.
 *
 * Entries must share the goal's currency: a goal of 50.000 TRY part-funded in
 * USD has no defined progress without an exchange rate, so this rejects the
 * input rather than inventing a conversion.
 */
export function calculateGoalProgress(
  goal: SavingsGoal,
  entries: readonly SavingsGoalEntry[],
): GoalProgress {
  const currency = goal.targetAmount.currency;
  const mine = entries.filter((entry) => entry.goalId === goal.id);

  if (mine.some((entry) => entry.amount.currency !== currency)) {
    throw new GoalCurrencyMismatchError(goal.id);
  }

  const saved = mine.reduce(
    (total, entry) =>
      entry.direction === "deposit"
        ? addMoney(total, entry.amount)
        : addMoney(total, negateMoney(entry.amount)),
    zeroMoney(currency),
  );

  if (goal.targetAmount.minor <= 0n) {
    return {
      goalId: goal.id,
      target: goal.targetAmount,
      saved,
      remaining: zeroMoney(currency),
      ratio: null,
      status: "invalid",
      entryCount: mine.length,
    };
  }

  const shortfall = addMoney(goal.targetAmount, negateMoney(saved));
  const remaining =
    shortfall.minor > 0n ? shortfall : zeroMoney(currency);
  const ratio = fixedDivide(
    moneyToFixed(saved),
    moneyToFixed(goal.targetAmount),
  );

  const status: GoalStatus =
    saved.minor >= goal.targetAmount.minor
      ? "reached"
      : mine.length === 0
        ? "empty"
        : "on-track";

  return {
    goalId: goal.id,
    target: goal.targetAmount,
    saved,
    remaining,
    ratio,
    status,
    entryCount: mine.length,
  };
}

/**
 * Validates a withdrawal before it is written.
 *
 * Taking out more than a goal holds would drive its balance negative, which
 * has no meaning for an earmark. Checked here so the rule is unit-testable and
 * shared by every write path.
 */
export function canWithdrawFromGoal(
  progress: GoalProgress,
  amount: Money,
): boolean {
  if (amount.currency !== progress.saved.currency) return false;
  if (amount.minor <= 0n) return false;
  return amount.minor <= progress.saved.minor;
}
