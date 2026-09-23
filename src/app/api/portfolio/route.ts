import { MAX_UPLOAD_BYTES } from "@/contracts/portfolio";
import {
  computePortfolio,
  errorBody,
  loadPrices,
  loadSampleTrades,
  SAMPLE_TRADES_FILE,
  ServiceError,
} from "@/server/portfolio-service";

/** GET /api/portfolio — the portfolio computed from the supplied trades.csv and prices.csv. */
export async function GET() {
  return respond(async () => computePortfolio(await loadSampleTrades(), await loadPrices(), "sample", SAMPLE_TRADES_FILE));
}

/**
 * POST /api/portfolio — body is the raw text of a trades.csv file; optional `X-File-Name` header for messages.
 * 200 with the computed portfolio, or 422 with every validation issue. Nothing is stored on the server.
 */
export async function POST(request: Request) {
  return respond(async () => {
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (declared > MAX_UPLOAD_BYTES) throw tooLarge();
    const text = await request.text();
    if (Buffer.byteLength(text, "utf8") > MAX_UPLOAD_BYTES) throw tooLarge();
    return computePortfolio(text, await loadPrices(), "import", fileNameFrom(request));
  });
}

async function respond(compute: () => Promise<unknown>): Promise<Response> {
  const requestId = crypto.randomUUID();
  try {
    return Response.json(await compute(), { headers: { "x-request-id": requestId } });
  } catch (error) {
    const known =
      error instanceof ServiceError
        ? error
        : new ServiceError("internal_error", 500, `Unexpected server error. Reference: ${requestId}.`);
    if (known.status >= 500) console.error(`[api/portfolio] ${requestId}`, error);
    return Response.json(errorBody(known, requestId), { status: known.status, headers: { "x-request-id": requestId } });
  }
}

function tooLarge() {
  return new ServiceError("payload_too_large", 413, `The file is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
}

function fileNameFrom(request: Request): string {
  let raw = request.headers.get("x-file-name") ?? "";
  try {
    raw = decodeURIComponent(raw);
  } catch {
    // keep the raw header; it is sanitised below
  }
  const name = raw.split(/[\\/]/).pop()!.replace(/[^\w.\- ]/g, "").slice(0, 100);
  return name || "Uploaded file";
}
