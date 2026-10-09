# Model Routing Policy

Strict rules for which model does which work in this repository. Applies automatically to every task; never ask the user which model to use.

## Mechanism (what actually enforces this)

| Role | Model | How it is assigned |
|---|---|---|
| Primary engineer | Sonnet 5.5 (`claude-sonnet-5-5`) | Main session model, pinned in `.claude/settings.json`. Sonnet designs and implements in the main session; it is never delegated. |
| Support | Haiku 5.5 (`claude-haiku-5-5`) | Project subagents in `.claude/agents/`, each with `model: claude-haiku-5-5` in its frontmatter. |

Support subagents (invoke with the Agent tool, `subagent_type` = name):

- `support-verifier` — tests, lint, typecheck, build, sim sanity scripts, browser/E2E checks, mechanical fixes. Can edit `tests/`, `e2e/` and trivially fix lint/type errors.
- `support-reviewer` — read-only first-pass review and repo exploration/summaries. Cannot edit.
- `support-docs` — documentation only (`docs/`, `README.md`, `docs/PROJECT_STATE.md`). Cannot touch `src/`.

Do not override the subagent model at call time (no `model:` param on Agent calls) unless a support agent is unavailable.

## Sonnet 5.5 owns (never delegate)

Architecture and design; planning non-trivial features; implementing features; simulation engine and deterministic logic; gameplay systems and balancing logic; data model, persistence/schema and migrations; state management; algorithms and performance-sensitive code; complex refactors and cross-system integration; hard bugs and race conditions; security-sensitive changes; resolving ambiguous requirements; reviewing failures that point at a real design problem.

One Sonnet owner carries a feature from design through core implementation. Do not hand production logic to Haiku to save tokens. Correctness beats cost.

## Haiku 5.5 owns (mechanical/support, after Sonnet's implementation exists)

Unit/regression tests for already-implemented behaviour; running tests, lint, typecheck, build; fixing trivial lint/type errors; formatting; documentation (README, `docs/`, PROJECT_STATE, changelog, comments, summaries); first-pass code review; TODO/placeholder/dead-code/naming searches; simple a11y and responsive/browser checks; running sim scripts and summarising results; migration and persistence round-trip checks; final verification checklists; repo exploration whose result is summarised before Sonnet decides.

Haiku may read production code but must not redesign systems or change production behaviour.

## Escalation (Haiku → Sonnet)

A support agent must STOP and return the finding instead of patching it when it hits anything needing engineering judgement:

- a failing test exposes a simulation/engine bug
- ambiguous migration behaviour, persistence corruption
- balancing/sim results look unrealistic
- race condition or state-architecture problem
- performance regression needing redesign
- conflicting requirements
- a fix would change gameplay behaviour or touch several interconnected systems

Format returned to the main session:

```
ESCALATE: <one-line title>
Evidence: <command, failing test, output excerpt, file:line>
Why it needs Sonnet: <which criterion above>
Not changed: <confirm no speculative edits were made>
```

On receiving an ESCALATE, the main (Sonnet) session investigates and fixes it, then hands verification back to `support-verifier`. Mechanical failures (unused import, formatting, a test asserting stale-but-intended values after a deliberate change) are fixed directly by the support agent.

## Autonomous workflow for every feature request

1. Optionally `support-reviewer` gathers repo context (summary only).
2. Sonnet designs the change.
3. Sonnet implements the production logic.
4. `support-verifier` adds/expands tests and runs targeted tests, full suite, `npm run lint`, `npm run typecheck`, `npm run build`, relevant `npm run sim:*` checks, and E2E/browser checks where UI changed.
5. `support-reviewer` does the initial review.
6. Serious findings and ESCALATE reports return to Sonnet.
7. Sonnet fixes them.
8. `support-verifier` re-verifies.
9. `support-docs` updates documentation to match what actually exists.
10. Report the result.

Do not stop after design to ask for approval. Only stop for destructive actions, credentials, or legal decisions.

## When the support agents are mandatory

After implementing, Sonnet MUST run `support-verifier` and `support-reviewer` (and `support-docs` if behaviour or docs changed) when ANY of these is true:

- the change touches more than 2 files
- it touches anything in `src/engine/` or `src/persistence/`
- it changes test, e2e or sim behaviour (`tests/`, `e2e/`, `scripts/sim/`)

This holds even if the change itself is small (a one-line engine fix still goes through them). Smaller changes (1–2 files, outside those paths, such as a UI tweak) may be verified directly by Sonnet with typecheck, lint and a quick browser check; the support agents are optional there.

## Parallelism

After Sonnet finishes, `support-verifier`, `support-reviewer` and `support-docs` may run in parallel as long as their write sets do not overlap (reviewer is read-only; docs only touch docs; verifier only touches tests and trivial lint/type fixes). Never run two writers on the same file. Architecture and core implementation stay with the single Sonnet owner.

## Context efficiency

Give each subagent only the file paths, diff summary and commands it needs, not the whole repo or conversation. Keep `docs/PROJECT_STATE.md` concise so a fresh Sonnet session can recover the architecture quickly. Delegate wide exploration to `support-reviewer` and act on its summary.

## Git

Follow the repo's existing rules: commit directly on `main` when asked to commit, plain messages, no `Co-Authored-By` or other attribution trailers, no unnecessary commits, and never commit while lint, typecheck, tests or build are failing unless explicitly told to.

## Verification commands

`npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run e2e` (builds, then Playwright), `npm run sim:careers`, `npm run sim:match`, `npm run sim:traits`.
