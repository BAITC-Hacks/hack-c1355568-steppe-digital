# OrgTrace AI — five-hour delivery plan

## Product and authority

OrgTrace AI is an advisory AI reorganization auditor: upload BEFORE/AFTER documents, identify changed units, compare their functions, show what was retained or transferred, flag possible losses, duplication and conflicts, and justify every finding with source clauses. A responsible employee makes the decision.

Team: three people at HackAlem AI, five hours. Read `docs/case/case.txt` in full; it is authoritative and immutable. This plan implements the case rather than replacing it. Documentation and task reports are in English; the product UI and control documents retain the required Russian text.

## Stack and scope

One Next.js App Router + TypeScript app at the repository root. Use Zod, OpenAI SDK for chat and embeddings, mammoth for DOCX, pdfjs-dist for PDF, xlsx (SheetJS) for Excel, Vitest and tsx. Persist JSON under gitignored `.data/`; store LLM cache under gitignored `.cache/`. Compare embeddings in memory using cosine similarity. No database, authentication, Docker, vector database, separate Python backend, agent framework or NVIDIA integration.

Confirm the stack at T=0 after inspecting actual file formats and checking chat and embeddings access. Secrets exist only in `.env.local`; tools and task reports must never read or print that file or its values. The running app reads environment variables; `.env.example` has empty placeholders. Record the selected chat and embedding models in non-secret configuration and README. QA requests any fixture-generation dependency from backend; xlsx can generate XLSX, while DOCX generation requires a backend-approved writer dependency or another reproducible method.

## Repository layout and lanes

| Path | Purpose / owner |
| --- | --- |
| `src/app/api/**` | Thin Next.js route exports to `backend/handlers.ts` / backend |
| `backend/**` | Parsers, LLM client, cache, jobs, pipeline, colocated tests / backend |
| `src/shared/contract.ts` | Zod schemas and inferred types / backend |
| `src/shared/analysis-result.example.json` | Schema-valid example with `isMock=true` / backend |
| `src/app/**` except API, `src/components/**` | Application shell, screens and evidence UI / frontend |
| `src/lib/api.ts`, `src/mocks/**` | Only UI data access layer and labeled mocks / frontend |
| `tests/fixtures/**`, `eval/**`, `scripts/**` | Control set, evaluation and checks / QA |
| `docs/product/**` | Product behavior / frontend |
| `docs/qa/**`, `DATA_NOTES.md`, `README.md` | QA, data inventory, launch instructions and architecture / QA |
| `docs/case/case.txt` | Official scope; never modify |
| `docs/plan/**`, `docs/prompts/**`, `AGENTS.md` | Shared planning package; propose coordinated changes, do not assume lane ownership |
| `data/` | Organizer input; inspect read-only and do not assume its presence or contents |
| `.data/`, `.cache/` | Ignored runtime storage and cache |
| `package.json`, root configuration, dependency lockfile | Stack, scripts, dependencies and tooling / backend |

Server code is grouped in `backend/`; browser-safe schemas remain in `src/shared/`. The folder separation does not change API URLs or introduce a second process.

Branches: `lane/backend`, `lane/frontend`, `lane/qa`. Each participant commits personally. Pull `main` before every task; do not overwrite uncommitted work. Contract changes always go through backend. Two narrow exceptions resolve the supplied workflow: backend creates the initial minimal Next.js shell and publishes the first baseline to `main` before frontend begins; frontend may append handoff entries to QA's log. Thereafter normal ownership applies. Backend tests belong beside backend/shared code, avoiding QA-owned fixtures.

## Pipeline and implementation method

| Stage key | Method | Output and invariant |
| --- | --- | --- |
| `ingest` | Parse DOCX paragraphs, PDF pages and XLSX sheets/rows into source fragments; retain headings and clause numbers | Stable fragment IDs, document identity, `side`, source text and locators; preserve original text |
| `units` | Extract supported names and hierarchy per side; normalize names; match candidates by names, context and evidence with LLM assistance | `Unit[]`, `UnitChange[]`; deterministic code enforces relationship cardinalities and statuses |
| `functions` | Extract action, object, process and role from source text with verbatim quotes; combine evidence across documents | `OrgFunction[]`; no invented ownership or function; preserve all supporting sources |
| `lineage` | Embedding prefilter, in-memory cosine ranking, LLM equivalence/transfer/modification judgment | `FunctionLineage[]`; deterministic assignment and candidate history; no percentage confidence |
| `findings` | Compare AFTER functions across units for duplication; run same-process role conflict rule; derive possible loss and reorganization candidates | `Finding[]`; server assigns types and review order from documented rules |
| `verify` | Resolve fragment IDs and validate quotes, side, document and references; apply verified-evidence gate and recompute counts | Unsupported candidates dropped or visibly `verified=false`; warnings for incomplete coverage |
| `conclusion` | Compose sections only from validated findings, with finding IDs | Advisory `Conclusion`; no new facts or unsupported claims |

