import { ZERO, type Dec } from "../decimal";
import { ASSET_SYMBOLS, type AssetSymbol, type Price } from "../model";
import type { Position } from "./ledger";

export interface Holding {
  symbol: AssetSymbol;
  status: "open" | "closed";
  quantity: Dec;
  averageCost: Dec;
  costBasis: Dec;
  /** null when prices.csv has no row for this asset. */
  currentPrice: Dec | null;
  priceAsOf: string | null;
  /** null only for an open position without a price. A closed position is worth zero. */
  currentValue: Dec | null;
  realizedPnl: Dec;
  unrealizedPnl: Dec | null;
  totalPnl: Dec | null;
  /** Share of the priced portfolio value, 0–1. null when the value is unknown or the portfolio is worth zero. */
  allocation: Dec | null;
  feesPaid: Dec;
  tradeCount: number;
}

export interface PortfolioTotals {
  /** Sum over holdings with a known value. */
  currentValue: Dec;
  /** Sum over all holdings, priced or not. */
  costBasis: Dec;
  realizedPnl: Dec;
  /** Sum over holdings with a known value. */
  unrealizedPnl: Dec;
  totalPnl: Dec;
  feesPaid: Dec;
}

export interface Valuation {
  holdings: Holding[];
  totals: PortfolioTotals;
  /** Latest as_of in the price snapshot; null when there are no prices. */
  pricesAsOf: string | null;
  /** True when the snapshot rows carry different as_of timestamps. */
  pricesAsOfMixed: boolean;
  /** Open positions that could not be valued. When non-empty, value and unrealized totals are partial. */
  missingPrices: AssetSymbol[];
}

/**
 *   current value  = quantity × current price
 *   unrealized P&L = current value − cost basis
 *   total P&L      = realized + unrealized
 *   allocation     = asset value / portfolio value
 */
export function valuePortfolio(positions: readonly Position[], prices: readonly Price[]): Valuation {
  const priceBySymbol = new Map(prices.map((p) => [p.symbol, p]));
  const order = (s: AssetSymbol) => ASSET_SYMBOLS.indexOf(s);
  const sorted = [...positions].filter((p) => p.tradeCount > 0).sort((a, b) => order(a.symbol) - order(b.symbol));

  const missingPrices: AssetSymbol[] = [];

  const rows = sorted.map((position) => {
    const price = priceBySymbol.get(position.symbol) ?? null;
    const open = position.quantity.gt(0);
    if (open && price === null) missingPrices.push(position.symbol);

    const currentValue = !open ? ZERO : price === null ? null : position.quantity.mul(price.priceUsd);
    const unrealizedPnl = currentValue === null ? null : currentValue.sub(position.costBasis);
    return {
      symbol: position.symbol,
      status: open ? ("open" as const) : ("closed" as const),
      quantity: position.quantity,
      averageCost: position.averageCost,
      costBasis: position.costBasis,
      currentPrice: price?.priceUsd ?? null,
      priceAsOf: price?.asOf ?? null,
      currentValue,
      realizedPnl: position.realizedPnl,
      unrealizedPnl,
      totalPnl: unrealizedPnl === null ? null : position.realizedPnl.add(unrealizedPnl),
      feesPaid: position.feesPaid,
      tradeCount: position.tradeCount,
    };
  });

  const sum = (values: (Dec | null)[]) => values.reduce<Dec>((acc, v) => (v === null ? acc : acc.add(v)), ZERO);
  const currentValue = sum(rows.map((r) => r.currentValue));
  const realizedPnl = sum(rows.map((r) => r.realizedPnl));
  const unrealizedPnl = sum(rows.map((r) => r.unrealizedPnl));

  const holdings: Holding[] = rows.map((r) => ({
    ...r,
    allocation: r.currentValue === null || currentValue.isZero() ? null : r.currentValue.div(currentValue),
  }));

  const latest = prices.reduce<Price | null>((best, p) => (best === null || p.time > best.time ? p : best), null);

  return {
    holdings,
    totals: {
      currentValue,
      costBasis: sum(rows.map((r) => r.costBasis)),
      realizedPnl,
      unrealizedPnl,
      totalPnl: realizedPnl.add(unrealizedPnl),
      feesPaid: sum(rows.map((r) => r.feesPaid)),
    },
    pricesAsOf: latest?.asOf ?? null,
    pricesAsOfMixed: new Set(prices.map((p) => p.time)).size > 1,
    missingPrices,
  };
}
