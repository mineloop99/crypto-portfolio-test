import { describe, expect, it } from "vitest";
import { parsePricesCsv } from "@/domain/csv/parse-prices";
import { parseTradesCsv } from "@/domain/csv/parse-trades";
import { importPortfolio } from "@/domain/portfolio/import-portfolio";
import { csv, dec, HEADER } from "../helpers";

const ok = (id: string, rest = "2025-10-01T09:00:00Z,Binance,BTC,BUY,1,100,1") => `${id},${rest}`;

function issuesOf(text: string) {
  const result = parseTradesCsv(text);
  if (result.ok) throw new Error("expected the file to be rejected");
  return result.issues;
}

describe("trades.csv validation", () => {
  it("accepts a valid file and parses decimals exactly", () => {
    const result = parseTradesCsv(csv("TRD-1,2025-10-01T09:00:00Z,Binance,CKB,BUY,464558,0.00723980,3.36"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]).toMatchObject({ tradeId: "TRD-1", exchange: "Binance", symbol: "CKB", side: "BUY", line: 2 });
    expect(dec(result.value[0].priceUsd)).toBe("0.0072398");
  });

  it("accepts a BOM, CRLF line endings, blank lines, reordered and extra columns", () => {
    const text =
      "﻿fee_usd,side,symbol,exchange,timestamp,trade_id,quantity,price_usd,note\r\n" +
      "1,BUY,BTC,Coinbase,2025-10-01T09:00:00Z,T1,1,100,hello\r\n\r\n";
    const result = parseTradesCsv(text);
    expect(result.ok).toBe(true);
  });

  it("rejects a file with missing required columns and names them", () => {
    const issues = issuesOf("trade_id,timestamp,exchange,symbol,side,quantity\nT1,2025-10-01T09:00:00Z,Binance,BTC,BUY,1\n");
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("price_usd, fee_usd");
    expect(issues[0].line).toBe(1);
  });

  it("rejects duplicate trade_id values and points to the first occurrence", () => {
    const issues = issuesOf(csv(ok("T1"), ok("T2"), ok("T1")));
    expect(issues).toEqual([
      { line: 4, column: "trade_id", tradeId: "T1", message: 'Duplicate trade_id "T1" (first seen on line 2).' },
    ]);
  });

  it.each([
    ["2025-10-01 09:00:00", "not ISO-8601"],
    ["2025-02-30T09:00:00Z", "date does not exist"],
    ["2025-10-01T25:00:00Z", "hour out of range"],
    ["2025-10-01T09:00:00+07:00", "not UTC"],
    ["", "empty"],
  ])("rejects timestamp %j (%s)", (timestamp) => {
    const issues = issuesOf(csv(`T1,${timestamp},Binance,BTC,BUY,1,100,1`));
    expect(issues[0].column).toBe("timestamp");
  });

  it("rejects unsupported exchange, symbol and side values, reporting all of them", () => {
    const issues = issuesOf(csv("T1,2025-10-01T09:00:00Z,Kraken,XRP,buy,1,100,1"));
    expect(issues.map((i) => i.column)).toEqual(["exchange", "symbol", "side"]);
    expect(issues[2].message).toBe('Unsupported side "buy". Allowed: BUY, SELL.');
  });

  it.each([
    ["quantity", "0", "0,100,1"],
    ["quantity", "-1", "-1,100,1"],
    ["price_usd", "0", "1,0,1"],
    ["price_usd", "abc", "1,abc,1"],
    ["price_usd", "1e3", "1,1e3,1"],
    ["fee_usd", "-0.01", "1,100,-0.01"],
    ["fee_usd", "", "1,100,"],
  ])("rejects %s = %j", (column, _value, numbers) => {
    const issues = issuesOf(csv(`T1,2025-10-01T09:00:00Z,Binance,BTC,BUY,${numbers}`));
    expect(issues).toHaveLength(1);
    expect(issues[0].column).toBe(column);
  });

  it("accepts a zero fee", () => {
    expect(parseTradesCsv(csv(ok("T1", "2025-10-01T09:00:00Z,Binance,BTC,BUY,1,100,0"))).ok).toBe(true);
  });

  it("rejects rows with the wrong number of fields", () => {
    const issues = issuesOf(csv(ok("T1"), "T2,2025-10-01T09:00:00Z,Binance,BTC,BUY,1,100"));
    expect(issues).toEqual([{ line: 3, column: null, tradeId: null, message: "Expected 8 fields but found 7." }]);
  });

  it("rejects empty and header-only files", () => {
    expect(issuesOf("")[0].message).toBe("The file is empty.");
    expect(issuesOf(HEADER + "\n")[0].message).toBe("The file has a header but no data rows.");
  });

  it("collects issues from every row with their line numbers", () => {
    const issues = issuesOf(csv(ok("T1"), "T2,bad,Binance,BTC,BUY,1,100,1", ok("T3"), "T4,2025-10-01T09:00:00Z,Binance,BTC,BUY,0,100,1"));
    expect(issues.map((i) => [i.line, i.column])).toEqual([
      [3, "timestamp"],
      [5, "quantity"],
    ]);
  });
});

describe("import boundary", () => {
  const prices = parsePricesCsv("as_of,symbol,price_usd\n2026-03-31T23:59:59Z,BTC,150\n");
  if (!prices.ok) throw new Error("fixture prices must be valid");

  it("rejects a SELL that would create a short position and imports nothing", () => {
    const result = importPortfolio(
      csv(
        "T1,2025-10-01T09:00:00Z,Binance,BTC,BUY,1,100,1",
        "T2,2025-10-02T09:00:00Z,Coinbase,BTC,SELL,0.4,120,1",
        "T3,2025-10-03T09:00:00Z,Coinbase,BTC,SELL,0.7,120,1",
      ),
      prices.value,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({ line: 4, tradeId: "T3", column: "quantity" });
    expect(result.issues[0].message).toContain("exceeds the 0.6 BTC held");
  });

  it("checks shorts against timestamp order, not file order", () => {
    // The SELL is listed first but happens after the BUY, so the file is valid.
    const result = importPortfolio(
      csv("T2,2025-10-02T09:00:00Z,Binance,BTC,SELL,1,120,0", "T1,2025-10-01T09:00:00Z,Binance,BTC,BUY,1,100,0"),
      prices.value,
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(dec(result.value.totals.realizedPnl)).toBe("20");
  });

  it("returns a complete portfolio for a valid file", () => {
    const result = importPortfolio(csv("T1,2025-10-01T09:00:00Z,Binance,BTC,BUY,2,100,2"), prices.value);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // cost 202, value 2 × 150 = 300, unrealized 98
    expect(dec(result.value.totals.unrealizedPnl)).toBe("98");
    expect(result.value.trades).toHaveLength(1);
    expect(result.value.ledger.entries).toHaveLength(1);
  });
});

describe("prices.csv validation", () => {
  it("rejects duplicate symbols and non-positive prices", () => {
    const result = parsePricesCsv(
      "as_of,symbol,price_usd\n2026-03-31T23:59:59Z,BTC,1\n2026-03-31T23:59:59Z,BTC,2\n2026-03-31T23:59:59Z,ETH,0\n",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map((i) => i.line)).toEqual([3, 4]);
  });
});
