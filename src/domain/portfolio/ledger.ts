import { ZERO, type Dec } from "../decimal";
import type { AssetSymbol, Trade } from "../model";

/** Running state of one asset under weighted-average cost. */
export interface Position {
  symbol: AssetSymbol;
  quantity: Dec;
  costBasis: Dec;
  averageCost: Dec;
  realizedPnl: Dec;
  feesPaid: Dec;
  tradeCount: number;
}

/** What one trade did to its position — lets the UI explain which transactions produced the results. */
export interface LedgerEntry {
  trade: Trade;
  /** quantity × price_usd */
  grossValue: Dec;
  /** BUY: gross + fee added to cost basis. SELL: cost removed from cost basis. */
  costChange: Dec;
  /** SELL only: gross − fee. */
  netProceeds: Dec | null;
  /** SELL only: net proceeds − cost removed. */
  realizedPnl: Dec | null;
  quantityAfter: Dec;
  costBasisAfter: Dec;
  averageCostAfter: Dec;
}

export interface ShortSell {
  trade: Trade;
  /** Quantity held just before this SELL. */
  available: Dec;
}

export interface Ledger {
  /** One per traded asset, in order of first appearance. */
  positions: Position[];
  /** One per trade, in processing order. */
  entries: LedgerEntry[];
  /** SELLs larger than the holding at that point; they are skipped so later rows can still be checked. */
  shortSells: ShortSell[];
}

/** Processing order: ascending timestamp, ties broken by trade_id so the result never depends on file order. */
export function compareTrades(a: Trade, b: Trade): number {
  if (a.time !== b.time) return a.time - b.time;
  return a.tradeId < b.tradeId ? -1 : a.tradeId > b.tradeId ? 1 : 0;
}

function emptyPosition(symbol: AssetSymbol): Position {
  return { symbol, quantity: ZERO, costBasis: ZERO, averageCost: ZERO, realizedPnl: ZERO, feesPaid: ZERO, tradeCount: 0 };
}

/**
 * Replays trades with weighted-average cost basis, per the assessment rules:
 *
 *   BUY : cost basis += qty × price + fee;           average = cost basis / quantity
 *   SELL: cost removed = average × qty;              realized += qty × price − fee − cost removed
 *         the average cost of the remaining position does not change
 *
 * A SELL of the entire holding removes the entire remaining cost basis (identical in exact arithmetic, and it
 * guarantees quantity, cost basis and average are exactly zero before the position is reopened).
 * Pure and deterministic: no I/O, no rounding.
 */
export function buildLedger(trades: readonly Trade[]): Ledger {
  const bySymbol = new Map<AssetSymbol, Position>();
  const entries: LedgerEntry[] = [];
  const shortSells: ShortSell[] = [];

  for (const trade of [...trades].sort(compareTrades)) {
    const position = bySymbol.get(trade.symbol) ?? emptyPosition(trade.symbol);
    bySymbol.set(trade.symbol, position);

    const grossValue = trade.quantity.mul(trade.priceUsd);

    if (trade.side === "SELL" && trade.quantity.gt(position.quantity)) {
      shortSells.push({ trade, available: position.quantity });
      continue;
    }

    position.tradeCount += 1;
    position.feesPaid = position.feesPaid.add(trade.feeUsd);

    if (trade.side === "BUY") {
      const costAdded = grossValue.add(trade.feeUsd);
      position.quantity = position.quantity.add(trade.quantity);
      position.costBasis = position.costBasis.add(costAdded);
      position.averageCost = position.costBasis.div(position.quantity);
      entries.push({ trade, grossValue, costChange: costAdded, netProceeds: null, realizedPnl: null, ...after(position) });
    } else {
      const closesPosition = trade.quantity.eq(position.quantity);
      const costRemoved = closesPosition ? position.costBasis : position.averageCost.mul(trade.quantity);
      const netProceeds = grossValue.sub(trade.feeUsd);
      const realizedPnl = netProceeds.sub(costRemoved);

      position.realizedPnl = position.realizedPnl.add(realizedPnl);
      if (closesPosition) {
        position.quantity = ZERO;
        position.costBasis = ZERO;
        position.averageCost = ZERO;
      } else {
        position.quantity = position.quantity.sub(trade.quantity);
        position.costBasis = position.costBasis.sub(costRemoved);
      }
      entries.push({ trade, grossValue, costChange: costRemoved, netProceeds, realizedPnl, ...after(position) });
    }
  }

  return { positions: [...bySymbol.values()], entries, shortSells };
}

function after(p: Position) {
  return { quantityAfter: p.quantity, costBasisAfter: p.costBasis, averageCostAfter: p.averageCost };
}
