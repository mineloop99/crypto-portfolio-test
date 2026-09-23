import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  MAX_REPORTED_ISSUES,
  type ErrorCode,
  type ErrorResponse,
  type PortfolioResponse,
} from "@/contracts/portfolio";
import type { Dec } from "@/domain/decimal";
import { parsePricesCsv } from "@/domain/csv/parse-prices";
import type { Price, ValidationIssue } from "@/domain/model";
import { importPortfolio, type Portfolio } from "@/domain/portfolio/import-portfolio";

// The supplied files are bundled with the server (see outputFileTracingIncludes in next.config.ts) and never modified.
const DATA_DIR = join(process.cwd(), "data");
export const SAMPLE_TRADES_FILE = "trades.csv";
const PRICES_FILE = "prices.csv";

export class ServiceError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
    message: string,
    readonly issues: ValidationIssue[] = [],
  ) {
    super(message);
  }
}

export async function loadPrices(): Promise<Price[]> {
  const parsed = parsePricesCsv(await readFile(join(DATA_DIR, PRICES_FILE), "utf8"));
  if (!parsed.ok) {
    throw new ServiceError("prices_unavailable", 500, `${PRICES_FILE} on the server is invalid.`, parsed.issues);
  }
  return parsed.value;
}

export async function loadSampleTrades(): Promise<string> {
  return readFile(join(DATA_DIR, SAMPLE_TRADES_FILE), "utf8");
}

/** Validates and computes a portfolio from trades.csv text. Throws ServiceError with every issue on invalid input. */
export function computePortfolio(
  tradesCsv: string,
  prices: readonly Price[],
  source: PortfolioResponse["source"]["kind"],
  fileName: string,
): PortfolioResponse {
  const result = importPortfolio(tradesCsv, prices);
  if (!result.ok) {
    const count = result.issues.length;
    throw new ServiceError(
      "invalid_csv",
      422,
      `${fileName} was not imported: ${count} problem${count === 1 ? "" : "s"} found. Fix them and import the file again.`,
      result.issues,
    );
  }
  return toResponse(result.value, { kind: source, fileName, tradeCount: result.value.trades.length });
}

const str = (d: Dec) => d.toString();
const strOrNull = (d: Dec | null) => (d === null ? null : d.toString());

function toResponse(p: Portfolio, source: PortfolioResponse["source"]): PortfolioResponse {
  return {
    source,
    pricesAsOf: p.pricesAsOf,
    pricesAsOfMixed: p.pricesAsOfMixed,
    missingPrices: p.missingPrices,
    totals: {
      currentValue: str(p.totals.currentValue),
      costBasis: str(p.totals.costBasis),
      realizedPnl: str(p.totals.realizedPnl),
      unrealizedPnl: str(p.totals.unrealizedPnl),
      totalPnl: str(p.totals.totalPnl),
      feesPaid: str(p.totals.feesPaid),
    },
    holdings: p.holdings.map((h) => ({
      symbol: h.symbol,
      status: h.status,
      quantity: str(h.quantity),
      averageCost: str(h.averageCost),
      costBasis: str(h.costBasis),
      currentPrice: strOrNull(h.currentPrice),
      priceAsOf: h.priceAsOf,
      currentValue: strOrNull(h.currentValue),
      realizedPnl: str(h.realizedPnl),
      unrealizedPnl: strOrNull(h.unrealizedPnl),
      totalPnl: strOrNull(h.totalPnl),
      allocation: strOrNull(h.allocation),
      feesPaid: str(h.feesPaid),
      tradeCount: h.tradeCount,
    })),
    transactions: p.ledger.entries.map(({ trade, grossValue, realizedPnl }) => ({
      tradeId: trade.tradeId,
      timestamp: trade.timestamp,
      time: trade.time,
      exchange: trade.exchange,
      symbol: trade.symbol,
      side: trade.side,
      quantity: str(trade.quantity),
      priceUsd: str(trade.priceUsd),
      feeUsd: str(trade.feeUsd),
      grossValue: str(grossValue),
      realizedPnl: strOrNull(realizedPnl),
    })),
  };
}

export function errorBody(error: ServiceError, requestId: string): ErrorResponse {
  return {
    error: {
      code: error.code,
      message: error.message,
      issues: error.issues.slice(0, MAX_REPORTED_ISSUES),
      issueCount: error.issues.length,
      requestId,
    },
  };
}
