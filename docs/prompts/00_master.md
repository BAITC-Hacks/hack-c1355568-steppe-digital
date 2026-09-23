# Shared task preamble

Use this preamble with each lane-specific task. These prompts describe future implementation work; the documentation-package task itself must create no application code.

## Before every task

1. Read `AGENTS.md`, the entire immutable `docs/case/case.txt`, `docs/plan/PLAN.md`, and `src/shared/contract.ts` if it exists. Read the lane-specific task next. Do not claim a missing contract exists.
2. Inspect Git state without touching secrets. Pull the latest `main` and incorporate it into your lane branch before work. Preserve uncommitted work; stop and report a Git blocker instead of overwriting or force-pushing.
3. Work only in your lane's paths and branch. Request contract, dependency and configuration changes from backend. Only the two documented exceptions apply: initial backend app shell and frontend append-only QA handoff.
4. `case.txt` beats `PLAN.md`. Report any conflict and its technical consequence; never edit, translate or rewrite the case to remove a mismatch.
5. Implement the smallest solution that satisfies the current task. Do not take another lane's work or future tasks. Preserve personal commits for all three participants.

## First task of the day: CASE DELTA

Before writing any code on your first task of the day, output a report titled `CASE DELTA`, comparing the official case with the plan. Use all five sections below; write “None identified” when appropriate and distinguish confirmed facts from unresolved data questions.

- `Confirmed`: requirements and decisions supported by the case.
- `Changed`: mismatches requiring a plan or implementation adjustment.
- `New requirements`: official requirements not yet covered by the plan.
- `Removed assumptions`: assumptions that the case or real data does not support.
- `Technical consequences`: concrete effects on parsers, contract, UI, tests or schedule.

Cite case section numbers and the relevant plan section. This is an analysis report, not permission to rewrite the official case or perform future tasks. Report unresolved questions honestly; do not invent organizer data.

## Invariants during implementation

- Documentation and reports are English; UI text and synthetic Russian control documents retain specified Russian wording. Keep code identifiers, fields, file paths and enum values English.
- Never read, print or commit `.env.local` or keys. Runtime API clients may consume environment variables without exposing them. Never log secrets in errors, command output, cache keys or Git diffs.
- Never invent real units, functions, clauses, quotes or facts. Explicitly synthetic fixtures and mocks are allowed and labeled.
- Every publishable finding needs verified source evidence. Failed quotations must be dropped or unverified and excluded from validated conclusions. A possible loss needs a BEFORE source and transparent AFTER search, not a fabricated absence quote.
- Server code owns business decisions and state. Frontend renders the shared contract and submits human review decisions.
- All mock results use `isMock=true`, show `DEMO / MOCK DATA`, and are never described as AI output. Real errors never silently switch to mock mode.
- Run relevant tests, typecheck and lint before claiming completion; frontend also runs build. Record actual commands and exit codes. `NOT RUN` is not a passing result.
- No new features from T=255 onward. Everyone remains available in the zone for the whole final hour.

## End-of-task report

```text
Changed files:
- <path>: <what changed and why>

Commands and exit codes:
- <exact command> — exit <code>; <brief result>
- <required command> — NOT RUN; <reason>

Blockers:
- <issue and impact, or None>

Requests for other lanes:
- <lane>: <specific contract, dependency, handoff or fix request, or None>
```

Include commit and branch details with the report when implementation work was committed. Do not claim push, merge, submission, test success or real-AI detection without having verified it.
