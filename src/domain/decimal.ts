import Decimal from "decimal.js";

/**
 * Decimal constructor used for every quantity, price and money value.
 *
 * 40 significant digits keeps the engine exact for this data (at most 8 decimal places on values up to
 * a few million), so intermediate rounding is negligible. Values are never rounded here — rounding happens
 * only when formatting for display. Exponent notation is disabled so `toString()` is always plain.
 */
export const Dec = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -100,
  toExpPos: 100,
});
export type Dec = Decimal;

export const ZERO: Dec = new Dec(0);

const PLAIN_DECIMAL = /^-?\d+(\.\d+)?$/;

/**
 * Parses a plain decimal string such as "0.03141403" or "-2".
 * Rejects exponents, hex, "Infinity", "NaN" and empty strings, which `new Decimal()` would otherwise accept.
 */
export function parseDecimal(raw: string): Dec | null {
  return PLAIN_DECIMAL.test(raw) ? new Dec(raw) : null;
}
