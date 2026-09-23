import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/portfolio/route";
import { ErrorResponseSchema, MAX_UPLOAD_BYTES, PortfolioResponseSchema } from "@/contracts/portfolio";
import { csv } from "../helpers";

const post = (body: string, fileName = "my-trades.csv") =>
  POST(new Request("http://test/api/portfolio", { method: "POST", body, headers: { "x-file-name": fileName } }));

describe("GET /api/portfolio", () => {
  it("returns the sample portfolio in the documented contract", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    const body = PortfolioResponseSchema.parse(await response.json());
    expect(body.source).toEqual({ kind: "sample", fileName: "trades.csv", tradeCount: 200 });
    expect(body.transactions).toHaveLength(200);
    expect(body.holdings.map((h) => h.symbol)).toEqual(["BTC", "ETH", "SOL", "CKB", "DOGE"]);
    // full precision on the wire; rounding is the UI's job
    expect(body.totals.totalPnl.startsWith("-4401.3084972465")).toBe(true);
    expect(body.totals.feesPaid).toBe("2708.86");
  });
});

describe("POST /api/portfolio", () => {
  it("computes an uploaded file", async () => {
    const response = await post(csv("T1,2025-10-01T09:00:00Z,Binance,BTC,BUY,1,100000,10"));
    expect(response.status).toBe(200);
    const body = PortfolioResponseSchema.parse(await response.json());
    expect(body.source).toEqual({ kind: "import", fileName: "my-trades.csv", tradeCount: 1 });
    // BTC price in data/prices.csv is 111500 → value 111500 − cost 100010 = 11490
    expect(body.totals.unrealizedPnl).toBe("11490");
  });

  it("rejects an invalid file with 422 and row-level issues", async () => {
    const response = await post(
      csv("T1,2025-10-01T09:00:00Z,Binance,BTC,BUY,1,100,1", "T1,2025-10-02T09:00:00Z,Binance,BTC,SELL,1,100,1"),
    );
    expect(response.status).toBe(422);
    const { error } = ErrorResponseSchema.parse(await response.json());
    expect(error.code).toBe("invalid_csv");
    expect(error.issueCount).toBe(1);
    expect(error.issues[0]).toMatchObject({ line: 3, column: "trade_id" });
    expect(error.message).toContain("my-trades.csv was not imported");
  });

  it("rejects a file that would create a short position", async () => {
    const response = await post(csv("T1,2025-10-01T09:00:00Z,Binance,BTC,SELL,1,100,1"));
    expect(response.status).toBe(422);
    const { error } = ErrorResponseSchema.parse(await response.json());
    expect(error.issues[0].message).toContain("short positions are not allowed");
  });

  it("rejects oversized uploads with 413", async () => {
    const response = await post("x".repeat(MAX_UPLOAD_BYTES + 1));
    expect(response.status).toBe(413);
    expect(ErrorResponseSchema.parse(await response.json()).error.code).toBe("payload_too_large");
  });

  it("sanitises the file name used in messages", async () => {
    const response = await post("", "..%2F..%2Fetc%2F<script>.csv");
    const { error } = ErrorResponseSchema.parse(await response.json());
    expect(error.message.startsWith("script.csv was not imported")).toBe(true);
  });
});
