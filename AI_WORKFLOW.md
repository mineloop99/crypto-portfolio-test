# AI Coding-Agent Workflow

> The examples are taken from the working log in [`docs/ai-workflow-notes.md`](docs/ai-workflow-notes.md) and the git
> history. The "My review" parts and the reasons behind my decisions are my own.

## Tools and models

- **Claude Code** (terminal agent) — model: Claude Opus.
- What the agent could use: this repository and a shell; Python for the reference implementation; headless Chromium
  for screenshots and scripted browser checks; the Next.js documentation bundled in `node_modules/next/dist/docs/`;
  a data-visualisation checklist with a colour-vision-deficiency palette validator.
- I gave the agent instructions in Vietnamese. The prompts quoted below are faithful English translations.
- **Who wrote what:** the agent wrote almost all of the code, tests and documentation. I set the constraints, made the
  product and architecture decisions listed below, and reviewed the results at each milestone. I can explain and
  change any part of the submission.

## How I worked

1. **Plan before code.** The agent first profiled the data and wrote [`docs/PLAN.md`](docs/PLAN.md) — architecture,
   calculation edge cases, test plan, milestones, open questions. I answered the questions before any code was
   written.
2. **Milestones with review checkpoints:** M0 domain engine + tests → M1 API + UI → M2 docs + deployment. Each
   milestone ended with a list of things for me to check.
3. **Independent verification over trust.** Numbers are checked against a separate Python implementation and an
   invariant that does not depend on the averaging method; the tests themselves were checked by breaking the engine
   on purpose.
4. **Small commits, one concern each,** so each example below points at a reviewable diff.

## Examples

### 1. Requirement analysis and data profiling

**Goal and context.** Turn a five-page brief into a plan and find the traps in the data before designing anything.
The agent had already fetched the brief and CSVs from the Notion page the recruiter sent.

**Prompt.**
> Make a plan. I'll deploy this on Vercel. I only speak Vietnamese to you, but the whole project must be in English.
> Create git/appscyclone-test.

**Agent response.**
- Profiled `trades.csv`: 200 rows, already sorted, no timestamp ties, no duplicate ids; every asset is **fully closed
  twice and reopened**, so the "reset on full close" rule is exercised by real data; CKB prices have 8 decimals with
  quantities near 2 million — a strong hint that binary floats would misbehave.
- Checked whether computing each exchange separately would ever create a short position (it would not), so the
  pooled-vs-per-exchange question could be decided on product grounds.
- Wrote an independent reference in Python `decimal` ([`scripts/oracle.py`](scripts/oracle.py)) and found an invariant
  independent of the averaging method: *total P&L = current value + Σ SELL net proceeds − Σ (BUY gross + BUY fee)*,
  which equals exactly **−4,401.3084972465** on the sample.
- Wrote [`docs/PLAN.md`](docs/PLAN.md) with three open questions: persistence, per-exchange scope, and where the
  repository lives.

**My review.** I read the plan against the brief and answered its three open questions before any code was written
(example 2).

**Outcome.** Accepted the plan with the changes in example 2. Commit: *"Scaffold Next.js app with supplied data and
plan"*.

### 2. Architecture decisions: persistence, numeric type, data contract — and one rejected proposal

**Goal and context.** Settle the decisions that are expensive to change later.

