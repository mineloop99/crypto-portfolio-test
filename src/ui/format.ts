import { Dec } from "@/domain/decimal";

/**
 * Display-only formatting. Values arrive as full-precision decimal strings; they are rounded here with
 * decimal.js (ROUND_HALF_UP) and only then handed to Intl for grouping and currency symbols, so the browser's
 * binary floating point never touches a displayed number.
 *
 *   USD amounts      2 dp                          $1,234.57
 *   prices / avg     2 dp at ≥ $1, else up to 8 dp $111,500.00 · $0.00687336
 *   quantities       up to 8 dp, trailing zeros dropped
 *   percentages      2 dp
 */

type Numeric = Intl.StringNumericLiteral;

function round(value: string, dp: number): Numeric {
  const rounded = new Dec(value).toDecimalPlaces(dp);
  // "-0.00" would render as "-$0.00"; a value that rounds to zero is shown unsigned
  return (rounded.isZero() ? "0" : rounded.toFixed(dp)) as Numeric;
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const signedUsd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", signDisplay: "exceptZero" });
const smallUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 8,
});
const quantity = new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 });
const percent = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatUsd(value: string): string {
  return usd.format(round(value, 2));
}

/** "+$1,234.57", "-$463.75", "$0.00" */
export function formatSignedUsd(value: string): string {
  return signedUsd.format(round(value, 2));
}

/** Unit prices and average costs: sub-dollar assets (CKB, DOGE) need more than 2 decimals to be meaningful. */
export function formatPrice(value: string): string {
  return new Dec(value).abs().gte(1) ? usd.format(round(value, 2)) : smallUsd.format(round(value, 8));
}

export function formatQuantity(value: string): string {
  return quantity.format(round(value, 8));
}

/** A 0–1 fraction as a percentage: "0.1424155…" → "14.24%". */
export function formatFraction(value: string): string {
  return `${percent.format(round(new Dec(value).mul(100).toString(), 2))}%`;
}

export type Direction = "positive" | "negative" | "zero";

/** Direction as displayed: anything that rounds to $0.00 counts as zero, so sign and text never disagree. */
export function direction(value: string): Direction {
  const rounded = new Dec(value).toDecimalPlaces(2);
  return rounded.isZero() ? "zero" : rounded.isNegative() ? "negative" : "positive";
}

/** "2026-03-31T23:59:59Z" → "2026-03-31 23:59:59 UTC". Always UTC, matching the data. */
export function formatUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const s = d.toISOString();
  return `${s.slice(0, 10)} ${s.slice(11, 19)} UTC`;
}

const compact = { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 } as const;
const axisUsd = new Intl.NumberFormat("en-US", compact);
const signedAxisUsd = new Intl.NumberFormat("en-US", { ...compact, signDisplay: "exceptZero" });

/** Axis ticks only — approximate by design; exact values are in tooltips and tables. */
export function formatAxisUsd(value: number): string {
  return axisUsd.format(value);
}

/** Axis ticks for gain/loss scales: "+$1.5K", "-$3K". */
export function formatSignedAxisUsd(value: number): string {
  return signedAxisUsd.format(value);
}