Quote validation happens at every extraction/judgment boundary, not only at `verify`. The final verification stage checks the whole result. Backend persists stage transitions while processing; frontend reads those actual states.

### Deterministic business rules

Unit matching describes a relationship, not a name-only diff: `PRESERVED` and `RENAMED` are one-to-one, `MERGED` many-to-one, `SPLIT` one-to-many, `CREATED` zero-to-one, `REMOVED` one-to-zero. An unchanged name alone does not prove unchanged functions. Uncertain matches require warnings and review. `transformed` is a UI grouping of `RENAMED`, `MERGED`, `SPLIT`, never a contract enum.

Function status: `UNCHANGED` for an equivalent function retained by its matched unit; `TRANSFERRED` for an equivalent function moved to another unit; `MODIFIED` for a supported substantive change; `NEW` for an AFTER function without a supported BEFORE counterpart; `POSSIBLE_LOSS` for a BEFORE function without a supported AFTER counterpart in the analyzed corpus. Many-to-many links are allowed in the arrays when evidence supports them. `NEW` has no BEFORE IDs; `POSSIBLE_LOSS` has no AFTER IDs. Do not force ambiguous candidates into a confident link. Duplication and conflict are findings, not lineage statuses.

For conflict detection, each function has `{process, role}`; `role` is `execute | control | approve | audit | support | other`. Within an AFTER unit and the same normalized `process`, an `execute` function combined with `control`, `approve` or `audit` deterministically produces a `CONFLICT` candidate. Cite both functions and explain the rule in its text. The LLM interprets process and role from evidence; code evaluates the combination. This is a potential conflict for human review, not a legal determination. Different processes or `execute + support` alone do not trigger it.

Duplication compares functions between AFTER units, supported by evidence on both sides of the overlap. Do not infer duplication from identical generic wording alone. `LOSS` findings map to `POSSIBLE_LOSS` lineage, supported by the BEFORE clause and a recorded AFTER search. `REORGANIZATION` findings ground structural changes and conclusion text.

Server assigns `reviewPriority` as review order, never legal severity. Initial policy: supported loss and conflict candidates HIGH, duplication MEDIUM, informational reorganization LOW; unverified candidates require source checking and are separated from validated findings. `confidence` is `high | medium | low`, based on evidence completeness and matching ambiguity, never a numeric probability. These policies are explicit and reproducible; the LLM does not own them.

## Full shared contract

All names are camelCase. Backend implements these objects as Zod schemas and exports inferred TypeScript types. `?` means optional; arrays are present even when empty. IDs are stable strings within an analysis. Timestamps use ISO 8601 strings. `warnings[]` contains human-readable strings. References must resolve in the same result.

