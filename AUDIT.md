# Audit

A self-audit of the submission against the brief, done on 2026-09-24 after the first deployment. The checks were run
by the AI coding agent at my request and reviewed by me; every number below comes from a command that can be re-run
(listed with each check). Findings were either fixed in this repository or accepted with a reason.

**Target:** <https://crypto-portfolio-test-zeta.vercel.app/> and the `main` branch of this repository.

## Summary

| Area | Result |
|---|---|
| Brief requirements | All covered — see the [coverage matrix](#1-requirements-coverage) |
| Calculation correctness | API matches an independent Python reference to 1e-20, on the running build and on the live deployment |
| Dependencies | `pnpm audit --prod`: no known vulnerabilities (7 direct production dependencies) |
| Secrets | None in the repository or its history; the app needs no environment variables |
| Accessibility | axe-core (WCAG 2.1 A/AA + best practice): **0 violations** on desktop and mobile after fix A-2 |
| Performance | Largest accepted import (2 MB, 31,144 rows): ~4.5 s end to end on Vercel; filtering 31,144 rows in the browser: ~35 ms |
| Findings | 9 — 4 fixed, 5 accepted (none open at high or medium severity) |

## Findings

| ID | Severity | Finding | Status |
|---|---|---|---|
| A-1 | Low | No browser security headers (clickjacking, MIME sniffing, referrer); `X-Powered-By` exposed | **Fixed** |
| A-2 | Medium | The hidden file input had no accessible name (axe `label`, impact *critical*) | **Fixed** |
| A-3 | Low | Trade and page counts had no thousands separator ("31144 trades") while money did | **Fixed** |
| A-4 | Low | On iOS Safari the empty date-range inputs showed as blank boxes labelled only "From"/"To" and the first one overflowed the card | **Fixed** |
| A-5 | Low | Upload size is checked from `Content-Length`; a chunked request without it is read in full before the 2 MB check | Accepted |
| A-6 | Low | No `script-src` Content Security Policy | Accepted |
| A-7 | Info | A 2 MB import returns a 7.6 MB response (every transaction with its realized P&L) | Accepted |
| A-8 | Info | `trade_id` is free text (for example `<script>…</script>` is accepted as an id) | Accepted |
| A-9 | Info | No rate limiting on `POST /api/portfolio` | Accepted |

**A-1 — security headers.** `curl -I` on the deployment returned none of the usual headers. `next.config.ts` now sends
`Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`,
`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` and a
restrictive `Permissions-Policy`, and no longer sends `X-Powered-By`. Verified with `curl -I` against `next start`.

**A-2 — file input label.** The visible "Import trades.csv" button opens a visually hidden `<input type="file">`
that had no label, so it was announced without a name if reached by assistive technology. It now has
`aria-label="trades.csv file to import"` and `tabIndex={-1}` (the button is the keyboard control). axe-core went from
1 critical violation to 0 on both viewports.

**A-3 — count formatting.** Found while importing the 31,144-row file. Counts now use a `formatCount` helper
(`31,144`) everywhere they are shown, with a unit test. The brief asks for consistent formatting.

**A-4 — date filters on iOS.** Found in my own phone QA; details in [AI_WORKFLOW.md](AI_WORKFLOW.md), example 8.

**A-5 — chunked uploads.** Accepted: the platform caps request bodies for Vercel Functions at 4.5 MB, so the extra
memory is bounded, and the 2 MB check still rejects the file (tested: a 3 MB POST returns 413).

**A-6 — script CSP.** Next.js inlines its bootstrap scripts, so a strict `script-src` needs a per-request nonce, which
makes every page dynamically rendered. The app renders no user-supplied HTML (React escapes all text), and the policy
above already blocks framing, `<base>` injection and plugins. Revisit if the app ever renders untrusted markup.

**A-7 — large responses.** A 2 MB file is 3.6 times smaller than its response because the explorer needs every row
with its realized P&L, and filtering happens in the browser. Measured on Vercel: 4.3–4.8 s for the POST, ~3.8 s until
the dashboard shows the import. Fine for the documented limit; larger histories would need server-side pagination
(listed in the README under limitations).

**A-8 — free-text ids.** The brief only requires ids to be unique, so no format is imposed. Tested with
`<script>alert(1)</script>` and `=cmd|x` as ids: stored and displayed as plain text. The app has no CSV export, so
spreadsheet formula injection does not apply.

**A-9 — rate limiting.** The endpoint is stateless, stores nothing and has no secrets behind it; the worst case is
compute cost on the host. A public production service would add a per-IP limit at the edge.

## 1. Requirements coverage

| Brief requirement | Where | Evidence |
|---|---|---|
| Supplied files as source of truth, no live APIs | `data/`, `src/server/portfolio-service.ts` | CSVs bundled with the function (CI checks `route.js.nft.json`) |
| Price timestamp displayed | Import panel | "Prices: valued at 2026-03-31 23:59:59 UTC" |
| Weighted-average rules, fees, full-close reset | `src/domain/portfolio/ledger.ts` | Hand-computed unit tests, golden test, mutation check |
| Precision; round only for display; documented | `src/domain/decimal.ts`, `src/ui/format.ts` | README "Precision and rounding"; decimals travel as strings |
| Import / re-import, all listed validations | `src/domain/csv/`, import panel | `tests/domain/import.test.ts`; 10 invalid samples in `public/samples/invalid/` |
| Invalid file never partially imported | `importPortfolio` returns a portfolio *or* issues | Browser check: numbers unchanged after a rejected file |
| Dashboard: 6 headline values | `kpi-cards.tsx` | All six shown; sign by `+`/`−` and ▲/▼ as well as colour |
| Holdings: one row per asset, 9 columns | `holdings-table.tsx` | Closed assets with realized P&L stay visible |
| Two charts that reconcile with the table | `allocation-chart.tsx`, `pnl-chart.tsx` | Same DTO as the table; each chart has a data-table alternative |
| Explorer: asset, exchange, side, date range, sort, paging, all fields, gross, fees | `transaction-explorer.tsx`, `src/ui/transactions.ts` | `tests/ui/transactions.test.ts`; BTC filter matches the BTC holdings row |
| Loading, missing prices, zero holdings, invalid import, unexpected failure | UI states, `error.tsx`, API 422/413/500 | Covered by tests and the browser run in AI_WORKFLOW.md example 6 |
| Typed contracts, frontend/backend boundary | `src/contracts/portfolio.ts` (zod, shared) | Client rejects a response that breaks the contract |
| Secure configuration and secrets | No env vars; `.env*` ignored | Secret scan below |
| Responsive and accessible | Tailwind layout, semantic tables | axe: 0 violations; no horizontal scroll at 390 px |
| Tests for the listed cases, one command | `pnpm test` | 69 tests; run in CI on every push |
| Public deployment | Vercel | URL above |
| README sections, AI_WORKFLOW.md | Repository root | Both present |

## 2. Calculation correctness

- **Independent reference.** [`scripts/oracle.py`](scripts/oracle.py) re-implements the rules with Python `decimal`
  (50 significant digits, standard library only).
- **Live comparison.** [`scripts/check-api.py`](scripts/check-api.py) fetches `/api/portfolio` and compares every
  total and every per-asset figure with the reference to 1e-20, plus total P&L against the cash-flow invariant
  (*total P&L = current value + Σ SELL net proceeds − Σ (BUY gross + BUY fee)* = −4,401.3084972465).
  Result on the live deployment: `OK: totals, the invariant and 5 assets match the reference to 1e-20`.
- **The check can fail.** Serving the same response with SOL realized P&L changed by one cent makes it exit 1 with
  `SOL.realizedPnl: expected …, got …`.
- **Unit level.** Hand-computed cases and the mutation check are described in AI_WORKFLOW.md, examples 3 and 4.

Re-run: `python3 scripts/check-api.py https://crypto-portfolio-test-zeta.vercel.app`

## 3. Security

- **Secrets.** `git grep` for keys, tokens, passwords and private-key headers: nothing. No `.pdf` or `.env` object in
  any commit (`git rev-list --all --objects`). The assessment brief is git-ignored.
- **Dependencies.** `pnpm audit --prod`: no known vulnerabilities. CI fails on any high or critical advisory.
- **Input handling** (tested against the deployment):
  - 3 MB body → `413`; binary garbage → `422` with a readable message; `PUT` → `405`.
  - `X-File-Name: ../../etc/<b>passwd</b>.csv` is reduced to a plain name (`b.csv`); it is only echoed in messages.
  - Unexpected errors return a generic message with a request id; stack traces are logged server-side only.
- **Headers.** See A-1 and A-6.

## 4. Accessibility and responsive layout

axe-core 4 injected into the production build with Playwright (Chromium), rules `wcag2a`, `wcag2aa`, `wcag21aa`,
`best-practice`:

| Viewport | Before | After |
|---|---|---|
| Desktop 1440 × 900 | 1 violation (A-2), 45 passes | 0 violations |
| Mobile 390 × 844 | 1 violation (A-2), 46 passes | 0 violations |

No horizontal scroll at either width (`scrollWidth` equals the viewport). Automated checks do not replace a
screen-reader pass; my manual QA covered desktop and an iPhone.

## 5. Performance

| Scenario | Result |
|---|---|
| `GET /api/portfolio` (200 sample trades), Vercel | 0.43–0.61 s |
| `POST` 2 MB file, 31,144 rows, Vercel | 4.3–4.8 s, 7.6 MB response |
| Same file in the browser until the dashboard updates, Vercel | ~3.8 s |
| Changing a filter over 31,144 rows in the browser | 32–38 ms |

## 6. Continuous integration

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push to `main` and on every pull request:
dependency audit → type check → lint → tests → reference self-check → production build → check that the CSVs are
traced into the API function → start the build and run `scripts/check-api.py` against it. This is extra to the brief;
it makes the checks in this audit repeatable instead of one-off.
