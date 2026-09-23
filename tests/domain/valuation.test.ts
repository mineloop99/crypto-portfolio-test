import { describe, expect, it } from "vitest";
import { Dec } from "@/domain/decimal";
import type { AssetSymbol, Price } from "@/domain/model";
import { buildLedger } from "@/domain/portfolio/ledger";
import { valuePortfolio } from "@/domain/portfolio/valuation";
import { dec, trade } from "../helpers";

const AS_OF = "2026-03-31T23:59:59Z";
const price = (symbol: AssetSymbol, value: string, asOf = AS_OF): Price => ({
  symbol,
  priceUsd: new Dec(value),
  asOf,
  time: Date.parse(asOf),
});

describe("portfolio valuation", () => {
  // BTC: BUY 2 @ 100 fee 2 → cost 202, avg 101; SELL 1 @ 150 fee 1 → realized 149 − 101 = 48; left 1 @ 101
  // SOL: BUY 10 @ 10 → cost 100
  const ledger = buildLedger([
    trade("BUY", "2", "100", "2", { symbol: "BTC" }),
    trade("SELL", "1", "150", "1", { symbol: "BTC" }),
    trade("BUY", "10", "10", "0", { symbol: "SOL" }),
  ]);

  it("values holdings and computes unrealized, total P&L and allocation", () => {
    // BTC @ 300: value 300, unrealized 300 − 101 = 199, total 199 + 48 = 247
    // SOL @ 5:   value 50,  unrealized 50 − 100 = −50, total −50
    // portfolio value 350 → allocation BTC 300/350 = 6/7, SOL 1/7
    const v = valuePortfolio(ledger.positions, [price("BTC", "300"), price("SOL", "5")]);
    const [btc, sol] = v.holdings;
    expect(btc.symbol).toBe("BTC");
    expect(dec(btc.currentValue)).toBe("300");
    expect(dec(btc.unrealizedPnl)).toBe("199");
    expect(dec(btc.totalPnl)).toBe("247");
    expect(dec(sol.unrealizedPnl)).toBe("-50");
    expect(btc.allocation!.toFixed(10)).toBe("0.8571428571");
    expect(dec(btc.allocation!.add(sol.allocation!).toDecimalPlaces(30))).toBe("1");

    expect(dec(v.totals.currentValue)).toBe("350");
    expect(dec(v.totals.costBasis)).toBe("201");
    expect(dec(v.totals.realizedPnl)).toBe("48");
    expect(dec(v.totals.unrealizedPnl)).toBe("149");
    expect(dec(v.totals.totalPnl)).toBe("197");
    expect(dec(v.totals.feesPaid)).toBe("3");
    expect(v.pricesAsOf).toBe(AS_OF);
    expect(v.missingPrices).toEqual([]);
  });

  it("reports a missing price instead of guessing a value", () => {
    const v = valuePortfolio(ledger.positions, [price("BTC", "300")]);
    const sol = v.holdings.find((h) => h.symbol === "SOL")!;
    expect(sol.currentPrice).toBeNull();
    expect(sol.currentValue).toBeNull();
    expect(sol.unrealizedPnl).toBeNull();
    expect(sol.allocation).toBeNull();
    expect(v.missingPrices).toEqual(["SOL"]);
    // totals cover priced holdings only; cost basis still includes SOL
    expect(dec(v.totals.currentValue)).toBe("300");
    expect(dec(v.totals.costBasis)).toBe("201");
    expect(dec(v.holdings[0].allocation)).toBe("1");
  });

  it("keeps a closed asset with its realized P&L and zero value", () => {
    const closed = buildLedger([trade("BUY", "1", "100", "0", { symbol: "ETH" }), trade("SELL", "1", "80", "0", { symbol: "ETH" })]);
    const v = valuePortfolio(closed.positions, []);
    expect(v.holdings[0].status).toBe("closed");
    expect(dec(v.holdings[0].realizedPnl)).toBe("-20");
    expect(dec(v.holdings[0].currentValue)).toBe("0");
    expect(dec(v.holdings[0].unrealizedPnl)).toBe("0");
    expect(v.holdings[0].allocation).toBeNull(); // portfolio worth zero → no meaningful share
    expect(v.missingPrices).toEqual([]); // no price needed for a closed position
  });

  it("uses the latest snapshot time and flags mixed timestamps", () => {
    const v = valuePortfolio(ledger.positions, [price("BTC", "300", "2026-03-30T00:00:00Z"), price("SOL", "5")]);
    expect(v.pricesAsOf).toBe(AS_OF);
    expect(v.pricesAsOfMixed).toBe(true);
  });
});
