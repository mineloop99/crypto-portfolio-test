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
