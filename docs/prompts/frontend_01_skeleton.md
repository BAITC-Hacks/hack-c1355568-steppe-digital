# Frontend task 01 — upload, progress, dashboard and evidence

Apply `docs/prompts/00_master.md` first. Read `docs/product/USER_FLOW.md` and pull backend's baseline from `main` before starting. Work on `lane/frontend` only in your owned paths. Build against `src/shared/contract.ts`; if it is unavailable or insufficient, request backend's change rather than creating a competing schema.

## Scope

Build screens 1–4 only: New Analysis, Progress, Dashboard and Evidence Drawer. Screens 5–7 (Structure Diff, Function Diff and Conclusion) are the next task. Preserve the full MVP's navigation needs without implementing future features early. All user-facing UI text is Russian; documentation and reports remain English.

## Mock result

Create `src/mocks/analysis-result.json`, validated against the shared schema. It is an explicitly synthetic, realistic Russian example with `isMock=true`, coherent references, original-looking but clearly synthetic fragments, and server-contract summary semantics.

Include:

- Every unit status: `PRESERVED`, `RENAMED`, `MERGED`, `SPLIT`, `CREATED`, `REMOVED`, with valid BEFORE/AFTER cardinalities and evidence.
- Several lineage statuses, including at least `UNCHANGED`, `TRANSFERRED`, `MODIFIED`, `NEW`, `POSSIBLE_LOSS`; arrays and linked functions must resolve.
- Two verified `LOSS` findings with actual mock `searchTrace` checked counts, candidate function IDs and rejection reasons; both have BEFORE source clauses.
- Two verified `DUPLICATION` findings with sources for both AFTER units, and one verified `CONFLICT` finding with same-process incompatible-role evidence.
- One additional unverified diagnostic finding with unverified evidence, separate from the verified findings above. Exclude it from validated summary counts and conclusion claims; provide a clear source-check warning.
- Six conclusion sections with resolvable verified finding IDs. Add evidence-backed `REORGANIZATION` findings as needed to ground structure/preservation text; never link a conclusion claim to an unverified candidate.
- At least one document warning, a useful empty state and review states that can be exercised without suggesting the mock came from AI.

A persistent `DEMO / MOCK DATA` badge must be visible anywhere mock results are shown, including the Drawer.

## Data layer

Create `src/lib/api.ts` as the only data access layer. Expose `createAnalysis`, `getAnalysis` with polling and `reviewFinding`; provide the `USE_MOCK` switch within that layer. Components must not import mock JSON or call fetch directly. Keep mock and real response shapes identical and validate incoming data against the backend schema where appropriate.

Real mode submits multipart `before[]` and `after[]`, polls the returned ID, stops at `done`/`failed`, and PATCHes review decisions. Handle cancellation, stale requests and sanitized errors. Mock mode is explicit: use truthful demo states rather than fake percentages, and clearly separate local demo review persistence from real results. Never silently fall back to mock after an API error.

## Build order

1. New Analysis: separate ДО/ПОСЛЕ drop zones, drag-and-drop and picker, multiple files, names/formats, removal, explicit errors for non-PDF/DOCX/XLSX, disabled submit until both sides are present, «Анализировать изменения».
2. Progress: render actual stage states and details. In real mode, state comes only from the job. Show failures; do not generate fake progress percentages.
3. Dashboard: document counts per side and clickable structure-change, loss, duplicate, conflict and transfer cards using the supplied summary. Route cards to an in-scope filtered finding view; for a later screen, retain the selected filter and state that the view is pending, with no dead click. Show warnings, empty states and the demo badge.
4. Evidence Drawer: from every finding, show type, units, linked functions, explanation, recommendation, categorical confidence and review priority. Show BEFORE/AFTER original fragments, document name and locator, quote highlighting, source verification badges and «не подтверждено источником» for unsupported candidates. For possible loss show «Эквивалентная функция не найдена», scoped to the uploaded AFTER set, plus checked count and rejected candidates. Show all supporting AFTER clauses for duplication/conflict. Review buttons «Подтвердить», «Отклонить», «Требует проверки» call `reviewFinding`, persist optional comments and update the card from the successful response. Display failures without falsely changing persisted state.

Frontend makes no similarity, loss, duplicate, conflict, confidence or legal-risk decisions. Filtering existing IDs is rendering; assigning new classifications is backend work. Do not add login, settings, charts or other deferred features.

## Validation and handoff

Run lint, typecheck and build; run relevant existing tests if affected. Manually check the full mock path, unverified rendering, two-sided duplicate/conflict evidence and review persistence. Check the real API path once backend is ready; if unavailable, report it as `NOT RUN`, not passed.

After each screen, append `READY FOR TEST / Feature / URL / Expected / Test cases` to `docs/qa/handoff.md` using the exact multiline format in USER_FLOW. This append-only change is the explicit lane exception; do not rewrite QA's log. Use R12/R13 for upload, R14 for progress, R01/R15 for dashboard, R05–R09/R16/R17 for Drawer. State mock or real mode in Expected. Commit your own work on `lane/frontend` and finish with the shared report format.
