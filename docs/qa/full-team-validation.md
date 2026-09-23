# Full team validation

Publication note: committed at the user's subsequent request as participant 3's QA contribution on lane/qa-integration, based on 3da12ec. The observations below describe the earlier review snapshots (QA e65ca00 and remote 7716615), not a fresh review of the integrated checkout. In particular, missing-runtime and ignore-rule observations refer to that earlier QA checkout. No runtime checks were repeated for this documentation commit.

Date: 2026-09-23. Mode: REVIEW ONLY. No implementation, dependency, prompt, requirement, commit, push, merge or rebase changes were made by this review. This is the only review-created file.

## Verdict and evidence boundary

The mandatory AI audit demo is not ready. Current QA checkout cannot start: package.json, node_modules, src/shared/contract.ts and src/app/api are absent. The fetched backend exists, but its semantic pipeline explicitly returns empty arrays, zero counts and isMock=true. Parsing success is not finding detection or a working audit E2E.

Runtime acceptance is BLOCKED, not TESTED_FAIL. No application tests, browser E2E, HTTP calls or live AI calls were executed. Static implementation findings below are not runtime passes. Remote documentation claims 27 passing tests and browser checks; these are contributor-reported results, not reproduced evidence from this review.

## Repository snapshot and contributions

Initial branch: lane/qa at 31812e0. Initial status: `## lane/qa` and `?? eval/synthetic/`. During review an external actor committed that dataset as e65ca00; this reviewer did not create that commit. Its diff contains only the four previously untracked synthetic files. Final inspected QA snapshot: e65ca00. Backend/frontend integration snapshot: 7716615, shared by origin/main and origin/lane/backend. No branch was checked out or integrated during review.

| Contributor area | Inspected commits / branches | Scope |
| --- | --- | --- |
| Frontend — Aldiyar Dyussenov | 6c6eeda; source in lane/qa, integration diff through 7716615 | Upload, workspace/dashboard, evidence drawer, transport, mock |
| Backend/AI — Aibar | 69a85a5, ae00e16, efe587f, final 7716615 on origin/lane/backend and origin/main | Final remote source, contracts, handlers, parsers, persistence, LLM helpers, test source; history/diffs for preceding commits |
| QA — Pumpishop | 1724e99, d9becb0, 31812e0, e65ca00 on lane/qa | Matrix, private-source setup, gold baseline, synthetic oracle and inputs |

Available branches at review end:

```text
codex/qa-readme                         d9becb0
codex/test-empty-commit                a943330
lane/qa                               e65ca00 (current)
main                                  befc0e3
origin/HEAD -> origin/main
origin/codex/test-empty-commit         a943330
origin/lane/backend                   7716615
origin/main                           7716615
```

Current-branch graph captured after the external synthetic commit:

```text
* e65ca00 test: add synthetic evaluation dataset
* 31812e0 test: add manual gold baseline
*   befc0e3 Merge remote-tracking branch 'origin/main' into lane/qa
|\
| * 6c6eeda feat(frontend): prepare upload, progress, dashboard and evidence review
* | d9becb0 docs: add local evaluation source setup
* | 1724e99 docs: add QA requirements matrix
|/
* cec2621 docs: add OrgTrace AI hackathon plan and lane prompts
* 9c4a946 Create requirements-matrix.md
* d8ac37b initial commit
*   8479f7a Merge pull request #1
|\
| * a943330 chore: test GitHub push
|/
* 73de53c chore: init
* 81fd11b Initial commit
```

Remote participant work is available and was read with git show/diff/log. It was not silently merged. The QA gold/synthetic commits are not in the fetched origin/main snapshot. User's explicit no-merge instruction takes precedence over the repository's routine pull-before-task rule.

## Architecture fit

