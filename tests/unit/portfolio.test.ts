import { beforeEach, describe, expect, it } from "vitest";

import { fixedToString } from "@/lib/finance/fixed";
import { moneyToDecimalString } from "@/lib/finance/money";
import {
  OversellError,
  buildPosition,
  calculateAverageCost,
  calculatePortfolioAllocation,
  calculatePortfolioValue,
  calculateUnrealizedProfitLoss,
  latestPriceByAsset,
  valuePosition,
} from "@/lib/finance/portfolio";
import {
  makeAsset,
  makePrice,
  makeTrade,
  resetIds,
  try_,
} from "../factories";

beforeEach(resetIds);

describe("single purchase", () => {
  const asset = makeAsset({ id: "a1" });

  it("sets cost basis to quantity x price plus fee", () => {
    const position = buildPosition(asset, [
      makeTrade({
        assetId: "a1",
        side: "buy",
        quantity: "10",
        unitPrice: "100",
        fee: try_("15"),
      }),
    ]);

    expect(fixedToString(position.quantity)).toBe("10");
    expect(moneyToDecimalString(position.costBasis)).toBe("1015");
    expect(moneyToDecimalString(position.realizedProfitLoss)).toBe("0");
    expect(moneyToDecimalString(position.totalFees)).toBe("15");
    // The fee is capitalised, so average cost is above the traded price.
    expect(fixedToString(calculateAverageCost(position)!)).toBe("101.5");
  });
});

describe("multiple purchases of the same asset", () => {
  const asset = makeAsset({ id: "a1" });

  it("weights the average cost by quantity", () => {
    const position = buildPosition(asset, [
      makeTrade({
        assetId: "a1",
        side: "buy",
        quantity: "10",
        unitPrice: "100",
        occurredOn: "2026-01-10",
      }),
      makeTrade({
        assetId: "a1",
        side: "buy",
        quantity: "30",
        unitPrice: "140",
        occurredOn: "2026-02-10",
      }),
    ]);

    // (10*100 + 30*140) / 40 = 5200 / 40 = 130
    expect(fixedToString(position.quantity)).toBe("40");
    expect(moneyToDecimalString(position.costBasis)).toBe("5200");
    expect(fixedToString(calculateAverageCost(position)!)).toBe("130");
  });

  it("applies trades in date order regardless of input order", () => {
    const later = makeTrade({
      assetId: "a1",
      side: "sell",
      quantity: "5",
      unitPrice: "200",
      occurredOn: "2026-03-01",
    });
    const earlier = makeTrade({
      assetId: "a1",
      side: "buy",
      quantity: "5",
      unitPrice: "100",
      occurredOn: "2026-01-01",
    });

    // Passing the sale first must not look like a short sale.
    const position = buildPosition(asset, [later, earlier]);
    expect(fixedToString(position.quantity)).toBe("0");
    expect(moneyToDecimalString(position.realizedProfitLoss)).toBe("500");
  });
});

describe("partial sale", () => {
  const asset = makeAsset({ id: "a1" });
  const position = buildPosition(asset, [
    makeTrade({
      assetId: "a1",
      side: "buy",
      quantity: "40",
      unitPrice: "130",
      occurredOn: "2026-01-10",
    }),
    makeTrade({
      assetId: "a1",
      side: "sell",
      quantity: "10",
      unitPrice: "150",
      fee: try_("20"),
      occurredOn: "2026-04-10",
    }),
  ]);

  it("books realised profit against the average cost, net of the fee", () => {
    // proceeds 10*150 - 20 = 1480; cost removed 10*130 = 1300; profit 180
    expect(moneyToDecimalString(position.realizedProfitLoss)).toBe("180");
  });

  it("reduces the cost basis but leaves the average cost unchanged", () => {
    expect(fixedToString(position.quantity)).toBe("30");
    expect(moneyToDecimalString(position.costBasis)).toBe("3900");
    expect(fixedToString(calculateAverageCost(position)!)).toBe("130");
  });
});

