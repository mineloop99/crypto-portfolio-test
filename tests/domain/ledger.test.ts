import { describe, expect, it } from "vitest";
import { buildLedger } from "@/domain/portfolio/ledger";
import { dec, trade } from "../helpers";

// Every expected number below is worked out by hand in the comment next to it.

describe("weighted-average cost ledger", () => {
  it("averages multiple BUYs at different prices", () => {
    // 1 @ 100 + 3 @ 200 → quantity 4, cost 700, average 700 / 4 = 175
    const { positions } = buildLedger([trade("BUY", "1", "100"), trade("BUY", "3", "200")]);
    expect(dec(positions[0].quantity)).toBe("4");
    expect(dec(positions[0].costBasis)).toBe("700");
    expect(dec(positions[0].averageCost)).toBe("175");
  });

  it("capitalises BUY fees into cost basis and average cost", () => {
    // 2 @ 100 + fee 2 → cost 202, average 101
    // 2 @ 110 + fee 2 → cost 202 + 222 = 424, quantity 4, average 106
    const { positions, entries } = buildLedger([trade("BUY", "2", "100", "2"), trade("BUY", "2", "110", "2")]);
    expect(dec(entries[0].averageCostAfter)).toBe("101");
    expect(dec(entries[1].costChange)).toBe("222");
    expect(dec(positions[0].costBasis)).toBe("424");
    expect(dec(positions[0].averageCost)).toBe("106");
    expect(dec(positions[0].feesPaid)).toBe("4");
  });

  it("handles a partial SELL without changing the average cost", () => {
    // position: 4 @ avg 106, cost 424
    // SELL 1 @ 130, fee 1 → gross 130, net 129, cost removed 106, realized 129 − 106 = 23
    // remaining: quantity 3, cost 318, average still 106
    const { positions, entries } = buildLedger([
      trade("BUY", "2", "100", "2"),
      trade("BUY", "2", "110", "2"),
      trade("SELL", "1", "130", "1"),
    ]);
    const sell = entries[2];
    expect(dec(sell.grossValue)).toBe("130");
    expect(dec(sell.costChange)).toBe("106");
    expect(dec(sell.realizedPnl)).toBe("23");
    expect(dec(positions[0].quantity)).toBe("3");
    expect(dec(positions[0].costBasis)).toBe("318");
    expect(dec(positions[0].averageCost)).toBe("106");
  });

  it("deducts SELL fees from proceeds", () => {
    // BUY 1 @ 100 (cost 100). SELL 1 @ 150 with fee 5 → net 145, realized 45 (not 50)
    const { entries, positions } = buildLedger([trade("BUY", "1", "100"), trade("SELL", "1", "150", "5")]);
    expect(dec(entries[1].netProceeds)).toBe("145");
    expect(dec(entries[1].realizedPnl)).toBe("45");
    expect(dec(positions[0].realizedPnl)).toBe("45");
    expect(dec(positions[0].feesPaid)).toBe("5");
  });

  it("resets a fully closed position so a later BUY starts from zero", () => {
    // BUY 4 @ 100 → cost 400, avg 100. SELL 4 @ 90, fee 0.5 → net 359.5, realized −40.5, position flat.
    // BUY 1 @ 50, fee 0.5 → cost 50.5, avg 50.5 (the old average must not leak into the new position).
    const { entries, positions } = buildLedger([
      trade("BUY", "4", "100"),
      trade("SELL", "4", "90", "0.5"),
      trade("BUY", "1", "50", "0.5"),
    ]);
    expect(dec(entries[1].realizedPnl)).toBe("-40.5");
    expect(dec(entries[1].quantityAfter)).toBe("0");
    expect(dec(entries[1].costBasisAfter)).toBe("0");
    expect(dec(entries[1].averageCostAfter)).toBe("0");
    expect(dec(positions[0].quantity)).toBe("1");
    expect(dec(positions[0].costBasis)).toBe("50.5");
    expect(dec(positions[0].averageCost)).toBe("50.5");
    expect(dec(positions[0].realizedPnl)).toBe("-40.5");
  });

  it("closes to exactly zero when the average cost is a repeating decimal", () => {
    // BUY 3 @ 1, fee 0.1 → cost 3.1, avg 1.0333…
    // SELL 1 @ 2 → cost removed 1.0333…, realized 0.9666…; SELL 2 @ 2 closes → removes the remaining 2.0666…
    // total realized = (2 + 4) − 3.1 = 2.9 exactly, with no leftover cost basis
    const { positions } = buildLedger([trade("BUY", "3", "1", "0.1"), trade("SELL", "1", "2"), trade("SELL", "2", "2")]);
    expect(dec(positions[0].quantity)).toBe("0");
    expect(dec(positions[0].costBasis)).toBe("0");
    expect(dec(positions[0].realizedPnl)).toBe("2.9");
  });

  it("closes quantities that binary floating point cannot represent", () => {
    // 0.1 + 0.2 = 0.30000000000000004 in IEEE-754; the decimal engine must see exactly 0.3 and close the position
    const { positions, shortSells } = buildLedger([
      trade("BUY", "0.1", "10"),
      trade("BUY", "0.2", "10"),
      trade("SELL", "0.3", "10"),
    ]);
    expect(shortSells).toHaveLength(0);
    expect(dec(positions[0].quantity)).toBe("0");
    expect(dec(positions[0].costBasis)).toBe("0");
  });

  it("flags a SELL that would create a short position and does not apply it", () => {
    const { shortSells, positions } = buildLedger([trade("BUY", "1", "100"), trade("SELL", "1.5", "120")]);
    expect(shortSells).toHaveLength(1);
    expect(dec(shortSells[0].available)).toBe("1");
    expect(dec(positions[0].quantity)).toBe("1");
    expect(dec(positions[0].realizedPnl)).toBe("0");
  });

  it("processes trades in timestamp order regardless of input order, ties broken by trade_id", () => {
    const buy = trade("BUY", "1", "100", "0", { timestamp: "2025-10-01T00:00:00.000Z", id: "B" });
    const sell = trade("SELL", "1", "120", "0", { timestamp: "2025-10-02T00:00:00.000Z", id: "A" });
    const tieA = trade("BUY", "1", "10", "0", { symbol: "ETH", timestamp: "2025-10-03T00:00:00.000Z", id: "X-2" });
    const tieB = trade("SELL", "1", "12", "0", { symbol: "ETH", timestamp: "2025-10-03T00:00:00.000Z", id: "X-1" });
    const { entries, shortSells } = buildLedger([sell, tieA, buy, tieB]);
    expect(entries.map((e) => e.trade.tradeId)).toEqual(["B", "A", "X-2"]);
    // X-1 (SELL) sorts before X-2 (BUY) at the same instant, so it is a short sell
    expect(shortSells.map((s) => s.trade.tradeId)).toEqual(["X-1"]);
  });

  it("keeps positions of different assets independent", () => {
    const { positions } = buildLedger([
      trade("BUY", "1", "100", "0", { symbol: "BTC" }),
      trade("BUY", "10", "5", "1", { symbol: "SOL" }),
      trade("SELL", "1", "110", "0", { symbol: "BTC" }),
    ]);
    const bySymbol = Object.fromEntries(positions.map((p) => [p.symbol, p]));
    expect(dec(bySymbol.BTC.realizedPnl)).toBe("10");
    expect(dec(bySymbol.SOL.averageCost)).toBe("5.1");
  });
});
