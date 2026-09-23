# QA task 01 — data notes, control set and evaluation

This prompt is written for a participant who relies on Codex for implementation. Let Codex perform the steps and explain the results in plain English. Do not guess at code changes. Apply `docs/prompts/00_master.md`, output the first-task `CASE DELTA`, pull `main`, and work on `lane/qa`.

You own `tests/fixtures/**`, `eval/**`, `scripts/**`, `docs/qa/**`, `DATA_NOTES.md`, `README.md`. Never edit pipeline, UI, shared contract, dependencies or configuration. Report problems under `Issues for other lanes` in `DATA_NOTES.md`, and request backend/frontend fixes with reproduction steps. All data and API claims require observed results.

## Part 1 — inspect every organizer file

Inspect every file under `data/` read-only and fill `DATA_NOTES.md`. If `data/` or its contents are missing, say so and continue independently with a synthetic control set; do not invent an inventory. Do not inspect `.env.local` or print keys. Use installed parsers/tools; ask backend for missing dependencies.

Record per file: filename, extension, size, BEFORE/AFTER side or unresolved side, semantic document type, language, page/sheet/row/fragment counts where measurable, text-layer/scan status, where unit names/hierarchy and functions live, exact examples of clause numbering quoted from the real text, parser pitfalls and omitted content. Distinguish observations from assumptions. A file inspected unsuccessfully is still inventoried with its error, not silently skipped. Never substitute control-set quotes for organizer quotes. Record all unresolved side/date/version questions for T=0.

## Part 2 — one chat call and one embeddings call

Create `scripts/check-api.ts` using the OpenAI SDK. Make one logical chat request and one logical embeddings request with minimal non-sensitive synthetic input. Select the same non-secret model IDs as backend. Read environment variables only at runtime, without asking Codex to open or print `.env.local`; use the backend-agreed launch mechanism for env loading.

Print only a success marker or sanitized error type per call. Never print keys, environment values, provider response bodies or stack traces containing request details. If config is missing, print its error type without attempting a request. Exit zero only when both checks succeed; nonzero otherwise. Record command and exit code without secrets. Ask backend to expose the agreed script command in package configuration; do not edit it yourself.

## Part 3 — reproducible Russian control set

Create `tests/fixtures/make-control-set.ts`, generating deterministic synthetic documents under `tests/fixtures/control/before/` and `tests/fixtures/control/after/`. Use XLSX organizational structures with explicit rows and DOCX regulations with numbered «Функции» clauses. Mark the set synthetic in its documentation; never present it as organizer data. Use xlsx for sheets and a backend-approved DOCX writer; request the dependency rather than editing `package.json`. Preserve originals in `data/`.

Use these fixed cases and exact wording. Suggested names/locators below become authoritative expected values only after generation and parser inspection verifies the actual files. Create `structure-before.xlsx` and `structure-after.xlsx` with a sheet named `Структура`, header in row 1, unit name in column A and parent in column B. Number the generated rows consistently.

| Case ID | Planted change | Source plan |
| --- | --- | --- |
| `mergeProcurement` | Merge «Отдел закупок» and «Отдел материально-технического обеспечения» into «Департамент закупок и снабжения» | BEFORE structure rows 2 and 3 → AFTER row 2; corresponding numbered clauses retain procurement and supply functions |
| `renameHr` | Rename «Отдел кадров» to «Отдел управления персоналом», retain its personnel-record function | BEFORE row 4 → AFTER row 3; both regulations clause `3.1` |
| `createdDigital` | Create «Отдел цифровизации» with «развитие внутренних цифровых сервисов» | AFTER row 4 and its regulation clause `3.1`; no BEFORE counterpart |
| `removedContracts` | Remove «Отдел договорной работы»; transfer some of its functions to procurement while losing the registry function | BEFORE row 5; absent from AFTER structure; cite both sides of the transferred function |
| `lostRegister` | Possible loss of «ведение реестра договоров» | `before/contracts.docx`, clause `3.1`; no equivalent AFTER clause |
| `duplicatedMonitoring` | «мониторинг исполнения договоров» appears in two AFTER units | `after/procurement-supply.docx` clause `3.3` and `after/finance.docx` clause `3.2` |
| `procurementConflict` | One department both «проводит закупочные процедуры» and «осуществляет контроль соблюдения закупочных процедур» | `after/procurement-supply.docx` clauses `3.1` and `3.4`; same process, roles `execute` and `control` |

