import { describe, expect, it } from "vitest";
import type { TransactionDto } from "@/contracts/portfolio";
import { applyFilter, DEFAULT_FILTER, paginate, summarize } from "@/ui/transactions";

const tx = (tradeId: string, timestamp: string, patch: Partial<TransactionDto> = {}): TransactionDto => ({
  tradeId,
  timestamp,
  time: Date.parse(timestamp),
  exchange: "Binance",
  symbol: "BTC",
  side: "BUY",
  quantity: "1",
  priceUsd: "100",
  feeUsd: "0.1",
  grossValue: "100",
  realizedPnl: null,
  ...patch,
});

// processing order (ascending)
const rows = [
  tx("T1", "2025-10-01T09:00:00Z"),
  tx("T2", "2025-10-02T23:59:59Z", { exchange: "Coinbase", symbol: "ETH", feeUsd: "0.2" }),
  tx("T3", "2025-10-03T00:00:00Z", { side: "SELL", realizedPnl: "-5.5", feeUsd: "0.3", grossValue: "250.25" }),
];

describe("transaction explorer logic", () => {
  it("sorts newest first by default and oldest first on request", () => {
    expect(applyFilter(rows, DEFAULT_FILTER).map((t) => t.tradeId)).toEqual(["T3", "T2", "T1"]);
    expect(applyFilter(rows, { ...DEFAULT_FILTER, sort: "asc" }).map((t) => t.tradeId)).toEqual(["T1", "T2", "T3"]);
  });

  it("filters by asset, exchange and side", () => {
    expect(applyFilter(rows, { ...DEFAULT_FILTER, asset: "ETH" }).map((t) => t.tradeId)).toEqual(["T2"]);
    expect(applyFilter(rows, { ...DEFAULT_FILTER, exchange: "Binance" }).map((t) => t.tradeId)).toEqual(["T3", "T1"]);
    expect(applyFilter(rows, { ...DEFAULT_FILTER, side: "SELL" }).map((t) => t.tradeId)).toEqual(["T3"]);
  });

  it("treats the date range as inclusive whole UTC days", () => {
    const oneDay = { ...DEFAULT_FILTER, from: "2025-10-02", to: "2025-10-02", sort: "asc" as const };
    expect(applyFilter(rows, oneDay).map((t) => t.tradeId)).toEqual(["T2"]); // 23:59:59 is still Oct 2
    expect(applyFilter(rows, { ...DEFAULT_FILTER, from: "2025-10-03" }).map((t) => t.tradeId)).toEqual(["T3"]);
    expect(applyFilter(rows, { ...DEFAULT_FILTER, from: "2025-10-03", to: "2025-10-01" })).toEqual([]);
  });

  it("searches trade ids case-insensitively", () => {
    expect(applyFilter(rows, { ...DEFAULT_FILTER, query: "t2" }).map((t) => t.tradeId)).toEqual(["T2"]);
    expect(applyFilter(rows, { ...DEFAULT_FILTER, query: "eth" }).map((t) => t.tradeId)).toEqual(["T2"]);
  });

  it("sums gross value, fees and realized P&L exactly", () => {
    expect(summarize(rows)).toEqual({ count: 3, grossValue: "450.25", fees: "0.6", realizedPnl: "-5.5" });
  });

  it("paginates and clamps out-of-range pages", () => {
    const many = Array.from({ length: 53 }, (_, i) => i);
    expect(paginate(many, 3, 25)).toMatchObject({ page: 3, pageCount: 3, start: 50, rows: [50, 51, 52] });
    expect(paginate(many, 9, 25).page).toBe(3);
    expect(paginate([], 1, 25)).toMatchObject({ page: 1, pageCount: 1, rows: [] });
  });
});