| Object | Fields |
| --- | --- |
| `Evidence` | `fragmentId: string`, `documentName: string`, `side: "before" | "after"`, `locator: { page?: number, section?: string, row?: number, label: string }`, `quote: string`, `fragmentText: string`, `verified: boolean` |
| `DocumentInfo` | `id: string`, `name: string`, `side: "before" | "after"`, `docType: "structure" | "regulation" | "job_description" | "order" | "other"`, `fragmentCount: number`, `warnings: string[]` |
| `Unit` | `id: string`, `side: "before" | "after"`, `name: string`, `normalizedName: string`, `parentName?: string`, `evidence: Evidence[]` |
| `UnitChange` | `id: string`, `beforeUnitIds: string[]`, `afterUnitIds: string[]`, `status: "PRESERVED" | "RENAMED" | "MERGED" | "SPLIT" | "CREATED" | "REMOVED"`, `rationale: string`, `evidence: Evidence[]` |
| `OrgFunction` | `id: string`, `unitId: string`, `side: "before" | "after"`, `text: string`, `action: string`, `object: string`, `process: string`, `role: "execute" | "control" | "approve" | "audit" | "support" | "other"`, `evidence: Evidence[]` |
| `FunctionLineage` | `id: string`, `beforeFunctionIds: string[]`, `afterFunctionIds: string[]`, `status: "UNCHANGED" | "TRANSFERRED" | "MODIFIED" | "NEW" | "POSSIBLE_LOSS"`, `rationale: string`, `candidatesChecked: { functionId: string, reason: string }[]` |
| `Finding` | `id: string`, `type: "LOSS" | "DUPLICATION" | "CONFLICT" | "REORGANIZATION"`, `reviewPriority: "HIGH" | "MEDIUM" | "LOW"`, `confidence: "high" | "medium" | "low"`, `title: string`, `explanation: string`, `unitIds: string[]`, `functionIds: string[]`, `evidence: Evidence[]`, `searchTrace?: { checkedCount: number, topCandidates: { functionId: string, reason: string }[] }`, `recommendation: string`, `verified: boolean`, `review: { status: "NOT_REVIEWED" | "CONFIRMED" | "REJECTED" | "NEEDS_CHECK", comment?: string, updatedAt?: string }` |
| `Summary` | `unitsByStatus: { PRESERVED: number, RENAMED: number, MERGED: number, SPLIT: number, CREATED: number, REMOVED: number }`, `functionsByStatus: { UNCHANGED: number, TRANSFERRED: number, MODIFIED: number, NEW: number, POSSIBLE_LOSS: number }`, `findingsByType: { LOSS: number, DUPLICATION: number, CONFLICT: number, REORGANIZATION: number }` |
| `Conclusion` | `sections: { key: string, title: string, text: string, findingIds: string[] }[]` |
| `AnalysisResult` | `id: string`, `isMock: boolean`, `documents: DocumentInfo[]`, `summary: Summary`, `units: Unit[]`, `unitChanges: UnitChange[]`, `functions: OrgFunction[]`, `lineage: FunctionLineage[]`, `findings: Finding[]`, `conclusion: Conclusion`, `warnings: string[]` |
| `AnalysisJob` | `id: string`, `status: "queued" | "running" | "done" | "failed"`, `stages: { key: "ingest" | "units" | "functions" | "lineage" | "findings" | "verify" | "conclusion", label: string, status: "pending" | "running" | "done" | "failed", detail?: string }[]`, `error?: string`, `result?: AnalysisResult` |

The prompt did not name the nested summary keys; the keys above are the initial explicit contract decision. Count one unique unit-change relationship per `unitsByStatus` bucket (a merge is one change, not two); one lineage record per `functionsByStatus` bucket; verified findings only per `findingsByType` bucket. Label UI totals as change/comparison records where cardinality could mislead. Distinct source unit/function totals are available from their arrays and must not be confused with these counts. Backend publishes these semantics with the schema; frontend does not reconstruct business aggregates. Each eligible unit/function participates in a consistent relationship, without double counting repeated source mentions.

Conclusion section keys, in order: `orgChanges`, `functionPreservation`, `possibleLosses`, `duplication`, `conflicts`, `needsHumanReview`. Titles and user-visible text are Russian. Each factual section refers only to verified finding IDs. Use evidence-backed reorganization findings to ground preservation summaries too; an empty section states the limits of available findings rather than inventing a conclusion. Excluded unverified candidates remain in diagnostics/warnings for source checking, never as asserted facts. Human review status is displayed separately from source verification and never changes `verified`.

`locator.page` and `locator.row` are one-based. Use `section` for original clause numbers such as `3.2.1` or `п. 5`; `label` includes sheet name and row for Excel. DOCX page numbers must not be fabricated. Keep multiple evidence entries for claims requiring multiple clauses. Store the original fragment registry internally; returned `fragmentText` must come from that registry, not from an LLM.

## API and jobs

| Endpoint | Request | Successful response |
| --- | --- | --- |
| `POST /api/analyses` | Multipart fields `before[]`, `after[]`; at least one supported file per side | HTTP 202, `{ id: string }`; start a persisted job |
| `GET /api/analyses/:id` | Analysis ID | HTTP 200, `AnalysisJob`; frontend polls until `done` or `failed` |
| `PATCH /api/analyses/:id/findings/:findingId/review` | JSON `{ status: "NOT_REVIEWED" | "CONFIRMED" | "REJECTED" | "NEEDS_CHECK", comment?: string }` | HTTP 200, updated `Finding`; persist server timestamp |

