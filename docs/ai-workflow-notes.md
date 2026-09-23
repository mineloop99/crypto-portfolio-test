# AI workflow — working notes

Raw log kept during development; distilled into `AI_WORKFLOW.md` at the end.
Tool: Claude Code (CLI). The candidate writes prompts in Vietnamese; quotes below are faithful English translations.

## 2026-09-23 — Requirement analysis and planning

**Goal:** understand the assessment and turn it into a plan before writing code.

**Prompts (translated):**
- "Read my latest email about the test for the new job and tell me what they want me to do. TL;DR."
  (The email did not show up in the mailbox the agent could search, so the candidate sent a screenshot of the email.)
- "Make a plan. I'll deploy this on Vercel. I only speak Vietnamese to you, but the whole project must be in English.
  Create git/appscyclone-test."

**Agent response:**
- Rendered the Notion page with headless Chromium (plain fetch returned an empty JS shell), downloaded
  `assessment.pdf`, `trades.csv`, `prices.csv`, and summarised the deadlines, deliverables and grading weights.
- Profiled `trades.csv` before designing anything: sort order, timestamp ties, duplicate ids, decimal places per asset,
  number of full closes per asset, whether computing each exchange separately could create shorts.
- Built an independent reference result with Python `decimal` (50 significant digits) and found a method-independent
  invariant: `total P&L = current value + Σ SELL net proceeds − Σ (BUY gross + BUY fee)`, which gives exactly
  −4,401.3084972465 on the sample data.
- Wrote `docs/PLAN.md`: stack, module boundaries, calculation edge cases, test plan, milestones, and three open questions.

**Candidate review / decisions:**
1. Persistence — the agent recommended a stateless server that kept the imported CSV in `localStorage`.
   **Candidate rejected the `localStorage` part: "Don't store the CSV."** Imports now live only in the open tab's
   memory; reload or "Reset to sample data" returns to the supplied files.
2. Scope — the agent offered an optional per-exchange scope selector as a stretch goal.
   **Candidate declined: "If it's not required, one row per coin."**
3. Repository — keep it local for now; use Next.js.

**Outcome:** plan updated (`docs/PLAN.md`, sections "Persistence decision" and "Scope decision").

## 2026-09-23 — M0: domain engine, validation, tests

**Prompt (translated):** "1. Don't store the CSV. 2. If it's not required, one row per coin. 3. Keep the repo local for
now, use Next.js." — the go-ahead for milestone M0 as described in `docs/PLAN.md`.

**Agent response:**
- Scaffolded Next.js 16; noticed the generated `AGENTS.md` warns that this Next.js version differs from the model's
  training data and asks agents to read `node_modules/next/dist/docs/` first — noted for the UI/API milestone.
- Wrote the pure domain layer (`src/domain/`): decimal helper, CSV reader, trade/price validators, ledger, valuation,
  import boundary. No React/Next imports.
- Wrote 49 tests: hand-computed cases for every rule listed in the brief, parser edge cases, and a golden test on the
  supplied data against `scripts/oracle.py` (independent Python implementation) at 20 decimal places plus the
  cash-flow invariant.
- Self-correction before any push: the first commit included the assessment PDF; the agent removed it from history
  and git-ignored `docs/spec/` because the brief is not the candidate's to publish.

**Verification:**
- All 49 tests passed on the first run, which is not proof on its own, so the engine was mutation-checked by hand:
  (1) BUY fee not capitalised → 15 tests fail; (2) SELL fee ignored → 11 fail; (3) full close via `avg × qty`
  instead of removing the whole basis → 1 fails (the repeating-decimal test — expected, since the difference is only
  rounding residue); (4) average cost recomputed and rounded on SELL → 6 fail. Mutations reverted, suite green.
- `tsc --noEmit` and ESLint clean.

**Candidate review:** _pending — see checklist given in chat._

## 2026-09-23 — M1: API and UI

**Prompt (translated):** "OK, continue."