| Area | Target | Actual | Status | Recommendation |
| --- | --- | --- | --- | --- |
| Runtime | Working upload-to-audit demo | QA checkout lacks runtime; remote has one Next.js app | PARTIAL | Integrate an approved snapshot before runtime acceptance |
| Upload / parsing | BEFORE/AFTER, Word/PDF/Excel | Remote DOCX/text-PDF/XLSX parsers, bounded upload, warnings | PARTIAL | Run existing parser and upload tests; no DOC/XLS/OCR claim |
| Source blocks | Preserve text, document, side, locator | Hash-derived document/fragment IDs; disk fragment registry | FIT | Retain this simple design; runtime validation pending |
| Units / functions | Extract owner, action, object, role and scope | Schema only; semantic arrays empty | GAP | Implement minimal grounded extraction |
| Matching / global recheck | Semantic continuity and full AFTER search before loss | No matcher or recheck | GAP | Match meaning/owner/scope; record actual search coverage |
| Findings | Separate loss, duplication and conflict rules | Types exist; no detection | GAP | Implement distinct evidence-backed rules |
| Evidence gate | Validate against original source registry | Schema checks quote within supplied fragmentText, not authoritative registry | PARTIAL | Resolve IDs/text/locators server-side before validation |
| Human review | Persist employee decision separately | Remote PATCH/store; frontend buttons | FIT | Reproduce persistence; keep verified unchanged |
| Conclusion | Grounded analytical sections | Remote limitation-only sections; UI does not render conclusion | GAP | Generate from validated findings and render sections |
| Cache / fallback | Bounded calls, no silent mock substitution | LLM helpers cached/retried; not called by pipeline | PARTIAL | Wire into actual stages; do not infer live AI readiness |
| CONTEXT / external compliance | Optional expansion | No context field; multipart rejects unknown fields | NOT_NEEDED_FOR_MVP | Do not block submission on this |
| Enterprise infrastructure | Not needed for local hackathon | Single-process JSON store | NOT_NEEDED_FOR_MVP | Keep; no database/framework rewrite |

## Frontend inventory

Paths are repository-relative. Unless qualified, files exist in both QA and remote snapshots. IMPLEMENTED means present in code, never runtime acceptance. Every row: actually runtime tested = No (BLOCKED by current checkout).

| Feature | Status | File / component | Endpoint / data dependency |
| --- | --- | --- | --- |
| BEFORE upload | IMPLEMENTED | src/components/upload-form.tsx / UploadForm, FileZone | createAnalysis before[] |
| AFTER upload | IMPLEMENTED | same | createAnalysis after[] |
| CONTEXT | MISSING | no component | unsupported optional field |
| Multiple files | IMPLEMENTED | FileZone | repeated multipart fields |
| File validation / invalid state | PARTIAL | FileZone; src/lib/api.ts | extension/nonempty checks; no client count/size/name parity |
| Analyze action | IMPLEMENTED | UploadForm; AnalysisWorkspace.submit | POST /api/analyses -> {id} |
| Loading / progress | IMPLEMENTED | AnalysisWorkspace; getAnalysis | GET job stages/status; polling |
| Results dashboard | IMPLEMENTED | analysis-workspace.tsx / Dashboard | result.summary, findings, documents, warnings |
| Structure diff | MISSING | no structure table | unitChanges not rendered |
| Function diff | MISSING | transfer filter displays planned-feature placeholder | lineage not rendered |
| Loss finding presentation | PARTIAL | Dashboard; EvidenceDrawer | LOSS, evidence, searchTrace; backend detection absent |
| Duplicate presentation | PARTIAL | Dashboard; EvidenceDrawer | DUPLICATION; backend detection absent |
| Conflict presentation | PARTIAL | Dashboard; EvidenceDrawer | CONFLICT; backend detection absent |
| Evidence / source view | IMPLEMENTED | evidence-drawer.tsx / Source; quote-range.ts | finding/function evidence |
| Document / section / fragment | IMPLEMENTED | Source | documentName, locator, fragmentText, quote |
| Human review | IMPLEMENTED | EvidenceDrawer.save; reviewFinding | PATCH -> full Finding |
| Analytical conclusion | MISSING | no conclusion renderer | result.conclusion.sections ignored |
| Empty state | IMPLEMENTED | Dashboard | empty category warning; no absence-of-risk claim |
| API error state | IMPLEMENTED | src/lib/api.ts; AnalysisWorkspace | non-2xx mapping, job.error, retry |

No frontend business logic was found that decides real loss/duplication/conflict. It renders server counts and statuses; filtering/highlighting is presentation. USE_MOCK explicitly selects pre-authored data and localStorage; real request errors do not silently switch to mock. Remote 7716615 corrects server-mock storage wording and stale job display; QA checkout still has the older UI.

## Backend inventory at 7716615

All rows are static; runtime tested = No. No functional backend is present in QA HEAD.