describe("full exit", () => {
  const asset = makeAsset({ id: "a1" });

  it("leaves no cost-basis residue even when the average cost does not divide evenly", () => {
    // 3 units at 100.01 total 300.03; average cost 100.01 exactly, but a
    // partial sale of 1 then 2 exercises the rounding path.
    const position = buildPosition(asset, [
      makeTrade({
        assetId: "a1",
        side: "buy",
        quantity: "3",
        unitPrice: "100",
        fee: try_("0.01"),
        occurredOn: "2026-01-01",
      }),
      makeTrade({
        assetId: "a1",
        side: "sell",
        quantity: "1",
        unitPrice: "100",
        occurredOn: "2026-02-01",
      }),
      makeTrade({
        assetId: "a1",
        side: "sell",
        quantity: "2",
        unitPrice: "100",
        occurredOn: "2026-03-01",
      }),
    ]);

    expect(fixedToString(position.quantity)).toBe("0");
    expect(moneyToDecimalString(position.costBasis)).toBe("0");
    expect(calculateAverageCost(position)).toBeNull();
    // The only economic loss is the 0.01 fee paid on acquisition.
    expect(moneyToDecimalString(position.realizedProfitLoss)).toBe("-0.01");
  });

  it("reports a closed position as closed rather than worth zero", () => {
    const position = buildPosition(asset, [
      makeTrade({
        assetId: "a1",
        side: "buy",
        quantity: "1",
        unitPrice: "10",
        occurredOn: "2026-01-01",
      }),
      makeTrade({
        assetId: "a1",
        side: "sell",
        quantity: "1",
        unitPrice: "12",
        occurredOn: "2026-02-01",
      }),
    ]);
    expect(valuePosition(position, makePrice("a1", "20"))).toEqual({
      status: "closed",
    });
  });
});

describe("overselling", () => {
  const asset = makeAsset({ id: "a1" });

  it("refuses to sell more units than are held", () => {
    expect(() =>
      buildPosition(asset, [
        makeTrade({
          assetId: "a1",
          side: "buy",
          quantity: "5",
          unitPrice: "100",
          occurredOn: "2026-01-01",
        }),
        makeTrade({
          assetId: "a1",
          side: "sell",
          quantity: "5.00000001",
          unitPrice: "100",
          occurredOn: "2026-02-01",
        }),
      ]),
    ).toThrow(OversellError);
  });

  it("allows selling the exact holding", () => {
    const position = buildPosition(asset, [
      makeTrade({
        assetId: "a1",
        side: "buy",
        quantity: "0.00000003",
        unitPrice: "100",
        occurredOn: "2026-01-01",
      }),
      makeTrade({
        assetId: "a1",
        side: "sell",
        quantity: "0.00000003",
        unitPrice: "100",
        occurredOn: "2026-02-01",
      }),
    ]);
    expect(fixedToString(position.quantity)).toBe("0");
  });
});

describe("fractional crypto quantities", () => {
  const asset = makeAsset({
    id: "btc",
    assetClass: "crypto",
    symbol: "BTC",
    currency: "USD",
  });

  it("keeps eight decimal places through cost and valuation", () => {
    const position = buildPosition(asset, [
      makeTrade({
        assetId: "btc",
        side: "buy",
        quantity: "0.04150000",
        unitPrice: "61500.25",
        fee: { minor: 350n, currency: "USD" },
        occurredOn: "2026-05-01",
      }),
    ]);

    // 0.0415 * 61500.25 = 2552.260375 -> 2552.26 rounded, plus 3.50 fee
    expect(moneyToDecimalString(position.costBasis)).toBe("2555.76");
    expect(fixedToString(position.quantity)).toBe("0.0415");
  });
});

