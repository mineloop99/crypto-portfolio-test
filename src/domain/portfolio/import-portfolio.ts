import { parseTradesCsv } from "../csv/parse-trades";
import { issue, type Price, type Result, type Trade } from "../model";
import { buildLedger, type Ledger } from "./ledger";
import { valuePortfolio, type Valuation } from "./valuation";

export interface Portfolio extends Valuation {
  trades: Trade[];
  ledger: Ledger;
}

/**
 * The import boundary: CSV text in, a fully computed portfolio or a list of issues out — never a partial result.
 * Row-level problems are reported first; the short-position check runs only on a file whose rows are all valid,
 * because it depends on the complete ordered history.
 */
export function importPortfolio(tradesCsv: string, prices: readonly Price[]): Result<Portfolio> {
  const parsed = parseTradesCsv(tradesCsv);
  if (!parsed.ok) return parsed;

  const ledger = buildLedger(parsed.value);
  if (ledger.shortSells.length > 0) {
    return {
      ok: false,
      issues: ledger.shortSells.map(({ trade, available }) =>
        issue(
          `SELL of ${trade.quantity.toString()} ${trade.symbol} at ${trade.timestamp} exceeds the ` +
            `${available.toString()} ${trade.symbol} held at that point (short positions are not allowed).`,
          { line: trade.line, column: "quantity", tradeId: trade.tradeId },
        ),
      ),
    };
  }

  return { ok: true, value: { ...valuePortfolio(ledger.positions, prices), trades: parsed.value, ledger } };
}
