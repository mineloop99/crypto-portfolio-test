import { Dec } from "@/domain/decimal";
import type { AssetSymbol, Exchange, Side, Trade } from "@/domain/model";
import { TRADE_COLUMNS } from "@/domain/csv/parse-trades";

let sequence = 0;

/** Builds a Trade for engine tests. Timestamps default to one hour apart in call order. */
export function trade(
  side: Side,
  quantity: string,
  price: string,
  fee = "0",
  opts: { symbol?: AssetSymbol; exchange?: Exchange; timestamp?: string; id?: string } = {},
): Trade {
  sequence += 1;
  const timestamp = opts.timestamp ?? new Date(Date.UTC(2025, 9, 1) + sequence * 3_600_000).toISOString();
  return {
    tradeId: opts.id ?? `T-${String(sequence).padStart(4, "0")}`,
    timestamp,
    time: Date.parse(timestamp),
    exchange: opts.exchange ?? "Binance",
    symbol: opts.symbol ?? "BTC",
    side,
    quantity: new Dec(quantity),
    priceUsd: new Dec(price),
    feeUsd: new Dec(fee),
    line: sequence + 1,
  };
}

export const HEADER = TRADE_COLUMNS.join(",");

/** Joins CSV lines with a trailing newline, header first. */
export function csv(...rows: string[]): string {
  return [HEADER, ...rows].join("\n") + "\n";
}

/** Canonical string form of a Decimal (no trailing zeros), so tests can compare exact values. */
export function dec(value: Dec | null | undefined): string {
  if (value === null || value === undefined) return String(value);
  return value.toString();
}