Status codes and PATCH response are initial implementation decisions completing the supplied API. Validate all bodies. Return a consistent sanitized `{ error: string }` for invalid requests (400), unknown IDs (404), oversized uploads (413), unsupported media (415), unfinished-job review (409) or unexpected server failures (500). Never echo keys, provider payloads or secrets.

Use Next.js Node runtime for parsing and disk access. The local long-running Next.js process is the hackathon execution target; do not assume durable serverless background jobs. Keep an in-memory job store backed by atomic JSON writes in `.data/`. Persist transitions and reviews. On restart, load completed results and mark interrupted queued/running jobs failed with an actionable message; no silent resume assumption. Concurrent review writes must not discard each other.

Create all seven stages as `pending`. A queued job becomes running when processing starts. Completed work becomes `done`; failed work becomes `failed`, the job receives `error`, and remaining stages stay `pending`. A completed job has all stages `done` and a schema-valid `result`; incomplete stages cannot be called complete. Never generate fake percentages or timer-based stage completion. Stub stages may complete their actual no-op work but must say they are stubs; the result is explicitly mock and not an audit.

## Evidence, AI and caching

Every LLM claim includes `fragmentId` and a verbatim source `quote`, including interpretations used for matching, rationale and role tagging. Where the public object has no evidence field, validate and retain source provenance internally and expose it through its referenced functions/units/findings. Resolve fragment identity server-side; never accept the LLM's invented `fragmentText`, source name, side or locator.

Normalize whitespace, case and typographic quote characters for matching; retain the original quote and source text for display. Empty quotes and unknown IDs fail. Normalized matching is not paraphrase matching: do not use fuzzy similarity to approve quotations. Check that the cited text actually supports the claim as well as being present. Failed claims are dropped or explicitly unverified; a finding requiring two claims is not verified if only one citation validates. Never create verified evidence for unsupported assertions.

Possible loss means no equivalent function was found in the uploaded AFTER corpus. It is not proof of real-world disappearance. Cite the original BEFORE function and display `searchTrace` with actual checked count and top AFTER candidates plus rejection reasons. Store broader candidate checks internally if needed; disclose prefilter and parser coverage limitations. Do not invent an AFTER quotation for an absent function. If relevant files were unreadable, qualify or withhold loss findings and record the gap.

Use structured LLM output and Zod validation. Deterministic code controls state, enums, counts and priority. Cache all chat and embedding calls using a stable hash of operation, exact input, source hashes, model, prompt/schema version and relevant parameters. No cache key includes the API secret. Keep source-containing cache local and ignored. Model/prompt/source changes invalidate the corresponding cache; don't cache failures as successful outputs. Validate cached outputs too. Retries are bounded inside try/catch; rate limits use capped backoff. Log sanitized error types rather than secrets or full source documents.

## Failure matrix

| Failure | Planned behavior |
| --- | --- |
| Scanned PDF without text layer | Emit document warning, no invented text or automatic OCR claim; continue usable files. If a side has no usable text, fail with a request for a text-based replacement. Partial coverage is prominent and cannot substantiate loss. |
| Unsupported or corrupted file | Reject unsupported formats in UI and server; warn and isolate a corrupted supported file. Continue only when both sides retain usable content and disclose omissions; otherwise fail. Never crash the process. |
| Huge document | Set file-count, byte, page/row and fragment limits at T=0 from real data. Reject before expensive processing where possible; chunk accepted content. Never silently truncate and assert complete coverage. |
| Unit name variants | Preserve originals, normalize candidates, use hierarchy and quoted context for matching; expose ambiguous relationships for review. |
| Functions spread across documents | Group by supported unit identity per side, retain multiple citations, deduplicate repeated mentions without erasing provenance. Search all successfully parsed AFTER documents. |
| Quote mismatch | Drop claim or mark evidence and dependent finding unverified; exclude it from validated counts and conclusion; show source-check warning. |
| LLM timeout or invalid output | Bounded retry; validate schema and quotes on every attempt; after exhaustion fail the affected stage with a sanitized actionable error. Preserve job details; never replace real results with mock data silently. |
| Rate limit | Bounded capped backoff, use cache, limit concurrency; after exhaustion mark stage/job failed and explain retry action. |
| Empty upload | Disable submission when either side is empty and return server 400 if bypassed. Empty extracted content is an explicit error/warning, not a successful empty audit. |

