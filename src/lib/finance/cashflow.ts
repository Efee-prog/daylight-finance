/**
 * Cash-flow aggregates.
 *
 * Every function here states exactly which transaction kinds it includes, and
 * every total is returned per currency. That second point matters: a user with
 * both ₺ and $ transactions has two cash balances, not one, until they supply
 * an exchange rate. Returning `MoneyByCurrency` makes the multi-currency case
 * impossible to ignore at the call site instead of producing a plausible but
 * meaningless single figure.
 */

import {
  type Fixed,
  fixedDivide,
  fixedFromInteger,
  fixedMultiply,
} from "./fixed";
import {
  type CurrencyCode,
  type Money,
  type MoneyByCurrency,
  addMoney,
  moneyToFixed,
  negateMoney,
  sumByCurrency,
  zeroMoney,
} from "./money";
import {
  CASH_FLOW_SIGN,
  type DateRange,
  type Transaction,
  type TransactionKind,
} from "./types";

/** Inclusive on both ends. Dates are compared as YYYY-MM-DD strings, which
 *  sort lexicographically in calendar order — no Date objects, no timezones. */
export function isWithinRange(date: string, range: DateRange): boolean {
  return date >= range.start && date <= range.end;
}

export function filterByDateRange<T extends { occurredOn: string }>(
  records: readonly T[],
  range: DateRange,
): T[] {
  return records.filter((record) => isWithinRange(record.occurredOn, range));
}

function totalForKinds(
  transactions: readonly Transaction[],
  kinds: readonly TransactionKind[],
): MoneyByCurrency {
  return sumByCurrency(
    transactions
      .filter((t) => kinds.includes(t.kind))
      .map((t) => t.amount),
  );
}

/** Includes `income` rows only. Transfers in are not income. */
export function calculateIncome(
  transactions: readonly Transaction[],
): MoneyByCurrency {
  return totalForKinds(transactions, ["income"]);
}

/** Includes `expense` rows only. Transfers out are not spending. */
export function calculateExpenses(
  transactions: readonly Transaction[],
): MoneyByCurrency {
  return totalForKinds(transactions, ["expense"]);
}

/**
 * Net cash flow = income − expenses.
 *
 * Transfers are excluded by design: moving money into a savings goal is not a
 * loss, and moving it back is not earnings.
 */
export function calculateNetCashFlow(
  transactions: readonly Transaction[],
): MoneyByCurrency {
  const income = calculateIncome(transactions);
  const expenses = calculateExpenses(transactions);
  const result: MoneyByCurrency = {};
  const codes = new Set<CurrencyCode>([
    ...(Object.keys(income) as CurrencyCode[]),
    ...(Object.keys(expenses) as CurrencyCode[]),
  ]);
  for (const code of codes) {
    const plus = income[code] ?? zeroMoney(code);
    const minus = expenses[code] ?? zeroMoney(code);
    result[code] = addMoney(plus, negateMoney(minus));
  }
  return result;
}

/**
 * Cash balance across all recorded movements, transfers included.
 *
 * This is the only aggregate that counts transfers, because they do move cash
 * even though they are neither income nor expense.
 */
export function calculateCashBalance(
  transactions: readonly Transaction[],
): MoneyByCurrency {
  return sumByCurrency(
    transactions.map((t) =>
      CASH_FLOW_SIGN[t.kind] === 1 ? t.amount : negateMoney(t.amount),
    ),
  );
}

/**
 * Savings rate = (income − expenses) / income, for a single currency.
 *
 * Returns `null` when there is no income in that currency. A rate is genuinely
 * undefined then — not zero — and the UI must say "not enough data" rather
 * than render 0%. Callers cannot accidentally treat it as a number.
 */
export function calculateSavingsRate(
  transactions: readonly Transaction[],
  currency: CurrencyCode,
): Fixed | null {
  const income = calculateIncome(transactions)[currency];
  if (!income || income.minor === 0n) return null;
  const net = calculateNetCashFlow(transactions)[currency];
  if (!net) return null;
  return fixedDivide(moneyToFixed(net), moneyToFixed(income));
}

export interface CategorySpending {
  readonly categoryId: string | null;
  readonly total: Money;
  /** Share of total spending in this currency, as a 0–1 ratio. */
  readonly share: Fixed;
}

/**
 * Expense totals per category, largest first.
 *
 * Restricted to one currency because a share-of-total only means something
 * within a single currency.
 */
export function calculateSpendingByCategory(
  transactions: readonly Transaction[],
  currency: CurrencyCode,
): CategorySpending[] {
  const expenses = transactions.filter(
    (t) => t.kind === "expense" && t.amount.currency === currency,
  );
  const totals = new Map<string | null, Money>();
  for (const transaction of expenses) {
    const key = transaction.categoryId;
    const running = totals.get(key);
    totals.set(
      key,
      running ? addMoney(running, transaction.amount) : transaction.amount,
    );
  }

  const grandTotal = expenses.reduce<bigint>((sum, t) => sum + t.amount.minor, 0n);

  return [...totals.entries()]
    .map(([categoryId, total]) => ({
      categoryId,
      total,
      share:
        grandTotal === 0n
          ? fixedFromInteger(0)
          : fixedDivide(moneyToFixed(total), moneyToFixed({ minor: grandTotal, currency })),
    }))
    .sort((a, b) => (b.total.minor > a.total.minor ? 1 : -1));
}

/**
 * A point on the income/expense trend chart.
 *
 * `hasData` separates "this month had no transactions" from "this month netted
 * zero". Charts must not draw a 0 line through periods the user never
 * recorded — that invents data.
 */
export interface CashFlowPoint {
  /** Period key, YYYY-MM for monthly buckets. */
  readonly period: string;
  readonly income: Money;
  readonly expenses: Money;
  readonly net: Money;
  readonly hasData: boolean;
}

/**
 * Buckets transactions into the given monthly periods.
 *
 * The period list is supplied by the caller (from `lib/dates`) rather than
 * derived from the data, so a chart axis stays stable when a month is empty.
 */
export function buildMonthlyCashFlow(
  transactions: readonly Transaction[],
  periods: readonly string[],
  currency: CurrencyCode,
): CashFlowPoint[] {
  const relevant = transactions.filter((t) => t.amount.currency === currency);

  return periods.map((period) => {
    const inPeriod = relevant.filter((t) => t.occurredOn.startsWith(period));
    const income = calculateIncome(inPeriod)[currency] ?? zeroMoney(currency);
    const expenses =
      calculateExpenses(inPeriod)[currency] ?? zeroMoney(currency);
    return {
      period,
      income,
      expenses,
      net: addMoney(income, negateMoney(expenses)),
      hasData: inPeriod.length > 0,
    };
  });
}

/** Ratio → percentage points, e.g. 0.18 becomes 18. */
export function ratioToPercent(ratio: Fixed): Fixed {
  return fixedMultiply(ratio, fixedFromInteger(100));
}
