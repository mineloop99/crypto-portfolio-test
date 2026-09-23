import type { Dec } from "./decimal";

export const EXCHANGES = ["Binance", "Coinbase"] as const;
export const ASSET_SYMBOLS = ["BTC", "ETH", "SOL", "CKB", "DOGE"] as const;
export const SIDES = ["BUY", "SELL"] as const;

export type Exchange = (typeof EXCHANGES)[number];
export type AssetSymbol = (typeof ASSET_SYMBOLS)[number];
export type Side = (typeof SIDES)[number];

export interface Trade {
  tradeId: string;
  /** UTC ISO-8601 timestamp exactly as supplied. */
  timestamp: string;
  /** Epoch milliseconds, used for ordering and date filtering. */
  time: number;
  exchange: Exchange;
  symbol: AssetSymbol;
  side: Side;
  quantity: Dec;
  priceUsd: Dec;
  feeUsd: Dec;
  /** 1-based line in the source CSV (the header is line 1). */
  line: number;
}

export interface Price {
  symbol: AssetSymbol;
  priceUsd: Dec;
  asOf: string;
  time: number;
}

/** A problem found while importing. Every field except `message` is optional context for the user. */
export interface ValidationIssue {
  line: number | null;
  column: string | null;
  tradeId: string | null;
  message: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; issues: ValidationIssue[] };

export function issue(message: string, context: Partial<Omit<ValidationIssue, "message">> = {}): ValidationIssue {
  return { line: context.line ?? null, column: context.column ?? null, tradeId: context.tradeId ?? null, message };
}