**Agent response / notable decisions:**
- Read the Next.js 16.3 docs bundled in `node_modules/next/dist/docs/` before writing framework code (as the generated
  `AGENTS.md` demands). Two things differed from the model's prior knowledge and were applied: `error.tsx` receives
  `retry()` (not only `reset()`), and data files read at runtime must be listed in `outputFileTracingIncludes` to be
  shipped with the Vercel function. Verified after `next build`: `route.js.nft.json` lists `data/trades.csv` and
  `data/prices.csv`.
- API: `GET`/`POST /api/portfolio`, zod contract shared with the client, decimals as strings, 422 with every issue,
  413 above 2 MB, request id on every response.
- Charts: the plan said "allocation donut". Following a data-viz checklist, the agent switched to sorted horizontal
  bars because the five shares are close (14–26 %) and a donut hides small differences. The two-series P&L palette
  was checked with a colour-vision-deficiency validator (PASS: ΔE 24.7 protan, contrast ≥ 3:1).
- ESLint (`react-hooks/set-state-in-effect`) rejected the first version of the data hook; the initial load was
  restructured so state is only set when the response arrives, with a cancellation flag.

**Verification:**
- 67 unit/API tests green, `tsc` and ESLint clean, production build OK.
- Screenshots (desktop 1440 px, mobile 390 px) reviewed by the agent; headline numbers match the Python oracle.
  Found and fixed three issues from the screenshots:
  1. allocation axis ticks showed "+$4K" (signed formatter reused from the P&L axis);
  2. the holdings footnote said rounded rows may differ from the total "by a cent" — the real data differs by
     2 cents (unrealized rows add up to $651.67, exact total $651.65), so the note was corrected to "a few cents";
  3. a closed asset's allocation showed "n/a (no current price)" when the real reason is a zero-value portfolio.
- Scripted browser run against the production build (13/13 checks): invalid file lists 6 issues by line/column and
  leaves the numbers unchanged; short sell rejected; an all-closed import shows $0 value and −$204.00 realized
  (hand check: 10 × 180 − 2 − (10 × 200 + 2)); reset and reload return to the sample; clicking BTC filters the
  explorer to 40 trades whose fees ($486.42) and realized P&L (−$463.75) match the BTC holdings row.

**Candidate review:** _pending._

## 2026-09-23 — Invalid sample files and the semicolon hint

**Prompt (translated):** "Give me a few wrong files."

**Agent response:** generated ten invalid files (several are the real 200-row sample with one realistic defect: a
copy-pasted duplicate row, a one-satoshi oversell on a full close, a SELL timestamp mistyped a month early, a European
Excel export) and POSTed each to the API before handing them over — all ten rejected with the intended messages.
Two observations from that run:
1. agent bug, fixed immediately: a single-problem import said "Fix them" (commit "Use singular wording…");
2. open question for the candidate: the semicolon export was reported as "missing all 8 columns" — correct but not
   actionable.

**Candidate decisions:** "Do the semicolon one too" → a header that is one cell containing every expected name split
by `;` or a tab now gets one explanatory message; the agent kept rejecting rather than guess-parsing (decimal commas
make that ambiguous) and told the candidate so. "Yes, add them" → the samples are committed under
`public/samples/invalid/`. The candidate's local `allowedDevOrigins` edit in `next.config.ts` is dev-only and stays
uncommitted, at the candidate's request.

## 2026-09-23 — M2 (part 1): docs, deployment readiness

**Prompt (translated):** "OK, carry on — I don't need to deploy yet."

**Agent response:**
- Deployment readiness: the lockfile was written by pnpm 11 and Vercel may install with pnpm 10. A clean clone with
  `npx pnpm@10 install --frozen-lockfile` silently ran pnpm 11 (the `packageManager` field makes pnpm switch
  versions); with `npm_config_manage_package_manager_versions=false` it really ran pnpm 10.34.5 — install, build and
  68 tests all OK. Declared `engines.node >= 20.9` (Next.js 16's minimum).
- README rewritten from the create-next-app template to cover every section the brief asks for.
- `AI_WORKFLOW.md` drafted from this log; the candidate's own checks and reasons are left as `TODO(candidate)` rather
  than written by the agent.
