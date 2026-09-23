# OrgTrace AI — team rules

OrgTrace AI is an advisory AI reorganization auditor: compare BEFORE/AFTER documents, trace unit and function changes, flag possible losses, duplication and conflicts, and support findings with source clauses for human review.

Read the complete official scope in `docs/case/case.txt` and the execution plan in `docs/plan/PLAN.md`. The case is the source of truth; never edit, translate or rewrite it. Report conflicts instead of silently changing scope.
Documentation and task reports are in English. Product UI and synthetic control documents use the specified Russian text. Identifiers, field names, paths and enum values stay in English.

| Lane / branch | Owned paths |
| --- | --- |
| Backend / AI — `lane/backend` | `src/app/api/**`, `backend/**`, `src/shared/**`, `package.json`, root configuration files and dependency lockfile |
| Frontend / Product — `lane/frontend` | `src/app/**` except `src/app/api/**`, `src/components/**`, `src/lib/api.ts`, `src/mocks/**`, `docs/product/**` |
| QA / README / Evaluation — `lane/qa` | `tests/fixtures/**`, `eval/**`, `scripts/**`, `docs/qa/**`, `DATA_NOTES.md`, `README.md` |

- Edit only your lane's paths on your lane branch. Request shared contract changes from backend.
- Pull the latest `main` before each task and incorporate it into your lane; preserve others' uncommitted work and never force-push shared history.
- Narrow bootstrap exception: backend may create only the minimal root Next.js shell in frontend paths before frontend starts; publish that first baseline to `main`, then resume `lane/backend`.
- Narrow handoff exception: frontend may append READY FOR TEST entries to `docs/qa/handoff.md`; QA owns the rest of that file. Coordinate appends at merge.
- Backend-owned Vitest tests stay beside backend/shared source; QA owns fixtures and evaluation. QA requests dependency/configuration changes from backend.
- Every member commits their own work under their own identity; preserve personal contributions when merging.
- Never read, print, log or commit `.env.local`, keys or secret values. Runtime clients may consume environment variables without exposing them. `.env.example` contains placeholders only.
- Never invent units, functions, clauses or facts for real analyses. Synthetic fixtures and mocks must be explicitly labeled.
- Every publishable finding needs verified evidence. Unverified diagnostic candidates are visibly unconfirmed and excluded from validated counts and conclusions.
- Every LLM interpretation needs `fragmentId` and a verbatim quote validated by the server. Missing AFTER evidence does not prove a loss.
- Deterministic server code owns statuses, counts, priorities and state. Frontend never decides business logic.
- Mock results always set `isMock=true` and show `DEMO / MOCK DATA`; never present them as AI output.
- Run relevant tests, typecheck and lint before claiming completion; frontend also runs build. “Not run” is not “passed.”
- No new features in the last 45 minutes; fixes, verification, push and submission only. Everyone stays in the zone for the last hour.
- End every task with: changed files; commands with exit codes (or `NOT RUN` and reason); blockers; requests for other lanes.