Use the following regulation content to keep preservation and transfer verifiable: `before/procurement.docx` clause `3.1` «проводит закупочные процедуры»; `before/supply.docx` clause `3.1` «организует материально-техническое снабжение»; `after/procurement-supply.docx` clause `3.2` repeats that supply function. `before/contracts.docx` clause `3.2` contains «мониторинг исполнения договоров», which transfers to AFTER procurement and is also duplicated in finance. `before/hr.docx` and `after/hr.docx` clause `3.1` contain «ведение кадрового учета». `after/digital.docx` clause `3.1` contains the new digital function. `before/finance.docx` and `after/finance.docx` clause `3.1` contain «формирование финансовой отчетности»; the unchanged «Финансовый отдел» is BEFORE structure row 6 and AFTER row 5. Each regulation explicitly identifies its unit and document side in a synthetic cover/header.

Create `tests/fixtures/control/expected-findings.json` as the control oracle. For every case list `caseId`, expected `type`, named units, relevant function text, and source entries with exact relative document path, `side`, locator (sheet/row or clause) and `quote`. `type` is `REORGANIZATION`, `LOSS`, `DUPLICATION` or `CONFLICT`; also include expected `unitChangeStatus` or `lineageStatus` when relevant. Structural cases are evaluated against `unitChanges` as well as any corresponding reorganization finding; do not force business statuses into finding types.

For `lostRegister`, expected evidence is the exact BEFORE quote; explicitly record no required AFTER source and require search trace rather than an imaginary absence quotation. Duplication requires both AFTER sources. Conflict requires both role clauses in the same unit/process. Reorganization needs original BEFORE/AFTER structure locators wherever those sides exist. For removal, include the transfer lineage check separately from the loss. Verify generated files through the production parsers before trusting the oracle; mismatches are fixture or parser defects, not permission to alter the expected business cases to match wrong output.

Keep a preserved-unit/function negative case and distinct-process or support-role conflict-negative checks in the test plan. Use frontend's rich mock to exercise `SPLIT`; do not claim that a mock proves real pipeline detection. Extra synthetic cases can be added only when necessary for a failing required check, within the current task and time budget.

## Part 4 — evaluate the real pipeline

Create `eval/evaluate.ts`, importing backend's exported `runAnalysis` through its agreed interface. Load the generated BEFORE/AFTER files, run the real pipeline and compare results against the oracle. Ask backend for interface changes if needed; do not patch the pipeline or implement a second analyzer.

Print for every case: `detected: yes/no` and `citationCorrect: yes/no`, plus detection totals, citation totals and extra findings. Match cases by semantic type, unit names/relationship and function text, not unstable generated IDs. Citation correctness requires the expected document, side, exact clause/row, validated quote and appropriate function/unit link. An unrelated genuine quote does not count. Both clauses are required for duplicate/conflict cases. For possible loss, require BEFORE evidence and a real AFTER search trace; never demand a fabricated source for absence.

Show extra findings separately for manual review; do not automatically call all extras false positives or silently omit them. Count one expected case once even if the engine produces multiple matching findings. Exit nonzero for a missed required case, incorrect citation or unusable result; distinguish a pipeline execution error from a semantic miss. `isMock=true` or stub-only output makes real evaluation blocked/failed, never passed. Do not silently substitute mock data or a cached unrelated result. Repeated cached runs must still use source/model/prompt-version-correct results.