**Prompt** (my answers to the plan's open questions).
> 1. Don't store the CSV. 2. If it's not required, one row per coin. 3. Keep the repo local for now, use Next.js.

**Agent response.** The plan proposed:
- a stateless server that validates and computes an upload, **with the imported CSV kept in `localStorage`** so it
  survives a reload;
- an optional per-exchange scope selector as a stretch goal;
- `decimal.js` for every quantity, price and amount, decimal **strings** on the wire, and a zod schema shared by
  server and client so a contract mismatch shows as an error rather than wrong numbers.

**My review and outcome.**
- **Rejected the `localStorage` part.** Imports now live only in the open tab's memory; reload or "Reset to sample
  data" returns to the supplied files. Reason: the supplied CSVs already ship with the app and are the source of
  truth. An import is a check of a file against the same format, so keeping a copy in the browser would only add a
  second, possibly stale dataset without any requirement asking for it.
- **Declined the per-exchange scope** — not required by the brief, so one holdings row per asset.
- Accepted `decimal.js`, string decimals and the zod contract.

The agent updated the plan ("Persistence decision", "Scope decision") before writing code.

### 3. Implementing the engine and the import boundary

**Goal and context.** Milestone M0: a pure, deterministic domain layer with no React or Next.js imports, and tests
for every rule in the brief.

**Prompt.** My answers in example 2 were the go-ahead for M0 as specified in `docs/PLAN.md` §3 and §5, which served
as the acceptance criteria: weighted average with fees capitalised on BUY and deducted on SELL; full close resets to
exactly zero; a SELL above the holding rejects the whole file; ordering by timestamp then `trade_id`; every listed
test case asserting hand-computed numbers.

**Agent response.**
- [`src/domain/`](src/domain/): CSV reader and validators that collect every issue with line and column, the ledger,
  valuation, and an `importPortfolio` boundary that returns either a complete portfolio or issues — never both.
- A design detail it called out: on a full close the **entire remaining cost basis** is removed instead of
  `average × quantity`. Identical in exact arithmetic, but it guarantees a zero cost basis with no rounding residue
  before the position reopens.
- 49 tests: hand-computed cases with the arithmetic in comments, parser edge cases, and a golden test on the sample
  data against the Python reference at 20 decimal places.
- **Self-correction before any push:** its first commit included the assessment PDF. It removed the PDF from the
  commit and git-ignored `docs/spec/`, since the brief is not mine to publish.

**My review.** I ran `pnpm test` myself. For the cases I could not fully check by hand, I relied on the suite and on
the tests in example 4, and later tried broken files against the running app (example 7).

**Outcome.** Commits *"Add domain model and CSV validation"*, *"Add weighted-average cost ledger, valuation and import
boundary"*, *"Check the supplied dataset against an independent reference"*.

### 4. Testing the tests

**Goal and context.** All 49 tests passed on the first run. That is not evidence that the tests can fail.

**Prompt.** No separate prompt — part of the M0 checkpoint; the plan required tests that "assert known numeric
results, not only that code executes".

**Agent response.** Checked the suite by breaking the engine on purpose, one change at a time:

| Mutation | Failing tests |
|---|---|
| BUY fee not added to cost basis | 15 |
| SELL fee not deducted from proceeds | 11 |
| Full close via `average × quantity` instead of removing the whole basis | 1 (the repeating-decimal test — expected, the difference is rounding residue only) |
| Average cost recomputed and rounded on SELL | 6 |

Then reverted every mutation and confirmed the suite was green. The golden test also checks the cash-flow invariant,
computed straight from the rows: if the TypeScript engine and the Python reference shared the same misreading of the
fee rules, total P&L would still disagree with it. (The invariant cannot catch a wrong split between realized and
unrealized P&L — the hand-computed unit tests cover that.)

**My review.** I ran `pnpm test` again after the mutations were reverted: green.

**Outcome.** Accepted. The agent judged the single failing test for the full-close mutation acceptable, because only
a repeating-decimal case can expose the residue.

### 5. Working with a framework newer than the model's knowledge

**Goal and context.** Milestone M1 (API and UI). The project uses Next.js 16.3; the generated `AGENTS.md` warns that
this version has breaking changes compared with the model's training data.

**Prompt.**
> OK, continue.

The prompt is short on purpose: the specification was already written and approved. It was the go-ahead for M1 as
defined in `docs/PLAN.md`, which served as the acceptance criteria:
- `GET`/`POST /api/portfolio`: validate the upload, compute, and return the result or a 422 with row-level errors;
  decimals as strings (§2);
- KPI cards, a holdings table with every required column, allocation and realized-vs-unrealized charts, and a
  transaction explorer with search, filters, date range, sort and pagination (§4);
- loading, empty, invalid-import, missing-price and error states; a responsive and accessible layout (§4).

**Agent response.**
- Read the bundled docs before writing framework code and applied two differences it would otherwise have missed:
  `error.tsx` receives `retry()`; files read at runtime must be listed in `outputFileTracingIncludes` or they are not
  shipped with the Vercel function. It verified the second point after `next build` by checking that
  `route.js.nft.json` contains both CSVs.
- ESLint (`react-hooks/set-state-in-effect`) rejected its first version of the data hook. It restructured the initial
  load so state is only set when the response arrives, with a cancellation flag, instead of disabling the rule.
- Before deployment, it cloned the repository and installed with **pnpm 10** (`--frozen-lockfile`, build and tests),
  because the lockfile was produced by pnpm 11 and Vercel may use pnpm 10. Its first attempt silently ran pnpm 11 —
  the `packageManager` field makes pnpm switch versions — so it disabled that switch and repeated the check.

**My review.** I did not review the framework details line by line. I checked the result instead: `pnpm test`, and
my own QA of the running app (example 6).

**Outcome.** Commits *"Add /api/portfolio with a typed contract"*, *"Build the dashboard UI"*.

### 6. Reviewing the UI with screenshots and a scripted browser run

**Goal and context.** Check that the UI shows correct numbers, handles every state, and works on a phone.

**Prompt.** Part of M1 (same prompt as example 5).

**Agent response.**
- Changed a plan decision: the plan said "allocation donut". The five allocations are close together (14–26 %), which
  a donut hides, so it used sorted horizontal bars. It ran the colour-vision-deficiency validator on the two-series
  P&L palette (pass).
- Took desktop (1440 px) and mobile (390 px) screenshots of the production build and found three problems, then fixed
  them:
  1. the allocation axis showed "+$4K" — a signed formatter reused from the P&L axis;
  2. the note under the holdings table said rounded rows can differ from the total "by a cent", but in the sample the
     unrealized rows add up to **$651.67** against an exact total of **$651.65** — corrected to "a few cents";
  3. a closed asset's allocation read "n/a (no current price)" although the real reason was a zero-value portfolio.
- Ran a scripted browser check against the production build (13/13 passed): an invalid file lists its six issues
  and leaves the numbers unchanged; a short sell is rejected; an all-closed import shows $0.00 value and −$204.00
  realized (10 × 180 − 2 − (10 × 200 + 2)); reset and reload return to the sample; selecting BTC filters the
  explorer to 40 trades whose fees ($486.42) and realized P&L (−$463.75) match the BTC holdings row.

**My review.** I did my own QA pass of the app on a desktop browser and on a phone, and accepted the donut → bars
change.

**Outcome.** Fixes included in *"Build the dashboard UI"*.

### 7. Invalid files, and deciding how strict an error message should be

**Goal and context.** I wanted to try the validation myself with realistic bad files.

**Prompt.**
> Give me a few wrong files.

**Agent response.**
- Created ten files in [`public/samples/invalid/`](public/samples/invalid/). Several are the real 200-row sample with
  one realistic defect: a pasted duplicate row, a one-satoshi oversell on a full close, a SELL dated a month early, a
  European Excel export with semicolons and decimal commas.
- POSTed every file to the API before handing them over. All were rejected as intended, which exposed:
  1. a wording bug — a single-problem import said "Fix **them**" (fixed in *"Use singular wording when an import has
     exactly one problem"*);
  2. a usability gap it raised as a question for me instead of fixing it: the semicolon export was reported as
     "missing all 8 columns" — correct, but unhelpful.

**My review and outcome.**
- "Do the semicolon one too." → A header that is a single cell containing every expected name separated by `;` or a
  tab now produces one message explaining the export problem. The agent kept **rejecting** such files instead of
  parsing them, because those exports usually use `,` as the decimal separator and guessing could produce wrong
  amounts; it told me so and offered to accept them if I preferred. I did not ask for parsing, so they stay rejected.
- "Yes, add them." → The samples are committed so reviewers can download them from the deployed app.
- I imported the files myself, scenario by scenario, and checked that each one was rejected with the message it was
  built to trigger and that the dashboard numbers stayed unchanged.

Commits: *"Explain semicolon- and tab-separated exports on import"*, *"Add invalid trades.csv samples for trying the
validation"*.

### 8. My own mobile QA: date filters that looked blank

**Goal and context.** After deploying to Vercel I went through the app on my phone (iOS Safari).

**What I found.** The From/To inputs are the date-range filter the brief asks for, but on iOS Safari an empty date
input shows no placeholder: they rendered as two blank boxes labelled only "From" and "To". In a crypto app that
reads like a wallet transfer rather than a date range, and the "From" box ran past the edge of the card. I sent the
agent a screenshot and asked for a clearer UI, and to log it here.

**Agent response.**
- Checked the brief: date-range filtering is a stated requirement of the transaction explorer, so the fix belongs in
  the presentation, not the feature.
- Renamed the labels to "From date" and "To date".
- Fixed the overflow (`min-w-0` on the grid items and inputs) and aligned the height of the empty date inputs with
  the selects.

**My review and outcome.** Accepted and redeployed to Vercel. Commit: *"Label the date-range filters as
dates and stop them overflowing on mobile"*.

## What I would do differently

- **Review the logic the agent adds on its own earlier.** Along the way the agent added rules the brief does not state:
  removing the whole cost basis on a full close, the semicolon-export detection, the 2 MB upload limit, the filtering
  helpers behind the transaction explorer. Each was reasonable, but an agent cannot always read a brief 100 % correctly.
  Next time I would ask for a list of every rule not taken directly from the brief at each checkpoint, and review and
  tighten those as separate diffs before building on top of them.
- **Put the acceptance criteria in the prompt itself.** "OK, continue" worked here only because the plan already said
  what M1 had to deliver. Restating the criteria in the go-ahead ("M1: API with 422 row errors, holdings with every
  column, explorer filters, all five UI states, desktop and 390 px screenshots") makes each step reviewable on its own,
  without opening the plan.

## Future plan

How I would take the same workflow from a solo take-home to a team repository:

- **Extend CI into a merge gate.** A first CI workflow is already in place as an extra beyond the brief
  ([`ci.yml`](.github/workflows/ci.yml): audit, types, lint, tests, build, and the running build compared with the
  Python reference). Next: browser end-to-end tests of the import → reset → filter flow on desktop and mobile
  viewports, an axe accessibility run, and branch protection so a red check blocks the merge.
- **AI review on pull requests.** Every PR gets an automated AI review (for example Claude Code's GitHub Action)
  focused on what matters most here: calculation correctness against the rules in the brief, rules the change adds
  that the brief does not state, and missing tests. The AI review is a first pass; a person still approves the merge.
- **Vercel preview per pull request,** so the reviewer checks the UI on desktop and phone before merging, the same QA I
  did by hand for this submission.
- **Work in small PRs instead of commits to `main`,** one milestone or concern each, with the agent's checkpoint list
  as the PR description — the same structure as this document, but reviewable in GitHub.
