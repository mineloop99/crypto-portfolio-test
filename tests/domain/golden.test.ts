import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { Dec, ZERO, type Dec as DecType } from "@/domain/decimal";
import { parsePricesCsv } from "@/domain/csv/parse-prices";
import { importPortfolio } from "@/domain/portfolio/import-portfolio";

/**
 * The supplied dataset, checked against values produced by an independent implementation
 * (scripts/oracle.py — Python decimal, 50 significant digits), compared at 20 decimal places.
 */
const EXPECTED = {
  BTC: {
    quantity: "0.07742920000000000000",
    averageCost: "117711.89990106209050487532",
    costBasis: "9114.33823981931681812009",
    currentValue: "8633.35580000000000000000",
    realizedPnl: "-463.74597532718318187991",
    unrealizedPnl: "-480.98243981931681812009",
    totalPnl: "-944.72841514650000000000",
    allocation: "0.14241551997522657354",
    feesPaid: "486.42000000000000000000",
  },
  ETH: {
    quantity: "2.84689800000000000000",
    averageCost: "4091.62085296938408363416",
    costBasis: "11648.42722307683360892994",
    currentValue: "11458.76445000000000000000",
    realizedPnl: "-984.42554871316639107006",
    unrealizedPnl: "-189.66277307683360892994",
    totalPnl: "-1174.08832179000000000000",
    allocation: "0.18902335722343229983",
    feesPaid: "529.66000000000000000000",
  },
  SOL: {
    quantity: "53.36430000000000000000",
    averageCost: "214.24773821868093756646",
    costBasis: "11433.18057662315515657788",
    currentValue: "11126.45655000000000000000",
    realizedPnl: "-2408.93459807684484342212",
    unrealizedPnl: "-306.72402662315515657788",
    totalPnl: "-2715.65862470000000000000",
    allocation: "0.18354161831833868667",
    feesPaid: "518.99000000000000000000",
  },
  CKB: {
    quantity: "1947047.00000000000000000000",
    averageCost: "0.00687336219653416946",
    costBasis: "13382.75924467526504742099",
    currentValue: "13921.38605000000000000000",
    realizedPnl: "1499.62749023526504742099",
    unrealizedPnl: "538.62680532473495257901",
    totalPnl: "2038.25429556000000000000",
    allocation: "0.22964667262834407526",
    feesPaid: "525.21000000000000000000",
  },
  DOGE: {
    quantity: "63970.78000000000000000000",
    averageCost: "0.22495477052345560274",
    costBasis: "14390.53213510646320272939",
    currentValue: "15480.92876000000000000000",
    realizedPnl: "-2695.48405606353679727061",
    unrealizedPnl: "1090.39662489353679727061",
    totalPnl: "-1605.08743117000000000000",
    allocation: "0.25537283185465836470",
    feesPaid: "648.58000000000000000000",
  },
} as const;

const EXPECTED_TOTALS = {
  currentValue: "60620.89161000000000000000",
  costBasis: "59969.23741930103383377829",
  realizedPnl: "-5052.96268794546616622171",
  unrealizedPnl: "651.65419069896616622171",
  totalPnl: "-4401.30849724650000000000",
  feesPaid: "2708.86000000000000000000",
} as const;

const read = (name: string) => readFileSync(join(process.cwd(), "data", name), "utf8");
const at20 = (value: DecType | null) => (value === null ? null : value.toFixed(20));

function loadSample() {
  const prices = parsePricesCsv(read("prices.csv"));
  if (!prices.ok) throw new Error(JSON.stringify(prices.issues));
  const result = importPortfolio(read("trades.csv"), prices.value);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.value;
}

describe("supplied dataset (golden)", () => {
  const portfolio = loadSample();

  it("imports all 200 trades", () => {
    expect(portfolio.trades).toHaveLength(200);
    expect(portfolio.pricesAsOf).toBe("2026-03-31T23:59:59Z");
    expect(portfolio.missingPrices).toEqual([]);
  });

  it.each(Object.keys(EXPECTED) as (keyof typeof EXPECTED)[])("matches the reference numbers for %s", (symbol) => {
    const holding = portfolio.holdings.find((h) => h.symbol === symbol)!;
    const actual = Object.fromEntries(Object.keys(EXPECTED[symbol]).map((k) => [k, at20(holding[k as keyof typeof holding] as DecType)]));
    expect(actual).toEqual(EXPECTED[symbol]);
  });

  it("matches the reference totals", () => {
    const actual = Object.fromEntries(Object.entries(portfolio.totals).map(([k, v]) => [k, at20(v)]));
    expect(actual).toEqual(EXPECTED_TOTALS);
  });

  it("closes and reopens every asset twice, leaving no residue on the closing trades", () => {
    for (const symbol of Object.keys(EXPECTED)) {
      const closes = portfolio.ledger.entries.filter((e) => e.trade.symbol === symbol && e.quantityAfter.isZero());
      expect(closes).toHaveLength(2);
      for (const close of closes) expect(close.costBasisAfter.isZero() && close.averageCostAfter.isZero()).toBe(true);
    }
  });

  it("satisfies the cash-flow invariant: total P&L = value + SELL net proceeds − BUY gross − BUY fees", () => {
    // Computed straight from the rows, independent of how cost basis is averaged.
    const cashFlow = portfolio.trades.reduce((acc, t) => {
      const gross = t.quantity.mul(t.priceUsd);
      return t.side === "SELL" ? acc.add(gross).sub(t.feeUsd) : acc.sub(gross).sub(t.feeUsd);
    }, ZERO);
    const expected = portfolio.totals.currentValue.add(cashFlow);
    expect(expected.toFixed()).toBe("-4401.3084972465");
    expect(portfolio.totals.totalPnl.sub(expected).abs().lt(new Dec("1e-30"))).toBe(true);
  });

  it("reconciles holdings with totals", () => {
    const sum = (pick: (h: (typeof portfolio.holdings)[number]) => DecType | null) =>
      portfolio.holdings.reduce((acc, h) => acc.add(pick(h) ?? ZERO), ZERO);
    expect(sum((h) => h.currentValue).eq(portfolio.totals.currentValue)).toBe(true);
    expect(sum((h) => h.totalPnl).eq(portfolio.totals.totalPnl)).toBe(true);
    expect(sum((h) => h.allocation).toDecimalPlaces(30).eq(1)).toBe(true);
  });
});
