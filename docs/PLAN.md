# Implementation Plan — AI-Assisted Crypto Portfolio Analytics

Spec: the assessment brief (kept locally in `docs/spec/`, not committed — it is not ours to publish). Deadline: **Fri 2026-09-25 16:00 (UTC+7)**. Budget: 6–10 h.

## 1. What the data tells us (profiled before design)

- `trades.csv`: 200 rows, 8 columns, no BOM, LF endings, already sorted by timestamp, **no timestamp ties**, no duplicate ids, no zero/negative values, no zero fees.
- 5 symbols × 40 trades, 100 trades per exchange, 128 BUY / 72 SELL, 2025-10-01 → 2026-03-27.
- Every asset is **fully closed twice and reopened** — the "full close → new BUY" rule is exercised by real data.
- Decimal places vary per asset: BTC qty 8 dp, CKB price 8 dp with quantities up to ~1.9 M, DOGE price 6 dp.
  Binary floats would leave dust like `1e-17` after a full close and break the zero-reset rule → **use an arbitrary-precision decimal type**.
- Computing each exchange separately never produces a short, so an optional per-exchange scope is feasible.

### Reference results (independent oracle: Python `decimal`, 50 significant digits)

| Metric | Value (USD) |
|---|---|
| Portfolio value | 60,620.89161 |
| Cost basis | 59,969.237419… |
| Realized P&L | −5,052.962687… |
| Unrealized P&L | +651.654190… |
| Total P&L | −4,401.3084972465 |
| Total fees | 2,708.86 |

Invariant used as a cross-check: `total P&L = current value + Σ SELL net proceeds − Σ (BUY gross + BUY fee)`.
It does not depend on the averaging method, so it validates the engine independently.

## 2. Architecture

**Stack:** Next.js 16 (App Router) + React 19 + TypeScript (strict), deployed on Vercel.
Supporting libraries: `decimal.js`, `zod`, `papaparse`, `recharts`, Tailwind CSS 4, Vitest.

```
data/                      supplied CSVs (source of truth, bundled read-only)
src/domain/                pure TypeScript, no React/Next imports
  money.ts                 Decimal config + helpers
  schemas.ts               zod contracts (Trade, Price, Portfolio DTOs)
  csv/parseTrades.ts       parse + validate → Result<Trade[], ValidationError[]>
  csv/parsePrices.ts
  portfolio/engine.ts      weighted-average cost engine (deterministic)
  portfolio/valuation.ts   current value, unrealized, allocation, totals
src/server/                file loading, API helpers
src/app/api/portfolio/     GET  → sample dataset result
                           POST → validate uploaded trades.csv, compute, return result or 422 with row-level errors
src/app/(ui)/              dashboard page + components (KPI cards, holdings table, charts, transaction explorer)
src/lib/format.ts          display-only rounding/formatting
tests/                     unit, golden, API tests
```

**Data flow:** CSV → parser/validator (all-or-nothing) → engine (ordered by timestamp, then trade_id) →
valuation with `prices.csv` → JSON DTO (decimals as **strings**) → client renders; formatting happens only in the UI.

**Persistence decision (candidate's call): nothing is stored.** The server is stateless and the imported CSV is
never persisted — not in a database, not in `localStorage`. An import lives only in the open tab's memory; reloading
the page or pressing "Reset to sample data" returns to the supplied files. Imports are atomic because client state is
replaced only after a successful response. No database, no secrets.
Tradeoff: an import is lost on reload and is not shared between reviewers — acceptable because the supplied files are
the source of truth.

**Scope decision:** positions are pooled per asset across both exchanges — one holdings row per asset, as the spec
asks. No per-exchange scope (not required).

## 3. Calculation rules (as specified, plus edge decisions)

- BUY: `cost += qty × price + fee`; `avg = cost / qty`.
- SELL: `costRemoved = avg × qty`; `realized += qty × price − fee − costRemoved`.
- **Full close:** when sold qty equals the held qty, remove the *entire* remaining cost basis (not `avg × qty`) and
  reset qty/cost/avg to exactly zero — avoids rounding residue.
- SELL above the held quantity → validation error for that row; nothing is imported.
- Ordering: ascending timestamp; ties broken by `trade_id` (documented; the sample has no ties).
- Missing price for a held asset → value/unrealized/allocation shown as "unavailable" with a warning; totals flag
  that they are partial. Closed positions with non-zero realized P&L stay visible.
- Precision: `decimal.js`, 40 significant digits, no rounding inside the engine. Display rounding with
  ROUND_HALF_UP: USD 2 dp, prices by magnitude (up to 8 dp), quantities up to 8 dp, percentages 2 dp.
  Totals are computed at full precision, so a column of rounded rows may differ from its total by ±$0.01 — documented.

## 4. UI

- KPI cards: value, cost basis, realized, unrealized, total P&L (+ % of cost), total fees, price `as_of` timestamp.
- Holdings table: every required column; sign shown with `+`/`−` and ▲/▼ icons as well as colour.
- Charts: allocation by current value; grouped bars for realized vs unrealized P&L per asset (zero line, negatives
  below). Each chart has a text alternative. *(Changed during M1: allocation uses sorted horizontal bars instead of a
  donut, because the five shares are close together.)*
- Transaction explorer: asset search, exchange/side filters, date range, timestamp sort, pagination; shows all
  CSV fields plus gross value and fee.
- States: loading skeletons, empty (no trades), invalid import (row-level error list), missing prices, and error
  boundary for unexpected failures.
- Responsive (mobile card/scroll layout) and accessible (semantic tables, labels, focus, contrast).

## 5. Testing (`pnpm test`)

Unit tests with hand-computed numbers for: multiple BUYs at different prices, BUY fee in average cost, partial SELL,
SELL fee deducted, full close then new BUY, short SELL rejected, invalid/duplicate CSV rows (missing column, bad
timestamp, unsupported symbol/exchange/side, qty/price ≤ 0, negative fee), missing price.
Golden test on the supplied dataset against the oracle numbers above, plus the total-P&L invariant.
API test: POST with an invalid CSV returns 422 and row-level errors; valid CSV returns 200.

## 6. Milestones

| # | When | Work | Commit(s) |
|---|---|---|---|
| M0 | Wed evening | Scaffold, domain contracts, CSV parser + engine + tests (golden green) | small, one concern each |
| M1 | Thu | API route, dashboard, holdings, charts, explorer, states | |
| M2 | Thu evening | Vercel deploy, responsive/a11y pass, README | |
| M3 | Fri morning | AI_WORKFLOW.md, final review by the candidate, submit (target before 12:00) | |

## 7. AI workflow evidence (35 % of the grade)

- The candidate drives; the agent (Claude Code) proposes and implements; every milestone ends with a
  **candidate review checkpoint** (numbers checked against the oracle, UI checked on desktop + mobile).
- Prompts are given in Vietnamese; `AI_WORKFLOW.md` will quote faithful English translations and say so.
- Candidate examples: (1) requirement analysis + data profiling (this plan), (2) decimal type & persistence
  decision, (3) engine implementation, (4) golden/invariant testing, (5) a real correction or rejection made during
  review, (6) deployment/UX fix. Only real events are recorded — nothing staged.
- Small commits so the examples can link to diffs.
