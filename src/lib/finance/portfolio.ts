/**
 * Investment positions, cost basis and profit/loss.
 *
 * Cost method: weighted average cost (not FIFO, not specific-lot).
 *
 * How it is applied, precisely:
 *
 *   - A buy adds `quantity x unitPrice + fee` to the cost basis. Commission is
 *     capitalised into cost rather than expensed, so the average cost reflects
 *     what the units actually cost to acquire.
 *   - A sell removes `quantity x averageCost` from the cost basis and books
 *     `proceeds - costRemoved` as realised profit, where
 *     `proceeds = quantity x unitPrice - fee`. The sell-side fee therefore
 *     reduces realised profit instead of touching the remaining cost basis.
 *   - The average cost of the units still held is unchanged by a sale, which
 *     is the defining property of the average-cost method.
 *
 * Out of scope for this release, deliberately: FIFO/LIFO lot selection, short
 * positions, leverage, derivatives, corporate actions and tax lots.
 */

import {
  type Fixed,
  FIXED_ZERO,
  fixedAdd,
  fixedCompare,
  fixedDivide,
  fixedMultiply,
  fixedSubtract,
  fixedToString,
} from "./fixed";
import {
  type CurrencyCode,
  type Money,
  type MoneyByCurrency,
  addMoney,
  moneyFromFixed,
  moneyToFixed,
  negateMoney,
  sumByCurrency,
  zeroMoney,
} from "./money";
import type { Asset, AssetPrice, InvestmentTransaction } from "./types";

export class OversellError extends Error {
  constructor(
    readonly assetId: string,
    readonly requested: Fixed,
    readonly held: Fixed,
  ) {
    super(
      `Cannot sell ${fixedToString(requested)} units of asset ${assetId}: ` +
        `only ${fixedToString(held)} held at that date.`,
    );
    this.name = "OversellError";
  }
}

export interface Position {
  readonly assetId: string;
  readonly currency: CurrencyCode;
  /** Units currently held. Zero once fully sold. */
  readonly quantity: Fixed;
  /** Acquisition cost of the units still held, fees included. */
  readonly costBasis: Money;
  /** Profit/loss booked on units already sold, fees included. */
  readonly realizedProfitLoss: Money;
  /** Total commission paid across every trade in this position. */
  readonly totalFees: Money;
  readonly tradeCount: number;
}

/**
 * Trades in the order they must be applied: by date, then by id.
 *
 * Ordering is part of correctness, not presentation - applying a sale before
 * the buy that supplied the units would raise a spurious `OversellError`.
 * The id tiebreak keeps same-day trades deterministic between runs.
 */
export function sortTradesForReplay(
  trades: readonly InvestmentTransaction[],
): InvestmentTransaction[] {
  return [...trades].sort((a, b) =>
    a.occurredOn === b.occurredOn
      ? a.id.localeCompare(b.id)
      : a.occurredOn.localeCompare(b.occurredOn),
  );
}

/** Gross value of a trade before fees: quantity x unit price. */
export function tradeGrossValue(
  trade: InvestmentTransaction,
  currency: CurrencyCode,
): Money {
  return moneyFromFixed(
    fixedMultiply(trade.quantity, trade.unitPrice),
    currency,
  );
}

/**
 * Replays an asset's trades into a position.
 *
 * Throws `OversellError` if a sale exceeds the units held at that point. The
 * calculation layer refuses to produce a negative holding, because a negative
 * quantity would silently become a short position the rest of the app has no
 * model for. The write path validates the same rule before inserting a trade.
 */
export function buildPosition(
  asset: Asset,
  trades: readonly InvestmentTransaction[],
): Position {
  const currency = asset.currency;
  let quantity: Fixed = FIXED_ZERO;
  let costBasis = zeroMoney(currency);
  let realized = zeroMoney(currency);
  let fees = zeroMoney(currency);
  let tradeCount = 0;

  for (const trade of sortTradesForReplay(trades)) {
    if (trade.assetId !== asset.id) continue;
    if (trade.fee.currency !== currency) {
      throw new Error(
        `Fee currency ${trade.fee.currency} does not match asset currency ${currency}`,
      );
    }
    tradeCount += 1;
    const gross = tradeGrossValue(trade, currency);
    fees = addMoney(fees, trade.fee);

    if (trade.side === "buy") {
      quantity = fixedAdd(quantity, trade.quantity);
      costBasis = addMoney(costBasis, addMoney(gross, trade.fee));
      continue;
    }

    if (fixedCompare(trade.quantity, quantity) > 0) {
      throw new OversellError(asset.id, trade.quantity, quantity);
    }

    // Average cost of the units held immediately before this sale.
    const averageCost = fixedDivide(moneyToFixed(costBasis), quantity);
    const remainingQuantity = fixedSubtract(quantity, trade.quantity);

    // When the position is closed out, every unit of cost basis leaves with
    // the final sale. Deriving it by subtraction rather than multiplying the
    // rounded average cost is what keeps a closed position at exactly zero
    // instead of a stray minor unit of residue.
    const costRemoved =
      remainingQuantity === FIXED_ZERO
        ? costBasis
        : moneyFromFixed(
            fixedMultiply(averageCost, trade.quantity),
            currency,
          );

    const proceeds = addMoney(gross, negateMoney(trade.fee));
    realized = addMoney(realized, addMoney(proceeds, negateMoney(costRemoved)));
    costBasis = addMoney(costBasis, negateMoney(costRemoved));
    quantity = remainingQuantity;
  }

  return {
    assetId: asset.id,
    currency,
    quantity,
    costBasis,
    realizedProfitLoss: realized,
    totalFees: fees,
    tradeCount,
  };
}