## Case coverage and simple solution check

| Official requirement | Pipeline coverage | UI coverage | QA acceptance |
| --- | --- | --- | --- |
| Must have 1: identify reorganized, retained and created units from annexes | `ingest`, `units`, `verify` | Dashboard; Structure Diff with original names and clauses | R01, R02, R03; merge, rename, preserved, created, removed and split examples |
| Must have 2: compare transformed and existing units' functions, detect potential losses | `functions`, `lineage`, `findings`, `verify` | Function Diff; LOSS Evidence Drawer with BEFORE source and search trace | R04, R05; known missing function with qualified wording |
| Must have 3: compare units for duplication and conflicts | `functions`, `findings`, `verify` | Dashboard filters; Function Diff; paired evidence in Drawer | R06, R07; duplicate clauses and same-process incompatible roles |
| Must have 4: source document and relevant fragment/clause for every finding | `ingest`, extraction-time checks, `verify` | Finding → Function → Source → original fragment; verification badge | R08, R09; correct document, side, clause and actual quote |
| Must have 5: clear final analytical conclusion | `conclusion` | Conclusion with finding links and advisory caption | R10; no unsupported claims or broken links |
| Simple solution check: known unit reorganization | `units`, `findings`, `verify` | Structure Diff and Drawer | R11; expected merged units, resulting unit, correct BEFORE and AFTER sources |
| Simple solution check: known lost function | `lineage`, `findings`, `verify` | LOSS Drawer and search trace | R11; detected yes/no and correct BEFORE citation, no fabricated absence citation |
| Simple solution check: known duplicated functions | `findings`, `verify` | DUPLICATION Drawer showing both AFTER units | R11; detected yes/no and both exact source clauses |

R numbers are reserved for the QA prompt's future `docs/qa/TEST_PLAN.md`; that file is not part of this documentation-only package. Also verify the required upload/result interface, source repository, README launch steps and architecture description (R12–R20 below in the QA task).

## Jury criteria and lane contributions

| Official criterion | Points | Backend / AI | Frontend / Product | QA / README / Evaluation |
| --- | --- | --- | --- | --- |
| Compliance with the task and functionality | 25 | All must-have pipeline outputs and real-file support | Complete upload-to-conclusion flow | Requirement mapping, control set, per-case detection and citation checks |
| Technical implementation | 25 | Zod contract, deterministic decisions, AI interpretation, cache and robust jobs | Contract-only rendering, real progress and review persistence | Schema/API checks, failure reproduction, architecture consistency |
| README and reproducibility | 25 | Working root commands and env placeholders | Document main UI scenario | README launch steps, architecture diagram, fixture generation and evaluation commands |
| Value and applicability | 15 | Traceable loss, duplicate and potential-conflict evidence | Fast source inspection and responsible human review | Demonstrate time-saving verification and disclose limits |
| Development potential and originality | 10 | Function lineage and extensible evidence model | Side-by-side evidence, search trace, optional function detail | Explain measured strengths, gaps and grounded next steps |
| Total | 100 | Shared delivery | Shared delivery | Shared delivery |

## Delivery order and WOW priorities

Get all five must haves and the simple solution check working first. Core source access, lineage data and the advisory review flow cannot be postponed as optional merely because their presentation is impressive. Once that baseline works, prioritize polish in this order: (1) side-by-side Evidence Drawer, (2) Function Lineage view, (3) search trace for `POSSIBLE_LOSS`, (4) Human Review, (5) Function Passport using existing function data, (6) comparison with provided regulatory documents if time remains. The first frontend task includes a basic Drawer, trace display and review; the WOW list controls extra polish, not removal of those specified basics.

Basic per-finding recommendations are part of the case output. Advanced redistribution advice, regulatory comparison and benchmarking other operators are optional. Never perform them without suitable source documents. PDF export is optional after the MVP, as are advanced Function Passport details. Do not build login, registration, profiles, theme settings, 3D/draggable org charts, AI chat, decorative charts, many pages, mobile layout or complex animation before the MVP works.