| Capability | Status | Implementation / limitation |
| --- | --- | --- |
| PDF | IMPLEMENTED | backend/ingest.ts: pdfjs text extraction, page locator, textless-page warnings; no OCR |
| DOCX | IMPLEMENTED | backend/ingest.ts: mammoth raw text, clause/paragraph locator; complex layout unverified |
| XLSX | IMPLEMENTED | backend/ingest.ts: sheet name + actual row; formatted cell text joined with tabs |
| Source locators / raw text | IMPLEMENTED | Fragment in ingest.ts; persisted by pipeline.ts; no downloadable original endpoint |
| Org unit extraction | MISSING | pipeline.ts units stub; UnitSchema is not extraction |
| Function extraction / owner | MISSING | pipeline.ts functions stub; OrgFunctionSchema defines unitId |
| Action/object/role/scope | PARTIAL | contract.ts action, object, process, role; no extracted values or explicit scope field |
| Structured validation / stable schema | IMPLEMENTED | src/shared/contract.ts strict Zod objects, enums, cardinalities, references, counts |
| Preserved / renamed / transformed | MISSING | UnitStatusSchema enums only; no matching algorithm |
| Created / removed | MISSING | enums only; rename-vs-removed+created risk unresolved |
| Unchanged / transferred / modified / new | MISSING | FunctionLineageSchema only; lineage stub |
| Partial function coverage | MISSING | no dedicated enum or matching logic; parser warnings are different |
| Possible loss / global recheck | MISSING | findings stub; searchTrace schema does not perform a search |
| Duplication | MISSING | no action/object/role/scope overlap rule |
| Conflict | MISSING | no separate incompatible-role rule |
| Evidence / quote / locator | PARTIAL | EvidenceSchema + shared/quote.ts; no production claim-to-registry validation |
| Evidence integrity | PARTIAL | rejects empty/unverified finding evidence and bad quote inclusion; does not prove citation supports claim or require two distinct AFTER owners for duplication/conflict |
| Report | MISSING | pipeline.ts creates six limitation-only sections |
| Review status / persistence | IMPLEMENTED | handlers.ts, store.ts: strict input, timestamp, serialized writes, restart recovery |
| Caching / bounded retries | IMPLEMENTED | llm.ts; structuredChat/embed not called by runAnalysis |
| Safe failure / fallback | IMPLEMENTED | errors.ts, http.ts, pipeline.ts; explicit failed jobs and labeled stubs |

Conclusion validation checks referenced finding IDs, but permits arbitrary section text with empty findingIds. It is not sufficient to prevent invented narrative once real generation is added. Likewise quote membership in supplied fragmentText does not establish provenance. These are static gaps, not demonstrated exploitation or fabricated current findings: current pipeline emits no semantic findings.

## Integration contract and mismatches

Remote route adapters under src/app/api/analyses use backend/handlers.ts and Node runtime. This is one app, not separate frontend/backend servers.

| Contract | Frontend expectation | Remote implementation | Assessment |
| --- | --- | --- | --- |
| POST /api/analyses | multipart before[] / after[]; {id} | 202 {id}; other fields rejected | Static match |
| GET /api/analyses/:id | AnalysisJob; done/failed terminal | 200 job, including failed jobs | Static match |
| PATCH /api/analyses/:id/findings/:findingId/review | JSON status/comment -> full Finding | full Finding; server updatedAt; 4000-char comment | Static match |
| Job / stage enums | queued/running/done/failed; pending/running/done/failed | shared Zod definitions | Static match |
| Finding / review enums | LOSS/DUPLICATION/CONFLICT/REORGANIZATION; four review states | shared definitions | Static match |
| Evidence fields | fragmentId, documentName, side, locator, quote, fragmentText, verified | same contract | Static match, provenance incomplete |
| Errors | status-based localized message; failed job.error | sanitized {error}; 400/404/409/413/415/500; asynchronous parse failures | Compatible; some detail discarded by UI |

| Mismatch | Frontend | Backend | Impact | Priority |
| --- | --- | --- | --- | --- |
| QA snapshot dependency gap | imports ../shared/contract and calls APIs | files exist only in fetched remote snapshot | Current checkout cannot run | P0 |
| Completed audit expectation | result dashboard consumes findings/counts | done + isMock=true + empty findings | No mandatory AI demo despite successful parsing | P0 |
| Required result views | no structure/function/conclusion renderer | schema offers unitChanges/lineage/conclusion | Required outputs unavailable in UI even after future backend completion | P1 |
| Citation trust boundary | renders verified source badge | quote checked against supplied text, not source registry | Future unsupported claim could be presented as verified | P1 |
| Upload acceptance | allows same name with different size/mtime; no limits | same-side names unique, 20 files, 10 MiB/file, 25 MiB/request | Server rejection after client accepts selection | P2 |
| QA mock wording | any isMock says browser-only storage | API mock review is persisted server-side | Misleading persistence wording; fixed remotely at 7716615 | P2 |
| QA review comment limit | no textarea maxLength | rejects >4000 characters | Avoidable 400; fixed remotely | P2 |