describe("valuation and unrealised profit", () => {
  const asset = makeAsset({ id: "a1" });
  const position = buildPosition(asset, [
    makeTrade({
      assetId: "a1",
      side: "buy",
      quantity: "10",
      unitPrice: "100",
      occurredOn: "2026-01-01",
    }),
  ]);

  it("returns no-price rather than zero when a price is missing", () => {
    expect(valuePosition(position, undefined)).toEqual({ status: "no-price" });
    expect(calculateUnrealizedProfitLoss(position, undefined)).toBeNull();
  });

  it("refuses a price quoted in another currency", () => {
    const foreign = makePrice("a1", "120", "2026-10-01T00:00:00.000Z", "USD");
    expect(valuePosition(position, foreign)).toEqual({ status: "no-price" });
  });

  it("values at the recorded price and keeps its timestamp", () => {
    const price = makePrice("a1", "118.40", "2026-10-02T10:00:00.000Z");
    const valuation = valuePosition(position, price);
    expect(valuation.status).toBe("valued");
    if (valuation.status !== "valued") throw new Error("unreachable");
    expect(moneyToDecimalString(valuation.value)).toBe("1184");
    // The staleness of the price is preserved for disclosure in the UI.
    expect(valuation.priceAsOf).toBe("2026-10-02T10:00:00.000Z");
    expect(
      moneyToDecimalString(calculateUnrealizedProfitLoss(position, price)!),
    ).toBe("184");
  });

  it("uses the most recent price when several are recorded", () => {
    const prices = [
      makePrice("a1", "100", "2026-09-01T00:00:00.000Z"),
      makePrice("a1", "130", "2026-10-10T00:00:00.000Z"),
      makePrice("a1", "115", "2026-10-05T00:00:00.000Z"),
    ];
    expect(fixedToString(latestPriceByAsset(prices).get("a1")!.price)).toBe(
      "130",
    );
  });

  it("reports a loss as a negative amount", () => {
    const price = makePrice("a1", "80");
    expect(
      moneyToDecimalString(calculateUnrealizedProfitLoss(position, price)!),
    ).toBe("-200");
  });
});

describe("portfolio totals", () => {
  const lira = makeAsset({ id: "tr1", currency: "TRY" });
  const dollar = makeAsset({ id: "us1", currency: "USD" });
  const unpriced = makeAsset({ id: "np1", currency: "TRY" });

  const positions = [
    buildPosition(lira, [
      makeTrade({
        assetId: "tr1",
        side: "buy",
        quantity: "10",
        unitPrice: "100",
      }),
    ]),
    buildPosition(dollar, [
      makeTrade({
        assetId: "us1",
        side: "buy",
        quantity: "4",
        unitPrice: "50",
        fee: { minor: 0n, currency: "USD" },
      }),
    ]),
    buildPosition(unpriced, [
      makeTrade({
        assetId: "np1",
        side: "buy",
        quantity: "7",
        unitPrice: "30",
      }),
    ]),
  ];

  const prices = [
    makePrice("tr1", "120"),
    makePrice("us1", "60", "2026-10-18T09:00:00.000Z", "USD"),
  ];

  it("never adds different currencies into one total", () => {
    const total = calculatePortfolioValue(positions, prices);
    expect(moneyToDecimalString(total.valued.TRY!)).toBe("1200");
    expect(moneyToDecimalString(total.valued.USD!)).toBe("240");
    expect(total.isMixedCurrency).toBe(true);
  });

  it("names the assets it could not price instead of treating them as zero", () => {
    const total = calculatePortfolioValue(positions, prices);
    expect(total.unpricedAssetIds).toEqual(["np1"]);
  });

  it("computes allocation within a single currency", () => {
    const second = buildPosition(makeAsset({ id: "tr2", currency: "TRY" }), [
      makeTrade({
        assetId: "tr2",
        side: "buy",
        quantity: "10",
        unitPrice: "10",
      }),
    ]);
    const allocation = calculatePortfolioAllocation(
      [...positions, second],
      [...prices, makePrice("tr2", "40")],
      "TRY",
    );
    // TRY side: tr1 = 1200, tr2 = 400, total 1600
    expect(allocation.map((s) => s.assetId)).toEqual(["tr1", "tr2"]);
    expect(fixedToString(allocation[0].share)).toBe("0.75");
    expect(fixedToString(allocation[1].share)).toBe("0.25");
  });

  it("returns an empty portfolio rather than a zero value", () => {
    const empty = calculatePortfolioValue([], []);
    expect(empty.valued).toEqual({});
    expect(empty.isMixedCurrency).toBe(false);
    expect(calculatePortfolioAllocation([], [], "TRY")).toEqual([]);
  });
});