## Timeline

| Minutes | Backend | Frontend | QA / shared gate |
| --- | --- | --- | --- |
| 0–10 | Publish root shell, contract baseline and runnable scripts to `main`; verify API configuration | Pull baseline; inspect schema and start mock-driven flow | Inspect real formats; run one chat and one embeddings check; confirm stack |
| 10–40 | Walking skeleton: real files → fragments; one document → verified functions | Mock upload → progress → dashboard → evidence end to end | Data notes and reproducible control-set preparation |
| 40–45 | Five-minute sync and merge within the 40–100 window | Resolve interface mismatches with backend | Record integration failures and assign by lane |
| 40–100 | Units and matching; real jobs/API | Upload, progress and dashboard on real API | Format, unit and API checks |
| 100–160 | Lineage, loss, duplication and conflict rules | Drawer on real evidence; Structure and Function Diff in next task | Known-case detection and source accuracy |
| 160–210 | Conclusion, persisted review, fix control-set failures | Conclusion and integrated review workflow | Control set passes with correct citations |
| 210–255 | Reliability fixes and architecture details | UX fixes and source-navigation checks | README, architecture diagram, reproducibility and regression |
| 255–300 | Feature freeze; fixes and final verification | Feature freeze; fixes and final verification | Push, submit on platform and confirm receipt; no new features |

The skeleton prompts are first tasks, not permission to implement every future feature immediately. Backend skeleton stubs must be followed by the real function-extraction slice before the T=40 walking-skeleton gate. Do not claim that stub-only output satisfies that gate. Everyone stays in the zone from T=240 to T=300. Preserve all three personal contributions in the submitted repository.

## Scope tensions and their handling

- The case names Word, PDF and Excel generally; this prompt initially accepts only `.docx`, `.pdf`, `.xlsx`. Confirm whether organizer data contains `.doc`, `.xls`, scans or other variants at T=0. Report any gap; do not claim broad support or silently convert/alter originals.
- The case requires traceability for every significant finding; the contract also allows unverified candidates. Treat those as diagnostic candidates, label them clearly and exclude them from validated counts and analytical assertions. Mock verified flags demonstrate UI behavior only, not real AI verification.
- No source clause can prove a function is absent. Use a verified BEFORE clause plus a transparent, scoped AFTER search; phrase the result as possible loss and disclose incomplete parsing.
- The case optionally allows external compliance and operator benchmarking. Defer both until must haves pass; the requested WOW order prioritizes regulatory comparison over any benchmarking. This is scope prioritization, not a case conflict.
- The case specifies an AI agent but mandates no agent framework. The bounded AI-assisted pipeline satisfies that interpretation; demonstrate its actual AI calls and source validation.
- Lane-only editing conflicts with the requested initial root scaffold and frontend handoff append. The two narrow exceptions above make ownership explicit. No blanket cross-lane permission is implied.
- A valid stub API is not a functioning audit. Label stub/mock results and measure the real MVP against the case before claiming completion.

## T=0 open questions from real data

1. What exact file extensions, file counts, sizes, page counts and Excel layouts are present? Are all within `.pdf`, `.docx`, `.xlsx`?
2. Which files belong to BEFORE and AFTER, and how are effective dates and document versions identified?
3. Which annexes contain authoritative structures, functions, hierarchy and renamed/merged units? Are documents complementary or contradictory?
4. Do PDFs have text layers; do DOCX tables and spreadsheets contain functions; what locators and clause numbering appear? Are scans or legacy Office formats blockers?
5. What languages, abbreviations and unit-name variants need preservation and normalization?
6. Is there enough AFTER coverage to assess possible loss, including removed units whose functions were partly transferred?
7. What document limits, chunk sizes and candidate-search limits fit the actual corpus and five-hour budget? How will skipped content be disclosed?
8. Are chat and embedding models available with the provided OpenAI account, and what rate/token limits apply? Record model IDs without keys.
9. Are external regulations or operator datasets actually supplied, and which are authoritative? Keep them optional unless organizers change scope.
10. Can the local demo environment persist `.data/` and run long jobs reliably? What are the submission steps and deadline on the platform?
11. What minimal DOCX writer dependency can backend approve for QA's synthetic fixture generator?