No confirmed remote POST/GET/PATCH shape or enum mismatch was found. Browser/HTTP verification remains BLOCKED.

## Requirement traceability

| Requirement | Implementation | Test status | Evidence | Gap |
| --- | --- | --- | --- | --- |
| REQ-01/02 upload BEFORE/AFTER | UploadForm + remote handlers | BLOCKED | source read; runtime absent locally | Integrate then run |
| REQ-03/04/05 formats | remote ingest.ts | IMPLEMENTED_NOT_TESTED | parser source and ingest.test.ts | PDF/DOCX/XLSX application results not reproduced |
| REQ-06/07/08 units | schemas only | MISSING | pipeline.ts empty units/changes | Extraction and mapping |
| REQ-09 function comparison | schemas only | MISSING | empty functions/lineage | Semantic matching and UI |
| REQ-10 loss | no detector | MISSING | findings stub | Full AFTER recheck |
| REQ-11 duplication | no detector | MISSING | findings stub | Paired evidence and role/scope comparison |
| REQ-12/13 conflict | no detector | MISSING | findings stub | Distinct conflict logic |
| REQ-14/15/19 citations / traceability | fragments, schema, drawer | PARTIAL | ingest.ts, contract.ts, EvidenceDrawer | End-to-end source registry validation |
| REQ-16 conclusion | limitation placeholders; no view | MISSING | pipeline.ts; Dashboard | Grounded generation and rendering |
| REQ-17 advisory wording | footer, warnings, mock badges | IMPLEMENTED_NOT_TESTED | analysis-workspace.tsx | Browser verification |
| REQ-18 no unsupported findings | no claims in stub; partial guards | PARTIAL | contract.ts | Provenance and narrative gate before real output |
| REQ-20 working prototype | remote scaffold only | BLOCKED | no local manifest; semantic stubs remotely | Mandatory audit E2E unavailable |
| REQ-21 interface | partial screens | PARTIAL | frontend inventory | Structure/function/conclusion |
| REQ-22 repository | three participants visible | TESTED_PASS | executed fetch/log/tree checks | Shared delivery snapshot still needed |
| REQ-23 README | two-line repository description | MISSING | README.md | Required launch/evaluation instructions |
| REQ-24 architecture | PLAN, remote backend README/API guide | PARTIAL | source/document comparison | Root README absent; stale handoff/data notes |
| REQ-25 known control cases | six synthetic expected cases | BLOCKED | DOCX XML inspection; no actual pipeline output | Execute semantic E2E and check contents |
| OPT-01..04 | no implementation inspected | MISSING | current code scope | Optional; does not block submission |

## QA, synthetic and real gold review

Matrix statuses remain TODO; planned Test IDs are not execution results. No invented accuracy/pass rate or false application PASS was found in the inspected QA artifacts. No tests or bug-report runner exists in QA HEAD. Remote test source covers parsers, schema/quotes, API routes, storage and mocked LLM/cache, including frontend adapter integration with mocked fetch/Next after. Those tests are not browser E2E or live AI validation.

Synthetic inputs were opened read-only through ZIP/XML: before.docx has 11 body paragraphs; after.docx has 12. Source text supports S01 continuity inference, S02 semantic preservation, S03 scoped possible loss of procurement-procedure control, S04/S05 unchanged functions, and S06 same-role overlap at AFTER 3.2 and 4.1. Rename remains an inference, not an explicit legal order. No new test files were created. This is artifact inspection, not application parsing.

Expected data are in eval/synthetic/expected/expected-results.md; input files are in eval/synthetic/inputs/. No oracle was sent to any pipeline. No actual output exists from this review, so all S01-S06 application comparisons are BLOCKED. There is no synthetic positive conflict case. PDF/XLSX are not exercised by these DOCX fixtures.

Gold baseline eval/gold/manual-baseline.md identifies its limitations and excludes ambiguous cases from mandatory positives. G13 is unresolved duplication; G26/G27/G30 are insufficient-data cases; G29 is narrowed explicit reporting detail, not proven total loss. G23 is a documented potential-conflict scenario, not evidence of a breach. No positive real-document loss is asserted. Do not force these to PASS.