/**
 * Average cost per unit of the units still held, or `null` for a closed
 * position. Dividing a zero cost basis by a zero quantity has no answer, and
 * returning 0 would read as "these units were free".
 */
export function calculateAverageCost(position: Position): Fixed | null {
  if (position.quantity === FIXED_ZERO) return null;
  return fixedDivide(moneyToFixed(position.costBasis), position.quantity);
}

/**
 * The valuation Daylight is willing to state for a position.
 *
 * `status` is the whole point of this type. A missing price is not a zero
 * value, and a price recorded three weeks ago is not today's price - both
 * cases are surfaced so the UI can disclose them instead of printing a
 * confident number.
 */
export type Valuation =
  | {
      readonly status: "valued";
      readonly value: Money;
      readonly price: Fixed;
      readonly priceAsOf: string;
    }
  | { readonly status: "no-price" }
  | { readonly status: "closed" };

export function valuePosition(
  position: Position,
  price: AssetPrice | undefined,
): Valuation {
  if (position.quantity === FIXED_ZERO) return { status: "closed" };
  if (!price) return { status: "no-price" };
  if (price.currency !== position.currency) {
    // A price quoted in another currency cannot value this position without an
    // explicit rate; treating it as the asset's own currency would be wrong.
    return { status: "no-price" };
  }
  return {
    status: "valued",
    value: moneyFromFixed(
      fixedMultiply(position.quantity, price.price),
      position.currency,
    ),
    price: price.price,
    priceAsOf: price.asOf,
  };
}

/**
 * Unrealised profit/loss = market value - cost basis of units held.
 * `null` whenever the position cannot be valued, for the reasons above.
 */
export function calculateUnrealizedProfitLoss(
  position: Position,
  price: AssetPrice | undefined,
): Money | null {
  const valuation = valuePosition(position, price);
  if (valuation.status !== "valued") return null;
  return addMoney(valuation.value, negateMoney(position.costBasis));
}

export interface PortfolioValue {
  /** Market value per currency. Only valued positions contribute. */
  readonly valued: MoneyByCurrency;
  /** Cost basis per currency for those same valued positions. */
  readonly costBasis: MoneyByCurrency;
  /** Positions held but with no usable price, so excluded from the totals. */
  readonly unpricedAssetIds: readonly string[];
  /** True when more than one currency is present, so no single total exists. */
  readonly isMixedCurrency: boolean;
}

/**
 * Aggregates positions into per-currency totals.
 *
 * Values in different currencies are never added together. The result names
 * the currencies it contains and lists the assets it could not price, so the
 * UI can report a TRY total, a USD total and "2 assets without a price"
 * rather than implying a single portfolio number that does not exist.
 */
export function calculatePortfolioValue(
  positions: readonly Position[],
  prices: readonly AssetPrice[],
): PortfolioValue {
  const priceByAsset = latestPriceByAsset(prices);
  const valuedAmounts: Money[] = [];
  const costAmounts: Money[] = [];
  const unpriced: string[] = [];

  for (const position of positions) {
    if (position.quantity === FIXED_ZERO) continue;
    const valuation = valuePosition(
      position,
      priceByAsset.get(position.assetId),
    );
    if (valuation.status !== "valued") {
      unpriced.push(position.assetId);
      continue;
    }
    valuedAmounts.push(valuation.value);
    costAmounts.push(position.costBasis);
  }

  const valued = sumByCurrency(valuedAmounts);
  return {
    valued,
    costBasis: sumByCurrency(costAmounts),
    unpricedAssetIds: unpriced,
    isMixedCurrency: Object.keys(valued).length > 1,
  };
}

/** Most recent price per asset. Equal timestamps keep the first seen. */
export function latestPriceByAsset(
  prices: readonly AssetPrice[],
): Map<string, AssetPrice> {
  const latest = new Map<string, AssetPrice>();
  for (const price of prices) {
    const current = latest.get(price.assetId);
    if (!current || price.asOf > current.asOf) latest.set(price.assetId, price);
  }
  return latest;
}

export interface AllocationSlice {
  readonly assetId: string;
  readonly value: Money;
  /** Share of the portfolio in this currency, as a 0-1 ratio. */
  readonly share: Fixed;
}

/**
 * Allocation within a single currency, largest first.
 *
 * Scoped to one currency because a percentage of a mixed-currency total would
 * be built on an addition that is not valid in the first place.
 */
export function calculatePortfolioAllocation(
  positions: readonly Position[],
  prices: readonly AssetPrice[],
  currency: CurrencyCode,
): AllocationSlice[] {
  const priceByAsset = latestPriceByAsset(prices);
  const slices: { assetId: string; value: Money }[] = [];

  for (const position of positions) {
    if (position.currency !== currency || position.quantity === FIXED_ZERO) {
      continue;
    }
    const valuation = valuePosition(
      position,
      priceByAsset.get(position.assetId),
    );
    if (valuation.status !== "valued") continue;
    slices.push({ assetId: position.assetId, value: valuation.value });
  }

  const total = slices.reduce<bigint>((sum, s) => sum + s.value.minor, 0n);

  return slices
    .map((slice) => ({
      assetId: slice.assetId,
      value: slice.value,
      share:
        total === 0n
          ? FIXED_ZERO
          : fixedDivide(
              moneyToFixed(slice.value),
              moneyToFixed({ minor: total, currency }),
            ),
    }))
    .sort((a, b) => (b.value.minor > a.value.minor ? 1 : -1));
}
