import { parseDecimal } from "../decimal";
import { ASSET_SYMBOLS, issue, type AssetSymbol, type Price, type Result, type ValidationIssue } from "../model";
import { parseUtcTimestamp, readCsv } from "./read-csv";

export const PRICE_COLUMNS = ["as_of", "symbol", "price_usd"] as const;

/** Validates prices.csv. A symbol may be absent (the UI then shows its price as unavailable) but not repeated. */
export function parsePricesCsv(text: string): Result<Price[]> {
  const table = readCsv(text, PRICE_COLUMNS);
  if (!table.ok) return table;

  const issues: ValidationIssue[] = [];
  const prices: Price[] = [];
  const seen = new Set<string>();

  for (const row of table.rows) {
    const { line } = row;
    const before = issues.length;
    const asOf = row.get("as_of");
    const symbol = row.get("symbol");
    const time = parseUtcTimestamp(asOf);
    const priceUsd = parseDecimal(row.get("price_usd"));

    if (time === null) issues.push(issue(`Invalid as_of timestamp "${asOf}".`, { line, column: "as_of" }));
    if (!(ASSET_SYMBOLS as readonly string[]).includes(symbol)) {
      issues.push(issue(`Unsupported symbol "${symbol}".`, { line, column: "symbol" }));
    } else if (seen.has(symbol)) {
      issues.push(issue(`Duplicate price for ${symbol}.`, { line, column: "symbol" }));
    }
    seen.add(symbol);
    if (priceUsd === null || priceUsd.lte(0)) {
      issues.push(issue(`price_usd must be a number greater than zero (got "${row.get("price_usd")}").`, { line, column: "price_usd" }));
    }

    if (issues.length === before) prices.push({ symbol: symbol as AssetSymbol, priceUsd: priceUsd!, asOf, time: time! });
  }

  return issues.length > 0 ? { ok: false, issues } : { ok: true, value: prices };
}