Read-only SHA-256 calculation matched all three private DOCX hashes recorded in the gold baseline. The entire gold interpretation was not independently rederived from those real documents in this review; matching hashes confirms source identity, not every semantic claim. Real gold application comparison is BLOCKED for the same runtime and semantic-stage reasons.

## README and repository hygiene

Root README.md contains only the repository name and a generic team description, including on the remote tree inspected. It lacks the problem/user, inputs/outputs, architecture, AI versus deterministic responsibilities, API, environment variables, local launch, formats, limitations, evaluation and actual tested results. Remote backend/README.md and docs/api/CONTRACT.md provide substantial startup/API/architecture/stub information but are not linked from the root README. Fresh-user reproducibility is incomplete.

DATA_NOTES.md remains an unfilled template despite available private source documents. FRONTEND_HANDOFF.md still describes missing backend publication, now outdated relative to origin/main (but accurate for the older QA checkout). The remote API guide's stated 27 tests/build/browser passes were not independently rerun; do not treat them as review passes or accuse them of fabrication without evidence.

HEAD .gitignore contains only eval/source-docs/private/. Actual check-ignore returned 1 for .env.local: current QA branch does not ignore it. Remote .gitignore already protects .env*, storage, cache, dependencies and build output, while allowing placeholder-only .env.example. Do not create credentials on the old checkout before integration.

Tracked-path checks found no private source DOCX or actual environment file in the inspected heads. HEAD tracks the two intentional synthetic DOCX fixtures; these are useful fixtures, not private inputs or unnecessary binaries. Remote tracks .env.example with empty key/model values and a nonsecret model default. Reachable-history filename checks found no .env, .env.local or private-source paths. A limited common-key/private-key pattern scan of tracked code/docs at both heads found zero matching files; it is not a complete historical secret audit. No secret values or .env.local contents were read or printed.

## Commands and actual results

All shell commands ran in the repository root. Read-only commands were batched; grouped rows describe the actual invocations and arguments, not suggested commands.

