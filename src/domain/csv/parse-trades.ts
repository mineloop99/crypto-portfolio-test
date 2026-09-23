import { parseDecimal } from "../decimal";
import {
  ASSET_SYMBOLS,
  EXCHANGES,
  issue,
  SIDES,
  type AssetSymbol,
  type Exchange,
  type Result,
  type Side,
  type Trade,
  type ValidationIssue,
} from "../model";
import { parseUtcTimestamp, readCsv } from "./read-csv";

export const TRADE_COLUMNS = [
  "trade_id",
  "timestamp",
  "exchange",
  "symbol",
  "side",
  "quantity",
  "price_usd",
  "fee_usd",
] as const;

function oneOf<T extends string>(allowed: readonly T[], value: string): value is T {
  return (allowed as readonly string[]).includes(value);
}

/**
 * Row-level validation of trades.csv. Collects every problem instead of stopping at the first one, and returns
 * trades only when the whole file is valid. Position-level checks (a SELL larger than the holding) need the
 * ordered history and are done by the ledger — see `importPortfolio`.
 */
export function parseTradesCsv(text: string): Result<Trade[]> {
  const table = readCsv(text, TRADE_COLUMNS);
  if (!table.ok) return table;

  const issues: ValidationIssue[] = [];
  const trades: Trade[] = [];
  const firstLineById = new Map<string, number>();

  for (const row of table.rows) {
    const { line } = row;
    const tradeId = row.get("trade_id");
    const at = (column: string) => ({ line, column, tradeId: tradeId || null });
    const before = issues.length;

    if (tradeId === "") {
      issues.push(issue("trade_id is empty.", at("trade_id")));
    } else if (firstLineById.has(tradeId)) {
      issues.push(issue(`Duplicate trade_id "${tradeId}" (first seen on line ${firstLineById.get(tradeId)}).`, at("trade_id")));
    } else {
      firstLineById.set(tradeId, line);
    }

    const timestamp = row.get("timestamp");
    const time = parseUtcTimestamp(timestamp);
    if (time === null) {
      issues.push(issue(`Invalid timestamp "${timestamp}". Use UTC ISO-8601, e.g. 2025-10-01T09:00:00Z.`, at("timestamp")));
    }

    const exchange = row.get("exchange");
    if (!oneOf(EXCHANGES, exchange)) {
      issues.push(issue(`Unsupported exchange "${exchange}". Allowed: ${EXCHANGES.join(", ")}.`, at("exchange")));
    }
    const symbol = row.get("symbol");
    if (!oneOf(ASSET_SYMBOLS, symbol)) {
      issues.push(issue(`Unsupported symbol "${symbol}". Allowed: ${ASSET_SYMBOLS.join(", ")}.`, at("symbol")));
    }
    const side = row.get("side");
    if (!oneOf(SIDES, side)) {
      issues.push(issue(`Unsupported side "${side}". Allowed: ${SIDES.join(", ")}.`, at("side")));
    }

    const quantity = parseDecimal(row.get("quantity"));
    if (quantity === null) {
      issues.push(issue(`quantity "${row.get("quantity")}" is not a plain decimal number.`, at("quantity")));
    } else if (quantity.lte(0)) {
      issues.push(issue(`quantity must be greater than zero (got ${row.get("quantity")}).`, at("quantity")));
    }
    const priceUsd = parseDecimal(row.get("price_usd"));
    if (priceUsd === null) {
      issues.push(issue(`price_usd "${row.get("price_usd")}" is not a plain decimal number.`, at("price_usd")));
    } else if (priceUsd.lte(0)) {
      issues.push(issue(`price_usd must be greater than zero (got ${row.get("price_usd")}).`, at("price_usd")));
    }
    const feeUsd = parseDecimal(row.get("fee_usd"));
    if (feeUsd === null) {
      issues.push(issue(`fee_usd "${row.get("fee_usd")}" is not a plain decimal number.`, at("fee_usd")));
    } else if (feeUsd.lt(0)) {
      issues.push(issue(`fee_usd must be zero or greater (got ${row.get("fee_usd")}).`, at("fee_usd")));
    }

    if (issues.length === before) {
      trades.push({
        tradeId,
        timestamp,
        time: time!,
        exchange: exchange as Exchange,
        symbol: symbol as AssetSymbol,
        side: side as Side,
        quantity: quantity!,
        priceUsd: priceUsd!,
        feeUsd: feeUsd!,
        line,
      });
    }
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: trades };
}
