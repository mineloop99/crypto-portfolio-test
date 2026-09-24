# Crypto Portfolio Analytics

A dashboard that imports a crypto trade history (`trades.csv`) and a price snapshot (`prices.csv`) and shows what is
held, what it cost, what it is worth, and how much profit or loss has been realized and is still unrealized — using
weighted-average cost basis with fees.

**Live app:** <https://crypto-portfolio-test-zeta.vercel.app/> · **AI workflow:** [AI_WORKFLOW.md](AI_WORKFLOW.md)

Reference results for the supplied data (valued at 2026-03-31 23:59:59 UTC):

| Portfolio value | Cost basis | Realized P&L | Unrealized P&L | Total P&L | Total fees |
|---|---|---|---|---|---|
| $60,620.89 | $59,969.24 | −$5,052.96 | +$651.65 | −$4,401.31 | $2,708.86 |

These are cross-checked against an independent Python implementation — see [Testing](#testing).

## Contents

- [Local setup](#local-setup)
- [Using the app and the sample data](#using-the-app-and-the-sample-data)
- [Architecture and data flow](#architecture-and-data-flow)
- [Portfolio calculation](#portfolio-calculation)
- [Precision and rounding](#precision-and-rounding)
- [Import validation](#import-validation)
- [Testing](#testing)
- [Deployment](#deployment)
- [Assumptions, limitations and tradeoffs](#assumptions-limitations-and-tradeoffs)
- [Future improvements](#future-improvements)

## Local setup

Requirements: **Node.js ≥ 20.9** and **pnpm** (10 or 11 — the lockfile installs cleanly with both).
Python 3 is only needed to re-run the reference script.

```bash
pnpm install
pnpm dev            # development server on http://localhost:3000
```

| Command | What it does |
|---|---|
| `pnpm dev` | Development server with hot reload |
| `pnpm test` | Full test suite (Vitest, 68 tests, < 1 s) |
| `pnpm typecheck` | Generates Next.js route types, then `tsc --noEmit` |
| `pnpm lint` | ESLint (Next.js core-web-vitals + TypeScript rules) |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build (`PORT` overrides 3000) |
| `python3 scripts/oracle.py` | Print the reference numbers from the independent implementation |

**Environment variables: none.** The app has no database, no external API, no authentication and no secrets. The
only files it reads are the two CSVs in `data/`, which are bundled with the server.

## Using the app and the sample data

- On load, the app computes the portfolio from the supplied [`data/trades.csv`](data/trades.csv) and
  [`data/prices.csv`](data/prices.csv). The price snapshot time is shown at the top.
- **Import trades.csv** validates and computes an uploaded file on the server. If anything is wrong, every problem is
  listed by line and column and the numbers on screen do not change. If the file is valid, it replaces the sample.
- Imports are **not stored anywhere** — not on the server, not in the browser. **Reset to sample data** or a page
  reload returns to the supplied files.
- Selecting an asset in the holdings table filters the transaction explorer to that asset.
- To try the validation, download any file from [`public/samples/invalid/`](public/samples/invalid/) (served by the
  app at `/samples/invalid/<name>`) and import it:

| File | What is wrong with it |
|---|---|
| `01-duplicate-row.csv` | The real 200 trades with one row pasted twice |
| `02-missing-fee-column.csv` | `fee_usd` column removed |
| `03-excel-semicolon-export.csv` | Semicolon-separated with decimal commas, as some Excel locales export |
| `04-bad-values.csv` | One bad value per row: lower-case enum values, unknown symbol, Feb 29 in 2025, non-ISO date, zero quantity, negative price and fee, decimal comma, `1e3`, empty id, non-UTC offset |
| `05-oversell-by-one-satoshi.csv` | The real trades with one full-close SELL raised by 0.00000001 BTC |
| `06-sell-timestamp-too-early.csv` | The real trades with one SELL dated a month too early, before the buys that fund it |
| `07-wrong-field-count.csv` | A row with a missing field and a row with an extra field |
| `08-empty.csv`, `09-header-only.csv` | No data |
| `10-many-errors.csv` | 250 invalid rows — the response lists the first 200 and reports the full count |

To use different default data, replace the files in `data/` (same columns) and rebuild/redeploy.

## Architecture and data flow

```
 Browser (React client components)                     Server (Next.js route handler, Node runtime)
 ─────────────────────────────────                     ─────────────────────────────────────────────
 usePortfolio ── GET /api/portfolio ───────────────▶  load data/trades.csv + data/prices.csv
              ── POST /api/portfolio (CSV text) ───▶  │
                                                      ▼
                                                      src/domain (pure TypeScript, no I/O)
                                                        readCsv → parseTradesCsv   (row validation)
                                                        buildLedger                (weighted-average cost, short check)
                                                        valuePortfolio             (value, P&L, allocation)
                                                      ▼
 zod-validated JSON ◀──── 200 PortfolioResponse ────  decimals serialised as full-precision strings
                    ◀──── 4xx/5xx ErrorResponse ────  every validation issue, request id
 format.ts rounds for display only
```

| Path | Responsibility |
|---|---|
| [`src/domain/`](src/domain/) | Deterministic calculation and validation. No React, Next.js or file-system imports; fully unit-tested. |
| [`src/contracts/portfolio.ts`](src/contracts/portfolio.ts) | zod schemas for the HTTP contract, shared by server and client. The client validates every response, so a contract mismatch shows as an error instead of wrong numbers. |
| [`src/server/portfolio-service.ts`](src/server/portfolio-service.ts) | Loads the bundled CSVs, runs the domain, maps results to the contract, shapes errors. |
| [`src/app/api/portfolio/route.ts`](src/app/api/portfolio/route.ts) | HTTP boundary: body size limit (2 MB), status codes, request ids, server-side logging of unexpected errors. |
| [`src/ui/`](src/ui/) | Client state (`use-portfolio.ts`), display formatting (`format.ts`), explorer filtering (`transactions.ts`), components. |
| [`scripts/oracle.py`](scripts/oracle.py) | Independent reference implementation used by the golden test. |

API summary:

| Request | Success | Errors |
|---|---|---|
| `GET /api/portfolio` | `200` portfolio for the supplied data | `500` if a bundled file is unreadable or invalid |
| `POST /api/portfolio` (body: raw CSV text, optional `X-File-Name`) | `200` portfolio for the upload | `422 invalid_csv` with every issue (first 200 in the body, full count in `issueCount`), `413 payload_too_large` above 2 MB |

## Portfolio calculation

Weighted-average cost, per asset, pooled across both exchanges ([`ledger.ts`](src/domain/portfolio/ledger.ts),
[`valuation.ts`](src/domain/portfolio/valuation.ts)). Trades are processed in ascending timestamp order; equal
timestamps are ordered by `trade_id` so the result never depends on row order in the file.

```
BUY   cost basis += quantity × price + fee              (the fee is capitalised)
      average cost = cost basis / quantity

SELL  cost removed = average cost × quantity sold
      realized P&L += quantity × price − fee − cost removed   (the fee reduces proceeds)
      the average cost of the remaining position does not change

current value  = quantity × current price
unrealized P&L = current value − cost basis
total P&L      = realized + unrealized
allocation     = asset value / portfolio value
total fees     = all BUY fees + all SELL fees
```

Edge cases:

- **Full close.** When a SELL equals the quantity held, the whole remaining cost basis is removed (identical in exact
  arithmetic) and quantity, cost basis and average cost are set to exactly zero, so a later BUY starts fresh. Every
  asset in the sample closes and reopens twice.
- **Short positions** are rejected: a SELL larger than the quantity held at that point in time makes the whole import
  fail with the line, the quantity sold and the quantity available.
- **Closed assets** stay in the holdings table with their realized P&L, zero value and a "Closed" badge.
- **Missing prices.** An open position without a price shows "n/a" for price, value, unrealized P&L and allocation;
  a banner says which assets are excluded, and value/unrealized totals cover priced assets only. Allocation is then a
  share of the priced value. A closed position needs no price.
- The transaction explorer shows each SELL's realized P&L, so the holdings numbers can be traced back to trades;
  filtering to one asset reconciles fees and realized P&L with that asset's holdings row.

## Precision and rounding

- **Numeric type:** [`decimal.js`](https://mikemcl.github.io/decimal.js/) with 40 significant digits
  ([`decimal.ts`](src/domain/decimal.ts)). The data has at most 8 decimal places on values up to ~2 million, so
  results are exact apart from the division in the average cost, whose rounding error is below 10⁻³⁰.
  Binary floating point was ruled out: for example `0.1 + 0.2` would leave dust after a full close and break the
  zero-reset rule (there is a test for exactly that).
- **Parsing:** only plain decimal strings are accepted (`1e3`, `0x10`, `NaN`, `0,25` are rejected).
- **No rounding** happens in the domain or on the wire: the API sends every value as a full-precision decimal string.
- **Display rounding** ([`format.ts`](src/ui/format.ts)) uses decimal.js `ROUND_HALF_UP`, then `Intl.NumberFormat`
  only for grouping and currency symbols:

| Value | Display |
|---|---|
| USD amounts and P&L | 2 decimals, signed for P&L: `+$651.65`, `-$4,401.31`; a value that rounds to zero is `$0.00` |
| Prices and average cost | 2 decimals at ≥ $1; up to 8 decimals below $1 (`$0.00687336`) |
| Quantities | up to 8 decimals, trailing zeros dropped |
| Percentages | 2 decimals |
| Timestamps | UTC, `2026-03-31 23:59:59 UTC` |

- Totals are summed at full precision and rounded once. Adding up rounded rows can therefore differ from the rounded
  total by a few cents — in the sample, the unrealized rows add up to $651.67 while the exact total is $651.65. The
  UI says so under the holdings table.
- Charts convert values to JavaScript numbers **for geometry only**; chart labels, tooltips and the chart data
  tables use the exact strings.

## Import validation

All rules live in [`src/domain/csv/`](src/domain/csv/). The whole file is checked and every problem is reported;
the file is accepted only if there are none.

- Required columns present (any order; extra columns ignored); no duplicate header names; same field count on every
  row. A semicolon- or tab-separated export gets one explanatory message instead of eight "missing column" errors.
- `trade_id` present and unique (a duplicate points to the first occurrence).
- `timestamp` is UTC ISO-8601 (`Z` or `+00:00`, optional fractional seconds) and a real date.
- `exchange` ∈ {Binance, Coinbase}, `symbol` ∈ {BTC, ETH, SOL, CKB, DOGE}, `side` ∈ {BUY, SELL} — case-sensitive.
- `quantity > 0`, `price_usd > 0`, `fee_usd ≥ 0`.
- No SELL exceeds the quantity held at that point in the timestamp-ordered history. This check runs only once all
  rows are individually valid; it reports every offending SELL.
- A UTF-8 BOM, CRLF line endings, blank lines and surrounding spaces are tolerated. Empty and header-only files are
  rejected.

## Testing

```bash
pnpm test
```

| Suite | What it proves |
|---|---|
| [`tests/domain/ledger.test.ts`](tests/domain/ledger.test.ts) | Every rule in the brief with hand-computed numbers (worked out in comments): multiple BUYs at different prices, BUY fee in average cost, partial SELL, SELL fee deducted, full close then new BUY, short SELL rejected; plus repeating-decimal and `0.1 + 0.2` closes, ordering and tie-breaks |
| [`tests/domain/valuation.test.ts`](tests/domain/valuation.test.ts) | Value, unrealized/total P&L, allocation, missing price, closed asset, mixed snapshot times |
| [`tests/domain/import.test.ts`](tests/domain/import.test.ts) | Invalid and duplicate CSV rows, header problems, field counts, short sells through the import boundary |
| [`tests/domain/golden.test.ts`](tests/domain/golden.test.ts) | The supplied data against [`scripts/oracle.py`](scripts/oracle.py) (Python `decimal`, 50 digits) at 20 decimal places, per asset and in total; two full closes per asset; the method-independent invariant *total P&L = current value + Σ SELL net proceeds − Σ (BUY gross + BUY fee)* |
| [`tests/api/portfolio-route.test.ts`](tests/api/portfolio-route.test.ts) | Route handlers called directly: contract conformance, 422/413 responses, file-name sanitising |
| [`tests/ui/`](tests/ui/) | Exact display strings (rounding, signs, small prices) and explorer filtering/pagination |

The engine tests were checked by deliberately breaking the engine (BUY fee not capitalised, SELL fee ignored, no
full-close reset, average recomputed on SELL): each mutation makes tests fail. See
[AI_WORKFLOW.md](AI_WORKFLOW.md).

## Deployment

Deployed on **Vercel** as a standard Next.js project — no environment variables or build settings needed.
`next.config.ts` lists `data/*.csv` in `outputFileTracingIncludes` so the CSVs are shipped with the serverless
function (verified in the build's `route.js.nft.json`).

**URL:** _TBD_

## Assumptions, limitations and tradeoffs

- **One position per asset across both exchanges**, as the holdings table in the brief asks for. Per-exchange views
  are not offered.
- **Imports are not persisted**, by design: no database or secrets, nothing to leak, and the supplied files stay the
  source of truth. The cost is that an import disappears on reload and is not shared between reviewers.
- **Strict validation rather than normalisation:** `buy`, `binance` or a `+07:00` offset are rejected with a
  message instead of being silently corrected, so the numbers are always computed from exactly what the file says.
- **Only `trades.csv` can be imported**; prices always come from the bundled `prices.csv` snapshot.
- **Filtering happens in the browser.** Fine for this data and for anything under the 2 MB upload limit (~30 000
  rows); larger histories would need server-side pagination.
- Error line numbers assume no field contains a line break (true for this format).
- Light theme only.

## Future improvements

- Import a `prices.csv` alongside trades, and show when prices are stale.
- Optional persistence (per-user storage behind authentication) if imports need to be shared.
- Per-exchange scope and a time series of portfolio value.
- CI on GitHub Actions (types, lint, tests, build, browser end-to-end tests) and AI review on pull requests — see
  "Future plan" in [AI_WORKFLOW.md](AI_WORKFLOW.md#future-plan).
- Dark theme with its own validated chart palette.