| Command / check executed | Exit code | PASS/FAIL | Notes |
| --- | --- | --- | --- |
| git fetch --all --prune | 0 | PASS | Discovered origin/lane/backend and updated origin/main |
| git branch --show-current; git status --short --branch; git branch -a; git log --oneline --decorate --graph -20 | 0 | PASS | Captured initial state; repeated status/graph after concurrent commit |
| git branch -avv; git log --all --oneline --decorate -15; git log --all --format='%h %an %s' -15 | 0 | PASS | Branch/author attribution |
| git ls-tree -r --name-only origin/lane/backend; git diff --stat HEAD origin/main; git diff HEAD origin/main -- src/components src/lib | 0 | PASS | Compared remote implementation without checkout |
| git show origin/main:<path> | 0 | PASS | package.json; backend README/pipeline/ingest/llm/handlers/http/store/errors/files and six test files; shared contract/quote; route adapters; API contract; ignore/env example |
| rg --files with lockfile, office and env exclusions; Get-Content; Get-ChildItem; Test-Path | 0 | PASS | Inventoried local code/docs/oracles and confirmed absent runtime files |
| git diff --stat 31812e0 HEAD; git diff 31812e0 e65ca00 -- eval/synthetic/README.md eval/synthetic/expected/expected-results.md | 0 | PASS | Inspected externally added dataset commit |
| .NET ZipFile.OpenRead + XML body paragraph extraction | 0 | PASS | Both synthetic inputs readable; 11/12 paragraphs |
| Get-FileHash -Algorithm SHA256 on private DOCX | 0 | PASS | Three hashes match baseline |
| git ls-files / git ls-tree tracked env, private and binary path checks | 0 | PASS | No actual env/private documents; synthetic fixtures intentional |
| In-memory common credential-pattern scan via git show at HEAD and origin/main | 0 | PASS | Zero matching files; limited patterns/current snapshots only |
| git log --all --format= --name-only -- .env .env.local eval/source-docs/private/* | 0 | PASS | No matching paths returned |
| git check-ignore eval/source-docs/private/probe.docx | 0 | PASS | Private source path ignored |
| git check-ignore .env.local | 1 | FAIL | Not ignored in QA HEAD; remote fix already exists |
| git diff --check | 0 | PASS | No tracked whitespace errors; not an application test |
| npm test; npm run lint; npm run typecheck; npm run build | NOT RUN | BLOCKED | Scripts exist remotely, not in current checkout; no manifest/dependencies locally |
| npm run dev / npm start; browser/HTTP E2E | NOT RUN | BLOCKED | No current runnable app; no checkout/merge or code-writing workaround authorized |
| pytest | NOT RUN | BLOCKED | No pytest configuration, Python application or existing pytest command found |
| Synthetic and real gold application evaluation | NOT RUN | BLOCKED | No runnable semantic pipeline |

An initial tool orchestration attempt for the ZIP/security checks failed with a JavaScript SyntaxError before shell execution; the corrected read-only command above succeeded. No application test failed or passed during this review. The failed ignore check is a repository hygiene finding, not a detection-test result. No npm command was fabricated or launched against a missing manifest.

## Mandatory blockers and minimum fixes

| Priority | Blocker | Minimum requested fix / owner |
| --- | --- | --- |
| P0 | No runnable combined QA checkout | Integration owner: explicitly authorize and combine remote baseline with QA artifacts, preserving all contributions |
| P0 | Units/functions/matching/risks are stubs | Backend: implement a small real slice covering the known control set with evidence; keep incomplete stages labeled |
| P1 | Source verification does not bind claims to registry; narrative gate incomplete | Backend: authoritative fragment lookup, side/locator checks, paired evidence, full AFTER search, conclusion only from validated claims |
| P1 | Required comparisons and conclusion invisible | Frontend: minimal tables and conclusion sections using existing contract |
| P1 | No reproduced semantic E2E or usable root README | QA: run integration and content acceptance on approved snapshot; document actual commands/results and limits |

The stale QA ignore rules require care before creating local credentials; the remote fix already exists. Other P2 UX differences are not blockers to the mandatory demo and do not justify broad refactoring.

## Defer architectural improvements

Keep the single Next.js process, filesystem store, simple polling and existing Zod contract for the hackathon. Defer databases, queues, agent frameworks, generalized infrastructure, OCR/legacy formats beyond confirmed inputs, regulatory CONTEXT, benchmarking and export. Better clause segmentation and richer scope modeling can follow measured evidence failures; do not rebuild working pieces preemptively.

## Ordered lane requests

Backend: Fix grounded extraction and matching first -> Integrate with existing API/schema -> Test the control cases and evidence gate -> Next: conclusion. Separate duplication from conflict; loss needs a real full-AFTER recheck.

Frontend: Fix missing structure/function/conclusion views -> Integrate with server result objects -> Test real upload/result/evidence/review/reload -> Next: P2 upload/error polish. Never move detector logic into UI.

QA: Fix the reproducible review/run baseline with the integration owner -> Integrate the existing oracle artifacts without exposing them to AI inputs -> Test existing commands, then synthetic and high-confidence real cases -> Next: publish honest README/results. Do not change expected data after seeing output.

## Demo boundary

May show: the repository/source architecture and clearly labeled expected datasets; after an actual runnable verification, an explicitly labeled mock interaction and parser scaffold demonstration. This review did not validate those runtime demonstrations.

Must not show as working: real AI reorganization/function/risk detection, validated analytical conclusions, a passing upload-to-audit E2E, measured accuracy/pass rate, or broad Word/PDF/Excel support. Never describe seeded/mock findings as detections from uploaded documents.

## Exactly five next actions

1. Obtain integration authorization and prepare one runnable snapshot containing 7716615 plus QA gold/synthetic work; reproduce existing test/lint/typecheck/build commands.
2. Backend implements grounded unit/function extraction and semantic continuity for the small control set, then integrates and tests that slice.
3. Backend implements loss with full AFTER recheck, role/scope-aware duplication, distinct conflict logic, authoritative evidence validation and grounded conclusion; integrate and test before moving on.
4. Frontend renders structure/function comparisons and conclusion using the shared contract, then verifies upload -> results -> evidence -> review/reload against the real API.
5. QA runs synthetic S01-S06 and high-confidence gold checks with inputs only, records actual outputs separately, and completes the root README with reproducible commands, real results and limitations.

## Final worktree state

Final observed status on lane/qa at e65ca00:

```text
## lane/qa
?? docs/qa/full-team-validation.md
?? docs/qa/team-state.md
```

team-state.md appeared concurrently and was not created, edited or removed by this reviewer. The only reviewer-created file is full-team-validation.md. Final branch listing matches the inventory above; git diff --check returned 0 and git diff --name-only was empty (both untracked files are outside that tracked diff). No commits, pushes, merges, rebases, fixes or dependency installations were performed. Stop after delivering the review.
