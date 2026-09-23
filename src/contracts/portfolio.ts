import { z } from "zod";
import { ASSET_SYMBOLS, EXCHANGES, SIDES } from "@/domain/model";

/**
 * HTTP contract between /api/portfolio and the UI. Every monetary or quantity value travels as a plain decimal
 * string at full precision; the UI rounds only when formatting. The client validates responses against these
 * schemas, so a contract mismatch surfaces as a visible error instead of wrong numbers.
 */
const decimal = z.string().regex(/^-?\d+(\.\d+)?$/, "expected a plain decimal string");
const symbol = z.enum(ASSET_SYMBOLS);

export const HoldingSchema = z.object({
  symbol,
  status: z.enum(["open", "closed"]),
  quantity: decimal,
  averageCost: decimal,
  costBasis: decimal,
  currentPrice: decimal.nullable(),
  priceAsOf: z.string().nullable(),
  currentValue: decimal.nullable(),
  realizedPnl: decimal,
  unrealizedPnl: decimal.nullable(),
  totalPnl: decimal.nullable(),
  allocation: decimal.nullable(),
  feesPaid: decimal,
  tradeCount: z.number().int().nonnegative(),
});

export const TotalsSchema = z.object({
  currentValue: decimal,
  costBasis: decimal,
  realizedPnl: decimal,
  unrealizedPnl: decimal,
  totalPnl: decimal,
  feesPaid: decimal,
});

export const TransactionSchema = z.object({
  tradeId: z.string(),
  timestamp: z.string(),
  time: z.number(),
  exchange: z.enum(EXCHANGES),
  symbol,
  side: z.enum(SIDES),
  quantity: decimal,
  priceUsd: decimal,
  feeUsd: decimal,
  grossValue: decimal,
  /** SELL only. */
  realizedPnl: decimal.nullable(),
});

export const PortfolioResponseSchema = z.object({
  source: z.object({
    kind: z.enum(["sample", "import"]),
    fileName: z.string(),
    tradeCount: z.number().int().nonnegative(),
  }),
  pricesAsOf: z.string().nullable(),
  pricesAsOfMixed: z.boolean(),
  missingPrices: z.array(symbol),
  totals: TotalsSchema,
  holdings: z.array(HoldingSchema),
  /** In processing order (ascending timestamp, then trade_id). */
  transactions: z.array(TransactionSchema),
});

export const IssueSchema = z.object({
  line: z.number().int().nullable(),
  column: z.string().nullable(),
  tradeId: z.string().nullable(),
  message: z.string(),
});

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.enum(["invalid_csv", "payload_too_large", "prices_unavailable", "internal_error"]),
    message: z.string(),
    /** At most MAX_REPORTED_ISSUES entries; `issueCount` is the full count. */
    issues: z.array(IssueSchema),
    issueCount: z.number().int().nonnegative(),
    requestId: z.string(),
  }),
});

export type PortfolioResponse = z.infer<typeof PortfolioResponseSchema>;
export type HoldingDto = z.infer<typeof HoldingSchema>;
export type TotalsDto = z.infer<typeof TotalsSchema>;
export type TransactionDto = z.infer<typeof TransactionSchema>;
export type IssueDto = z.infer<typeof IssueSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type ErrorCode = ErrorResponse["error"]["code"];

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const MAX_REPORTED_ISSUES = 200;
