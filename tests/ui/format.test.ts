import { describe, expect, it } from "vitest";
import {
  direction,
  formatFraction,
  formatPrice,
  formatQuantity,
  formatSignedUsd,
  formatUsd,
  formatUtc,
} from "@/ui/format";

describe("display formatting", () => {
  it("rounds USD half-up at 2 dp from the exact decimal string", () => {
    expect(formatUsd("60620.89161")).toBe("$60,620.89");
    expect(formatUsd("2708.86")).toBe("$2,708.86");
    expect(formatUsd("0.125")).toBe("$0.13"); // half-up, not banker's rounding
    expect(formatUsd("1.005")).toBe("$1.01"); // a binary float would give $1.00
  });

  it("signs P&L and never shows a negative zero", () => {
    expect(formatSignedUsd("651.654190698966")).toBe("+$651.65");
    expect(formatSignedUsd("-4401.3084972465")).toBe("-$4,401.31");
    expect(formatSignedUsd("-0.004")).toBe("$0.00");
    expect(direction("-0.004")).toBe("zero");
    expect(direction("-0.005")).toBe("negative");
    expect(direction("12")).toBe("positive");
  });

  it("gives sub-dollar prices enough precision", () => {
    expect(formatPrice("111500.00")).toBe("$111,500.00");
    expect(formatPrice("0.00715000")).toBe("$0.00715");
    expect(formatPrice("0.0068733621965341694614567541916144530380905672169208")).toBe("$0.00687336");
    expect(formatPrice("0.242")).toBe("$0.242");
  });

  it("formats quantities without float artefacts", () => {
    expect(formatQuantity("0.07742920")).toBe("0.0774292");
    expect(formatQuantity("1947047")).toBe("1,947,047");
    expect(formatQuantity("63970.78")).toBe("63,970.78");
  });

  it("formats allocation fractions as percentages", () => {
    expect(formatFraction("0.14241551997522657354")).toBe("14.24%");
    expect(formatFraction("1")).toBe("100.00%");
  });

  it("formats timestamps in UTC", () => {
    expect(formatUtc("2026-03-31T23:59:59Z")).toBe("2026-03-31 23:59:59 UTC");
  });
});