Until the real pipeline is available, finish the evaluator and report actual invocation as blocked or failing, without claiming detection. Request backend-owned npm commands for fixture generation, evaluation and API checks; document exact working commands in README after verification.

## Part 5 — QA test plan

Create `docs/qa/TEST_PLAN.md` with prerequisites, exact reproduction steps, expected results, mode (real/mock), actual result, pass/fail/not-run state and evidence for each case. Reserve these IDs so frontend handoffs remain consistent:

| ID | Coverage and acceptance |
| --- | --- |
| R01 | Must have 1: reorganized/retained units and summary/card filtering; validate backend statuses and merge cardinality, not name-only guesses. |
| R02 | Must have 1: created, removed and renamed units; correct sides, locators and evidence. |
| R03 | Split and preserved structures in the UI; state clearly whether coverage is mock-only or from an additional real fixture. |
| R04 | Must have 2: compare functions of both transformed and existing units, including preserved, transferred, modified and new cases where fixtures exist; record missing real coverage. |
| R05 | Must have 2: known possible loss, correct BEFORE quote, actual search trace, scoped wording and no fabricated AFTER citation. |
| R06 | Must have 3: duplication across AFTER units, both exact clauses shown; no duplicate lineage enum. |
| R07 | Must have 3: same-unit, same-process execute/control conflict; reject different-process or execute/support-only pairs. Ask backend for any unit-test coverage outside QA ownership. |
| R08 | Must have 4: every validated finding links to its exact document/side/clause and original fragment, including multiclause findings. |
| R09 | Quote mismatch/unknown fragment: unverified or dropped, visibly unconfirmed if shown, excluded from validated counts/conclusion. |
| R10 | Must have 5: all six conclusion sections, resolvable verified finding links, no invented facts, persistent advisory caption. |
| R11 | Simple solution check: evaluate known reorganization, loss and duplication; print detection and citation results per case plus totals/extras. |
| R12 | Multiple PDF/DOCX/XLSX uploads on both sides via drop and picker; removal; clear rejection of unsupported files in UI and server. |
| R13 | Empty/missing side, corrupted input and textless PDF: truthful errors/warnings; no successful audit of unusable input. |
| R14 | Real pending/running/done/failed stages, stopped polling at terminal state, retry/error view; no fabricated percentages. |
| R15 | Empty result and incomplete-coverage warnings; persistent `DEMO / MOCK DATA`; no silent mock fallback on a real failure. |
| R16 | Review confirm/reject/needs-check and comment via PATCH; card update, reload and process-restart persistence; no change to evidence verification. |
| R17 | Drawer source navigation, highlighted quote in unchanged fragment, both BEFORE/AFTER panels and all AFTER-only duplicate/conflict sources. |
| R18 | README reproducibility and one-command application launch after documented install/env setup; generate control set and run evaluation with documented commands. |
| R19 | Huge input limits, LLM timeout/invalid output, rate limit and missing config produce bounded, sanitized failures; no secret output. |
| R20 | Repository/architecture deliverables reflect the actual root Next.js app, parsers, contract, pipeline, cache and storage; three personal contributions and final submission checklist. |

For R18, distinguish clean-install prerequisites from one-command launch; do not claim a fresh machine needs no dependency or environment setup. If backend scripts are not ready, report the dependency and request them instead of inventing a successful command. For R20, README and architecture documentation are later timeline deliverables; record expectations now and update them during the documentation window rather than claiming completion in this skeleton task.

## Finish and handoff

Run fixture generation and inspect outputs. Run the API check once when configured; run evaluation once the real pipeline is available. Run relevant tests, typecheck and lint through existing root commands. Record exact commands and exit codes; `NOT RUN` with reason is acceptable, a fabricated pass is not.

Log actionable issues in `DATA_NOTES.md` with owner, reproduction, expected/actual behavior and impact. Read frontend's `docs/qa/handoff.md` and record actual test outcomes; do not mistake its example entry for a handoff. Commit your own lane's changes under your own identity and end with the shared task report.
