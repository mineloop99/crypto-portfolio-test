import type { TransactionDto } from "@/contracts/portfolio";
import { Dec, ZERO } from "@/domain/decimal";
import type { AssetSymbol, Exchange, Side } from "@/domain/model";

export interface TransactionFilter {
  /** Case-insensitive match on trade_id or symbol. */
  query: string;
  asset: AssetSymbol | "all";
  exchange: Exchange | "all";
  side: Side | "all";
  /** Inclusive UTC calendar dates, "YYYY-MM-DD" or "" for open-ended. */
  from: string;
  to: string;
  sort: "asc" | "desc";
}

export const DEFAULT_FILTER: TransactionFilter = {
  query: "",
  asset: "all",
  exchange: "all",
  side: "all",
  from: "",
  to: "",
  sort: "desc",
};

const DAY_MS = 86_400_000;
const utcDay = (date: string) => (date ? Date.parse(`${date}T00:00:00Z`) : NaN);

export function dateRangeError(filter: TransactionFilter): string | null {
  if (filter.from && filter.to && utcDay(filter.from) > utcDay(filter.to)) return "The start date is after the end date.";
  return null;
}

/** Filters and sorts transactions; ties on timestamp keep processing order (trade_id). */
export function applyFilter(transactions: readonly TransactionDto[], filter: TransactionFilter): TransactionDto[] {
  if (dateRangeError(filter)) return [];
  const query = filter.query.trim().toLowerCase();
  const from = utcDay(filter.from);
  const toExclusive = utcDay(filter.to) + DAY_MS;

  const rows = transactions.filter(
    (t) =>
      (filter.asset === "all" || t.symbol === filter.asset) &&
      (filter.exchange === "all" || t.exchange === filter.exchange) &&
      (filter.side === "all" || t.side === filter.side) &&
      (Number.isNaN(from) || t.time >= from) &&
      (Number.isNaN(toExclusive) || t.time < toExclusive) &&
      (query === "" || t.tradeId.toLowerCase().includes(query) || t.symbol.toLowerCase() === query),
  );
  return filter.sort === "asc" ? rows : rows.reverse();
}

export interface TransactionSummary {
  count: number;
  grossValue: string;
  fees: string;
  realizedPnl: string;
}

export function summarize(rows: readonly TransactionDto[]): TransactionSummary {
  let gross = ZERO;
  let fees = ZERO;
  let realized = ZERO;
  for (const t of rows) {
    gross = gross.add(new Dec(t.grossValue));
    fees = fees.add(new Dec(t.feeUsd));
    if (t.realizedPnl !== null) realized = realized.add(new Dec(t.realizedPnl));
  }
  return { count: rows.length, grossValue: gross.toString(), fees: fees.toString(), realizedPnl: realized.toString() };
}

export function paginate<T>(rows: readonly T[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  const start = (current - 1) * pageSize;
  return { page: current, pageCount, start, rows: rows.slice(start, start + pageSize) };
}
