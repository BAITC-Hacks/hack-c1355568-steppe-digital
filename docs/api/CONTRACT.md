# OrgTrace AI API contract — v0.1.0

Backend-owned integration guide for the frontend and QA. Update this file in the same change as any API/schema modification. The executable source of truth is [`src/shared/contract.ts`](../../src/shared/contract.ts); use its exported Zod schemas and inferred types. The complete synthetic result is [`src/shared/analysis-result.example.json`](../../src/shared/analysis-result.example.json). Product behavior remains in [`USER_FLOW.md`](../product/USER_FLOW.md).

## What works in this scaffold

- Root Next.js app; all three API routes below run in the Node runtime.
- Real DOCX, text-layer PDF and XLSX ingestion with stable fragment IDs and clause/page/sheet-row locators.
- Actual queued/running/done/failed job state; disk persistence, restart failure recovery and persisted human review.
- Complete shared schemas, reference/count validation and a synthetic example for frontend development.
- Cached structured-chat and embeddings helpers, quote validation and bounded retries, ready for the next pipeline task.

**Semantic analysis is not implemented yet.** `units`, `functions`, `lineage` and `findings` run explicit no-op stubs. An upload produces real document metadata but empty semantic arrays, zero counts, `isMock=true`, a prominent warning and limitation-only conclusion text. `docType` is currently `other`; file extension and semantic document classification are different concepts. A completed stub job means parsing and scaffold execution finished, not that AI found no risks. No AI calls occur during the current upload pipeline. The future real extraction/matching/finding stages must remove mock status only after they are implemented and verified.

## Run and prepare integration data

Use Node.js 22.12 or newer and npm. The lockfile is committed.

```sh
npm ci
npm run demo:seed
npm run dev
```

`demo:seed` is optional; run it **before starting the server**, using the same data directory. It prints a new analysis ID and `finding-loss`, which allow GET/PATCH integration without waiting for semantic analysis. A server already running has an in-memory store; restart it after seeding. This is a synthetic completed example, always `isMock=true`; it is never attached to uploaded documents. Demo stage details explicitly say that they were prepopulated, not executed.

Production smoke: `npm run build`, then `npm start`. Default URL: `http://localhost:3000`. All routes are same-origin; no authentication or cross-origin setup is provided in this local hackathon scaffold. Use a single long-running Next.js process; durable serverless execution and multi-process shared storage are not supported.

For future AI stages, the user sets `OPENAI_API_KEY` and `OPENAI_MODEL` locally using `.env.example` as the template. Next.js reads runtime environment variables; do not expose keys to browser code, tools or logs. `OPENAI_EMBEDDING_MODEL` defaults to `text-embedding-3-small`. The upload scaffold and demo seed do not require a key. Model/account access has not been verified by this scaffold.

Optional server-only paths: `ORGTRACE_DATA_DIR` (default `.data`) and `ORGTRACE_CACHE_DIR` (default `.cache`). They are not API fields. Keep generated storage outside tracked source. Jobs and reviews live in `.data/jobs/<id>.json`; original extracted fragments live in `.data/fragments/<id>.json`. Source files are parsed in memory and are not retained as downloadable originals.

The frontend baseline now uses `NEXT_PUBLIC_USE_MOCK=true` for its explicit synthetic browser demo; missing/false uses the real API. This public flag is documented in `.env.example`. Restart development or rebuild production when changing it. It is independent of the server result's `isMock`: the real API still returns labeled stub results in this scaffold. The frontend screens from `main` are retained when merging this backend baseline.

## Endpoints

| Method | Path | Successful response |
| --- | --- | --- |
| POST | `/api/analyses` | 202, `{ "id": "<analysis UUID>" }` |
| GET | `/api/analyses/:id` | 200, `AnalysisJob` |
| PATCH | `/api/analyses/:id/findings/:findingId/review` | 200, the updated `Finding` |

Every response uses `Cache-Control: no-store`. There is no list/delete endpoint, SSE, percentage progress or separate result URL. POST does not return a result. Keep the returned ID in UI routing/state so polling can resume after reload.

### Create analysis

Request: `multipart/form-data`, with one or more files in **each** repeated field `before[]` and `after[]`. Brackets are literal. Only these fields are accepted; unknown fields and text values produce 400. The browser must set the multipart boundary itself.

```ts
const body = new FormData();
for (const file of beforeFiles) body.append("before[]", file);
for (const file of afterFiles) body.append("after[]", file);
const response = await fetch("/api/analyses", { method: "POST", body });
if (!response.ok) throw new Error((await response.json()).error);
const { id } = CreateAnalysisResponseSchema.parse(await response.json());
```

Equivalent manual request (substitute actual file paths):

```sh
curl -X POST http://localhost:3000/api/analyses \
  -F 'before[]=@/absolute/path/before.docx' \
  -F 'after[]=@/absolute/path/after.xlsx'
```

Validation happens before job creation for missing sides, extensions, empty files and upload limits. Corrupt supported files and textless PDFs are detected asynchronously during `ingest`; POST may already have returned 202. A failed analysis is subsequently returned by GET with HTTP 200 and `status="failed"`.

Initial limits (conservative defaults; real organizer data is still unavailable):

| Limit | Value |
| --- | --- |
| Extensions, case-insensitive | `.pdf`, `.docx`, `.xlsx` only; not `.doc`/`.xls` |
| Files across both sides | 20 |
| Individual file | 10 MiB |
| Entire multipart request, including boundary overhead | 25 MiB |
| PDF | 200 pages |
| XLSX across sheets | 10,000 rows; 100,000 cells within declared used ranges |
| Extracted text per document | 2,000,000 characters |
| Fragments per document / characters per fragment | 2,000 / 12,000 |
| File name | 1–255 characters; no path separators or control characters; unique within a side |

Long fragments are split and retain their locator; no silent document truncation. Corrupt files yield warnings and no partial fragments. Continue only if both sides still have readable text; otherwise fail. A scanned/empty PDF page produces a warning; no OCR is implied. These limits are for the local prototype, not a sandbox for arbitrary hostile Office archives.

### Poll analysis

```ts
const response = await fetch(`/api/analyses/${encodeURIComponent(id)}`, {
  cache: "no-store",
  signal,
});
if (!response.ok) throw new Error((await response.json()).error);
const job = AnalysisJobSchema.parse(await response.json());
```

Poll approximately every second after the previous request finishes. Stop on `done`, `failed`, unmount or an analysis switch. Abort old requests and ignore stale responses. Polling/transport belongs in frontend's `src/lib/api.ts`. Do not replace a failed real API call with mock data.

`AnalysisJob` fields:

| Field | Type / behavior |
| --- | --- |
| `id` | Analysis UUID |
| `status` | `queued`, `running`, `done`, `failed` |
| `stages` | Exactly seven ordered stages; see below |
| `error?` | Human-readable sanitized error for a failed job |
| `result?` | `AnalysisResult`, present only for `done`; its ID equals the job ID |

A stage is `{ key, label, status, detail? }`; `status` is `pending`, `running`, `done` or `failed`. Order: `ingest`, `units`, `functions`, `lineage`, `findings`, `verify`, `conclusion`. Labels/details are Russian. Initial stages are pending; the active stage is running; completed work is done. After a failure, later stages remain pending. Fast stages may complete between polls—do not manufacture intermediate progress. On process restart, queued/running persisted jobs become failed with a resubmission message; completed results/reviews survive.

### Review a finding

Request JSON, `Content-Type: application/json`:

```json
{ "status": "NEEDS_CHECK", "comment": "Проверить передачу функции по приказу" }
```

Allowed statuses: `NOT_REVIEWED`, `CONFIRMED`, `REJECTED`, `NEEDS_CHECK`. `comment` is optional, at most 4,000 characters. Omit it to preserve the previous comment; send `""` to clear it. Extra fields, including `verified` and `updatedAt`, are rejected. JSON body limit: 32 KiB.

Response is the full updated `Finding`, **not** an `AnalysisJob` and not `{ finding: ... }`. `review.updatedAt` is a server-generated ISO 8601 timestamp. Replace the corresponding cached finding/card with the response. Review is persisted before success is returned. It never changes `verified`, confidence, summary counts or analysis text; it records the employee's decision separately. No automatic conclusion regeneration occurs on PATCH. Concurrent writes are serialized within the single server process; the last completed update to the same finding wins.

Review buttons: «Подтвердить» → `CONFIRMED`; «Отклонить» → `REJECTED`; «Требует проверки» → `NEEDS_CHECK`. Disable duplicate submissions while pending and keep the last persisted state if the request fails.

## Error contract

Non-2xx API responses have exactly `{ "error": "<sanitized message>" }`. Do not branch on the localized string; use HTTP status. Next.js may produce its own 405 response for unsupported methods. No API keys, raw provider responses or server stack traces are returned by these handlers.

| Status | Meaning |
| --- | --- |
| 400 | Missing/empty side or file; invalid fields, names, JSON or review status |
| 404 | Unknown analysis or finding ID |
| 409 | Attempted review before the job completed successfully |
| 413 | Upload/request size or count limit exceeded |
| 415 | Unsupported extension or wrong Content-Type |
| 500 | Unexpected handler/storage failure |

Parser limits and unreadable sides discovered after 202 are **job failures**, not a new HTTP response from POST; inspect `job.error` and stage details. Internal LLM helpers also distinguish configuration/provider failures (503/502), but no current route invokes them. GET of a failed job still returns 200.

## Result objects and enum meanings

Import types with `import type { AnalysisJob, AnalysisResult, Finding, ReviewInput } from "@/shared/contract"`; runtime schemas use the same names with `Schema` appended. All fields are camelCase. Arrays are always present, possibly empty. IDs other than analysis IDs are opaque nonempty strings, not necessarily UUIDs.

| Object | Fields |
| --- | --- |
| `AnalysisResult` | `id`, `isMock`, `documents`, `summary`, `units`, `unitChanges`, `functions`, `lineage`, `findings`, `conclusion`, `warnings` |
| `DocumentInfo` | `id`, `name`, `side`, `docType`, `fragmentCount`, `warnings` |
| `Evidence` | `fragmentId`, `documentName`, `side`, `locator`, `quote`, `fragmentText`, `verified` |
| `Unit` | `id`, `side`, `name`, `normalizedName`, `parentName?`, `evidence` |
| `UnitChange` | `id`, `beforeUnitIds`, `afterUnitIds`, `status`, `rationale`, `evidence` |
| `OrgFunction` | `id`, `unitId`, `side`, `text`, `action`, `object`, `process`, `role`, `evidence` |
| `FunctionLineage` | `id`, `beforeFunctionIds`, `afterFunctionIds`, `status`, `rationale`, `candidatesChecked` |
| `Finding` | `id`, `type`, `reviewPriority`, `confidence`, `title`, `explanation`, `unitIds`, `functionIds`, `evidence`, `searchTrace?`, `recommendation`, `verified`, `review` |
| `Conclusion` | `sections: { key, title, text, findingIds }[]` |

`side`: `before | after`. `docType`: `structure | regulation | job_description | order | other`.

Unit statuses: `PRESERVED`, `RENAMED`, `MERGED`, `SPLIT`, `CREATED`, `REMOVED`. Their BEFORE/AFTER relationship cardinalities are 1:1, 1:1, many:1, 1:many, 0:1 and 1:0 respectively. `transformed` is only a UI grouping of rename/merge/split.

Function lineage: `UNCHANGED`, `TRANSFERRED`, `MODIFIED`, `NEW`, `POSSIBLE_LOSS`. New has no BEFORE function IDs; possible loss has no AFTER IDs. Other relationships have both sides. Candidate entries are `{ functionId, reason }` pointing to AFTER functions. Duplication/conflict filters operate on finding references, not invented lineage enums.

Finding types: `LOSS`, `DUPLICATION`, `CONFLICT`, `REORGANIZATION`. `reviewPriority`: `HIGH | MEDIUM | LOW`, a review order, not legal severity. `confidence`: `high | medium | low`, never a percentage. Role: `execute | control | approve | audit | support | other`; the planned conflict rule is execute plus control/approve/audit in the same unit and process. It is not implemented in this scaffold.

`searchTrace` is `{ checkedCount, topCandidates: { functionId, reason }[] }`. Possible loss needs a verified BEFORE source and trace of the uploaded AFTER search, not an invented quote proving absence. A `verified=true` finding requires all its evidence verified; a verified LOSS also requires BEFORE evidence and search trace. Frontend displays these flags and does not recompute them.

`locator` is `{ page?, section?, row?, label }`. Pages and rows are one-based; `section` preserves the original clause label; `label` includes the sheet name for Excel. DOCX page numbers are not synthesized. `fragmentText` is original extracted text; `quote` is highlighted within it. Match whitespace/case/typographic quote variants for display without modifying the source or deciding verification. Text extraction is not layout-preserving PDF/Office rendering.

## Counts, conclusion and mock behavior

`summary.unitsByStatus` has all six unit-status keys and counts change relationships (one merge = one record). `summary.functionsByStatus` has all five lineage keys and counts lineage records. `summary.findingsByType` has all four finding types and counts verified findings only. Every bucket exists, including zeros. Distinct unit/function totals come from the respective arrays. Filtering already-returned values is UI work; classifying or recomputing business decisions is not.

Conclusion section keys, in order: `orgChanges`, `functionPreservation`, `possibleLosses`, `duplication`, `conflicts`, `needsHumanReview`. Any referenced finding must exist and be verified. In this scaffold the conclusion only states that analysis is unavailable. Always show «Выводы носят рекомендательный характер и требуют проверки ответственным сотрудником».

When `isMock=true`, persistently display `DEMO / MOCK DATA` across all result views and the Evidence Drawer. Both the parsed scaffold result and seeded example are mock, for different reasons explained in warnings. Never label either as real AI output. The frontend's `USE_MOCK` switch belongs in `src/lib/api.ts`; components must not import example/mock JSON directly.

## Validation and next handoff

Backend checks: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`. Tests include schema/reference/count checks, real parsers, quote normalization, corrupted input, actual API handlers, persisted reviews, restart recovery, and mocked AI cache/retry behavior. Live provider access and organizer-data quality are separate checks and remain unverified.

Frontend can start against the shared example now, use the seeded job for real GET/PATCH, and use real uploads for POST/polling/error integration. No change to `src/lib/api.ts` is made by backend. QA can generate DOCX with the installed `docx` dev dependency and XLSX with `xlsx`; `pdf-lib` is available for parser test fixtures. Future QA scripts remain QA-owned.

QA evaluation interface: `runAnalysis({ id, files, onStage? })` from `src/server/pipeline.ts`; `files` contains `{ name, side, bytes: Uint8Array }`. `id` must be nonempty ASCII letters/digits/hyphens; prefer a UUID. `onStage` is an optional async callback receiving `Stage`. The function persists fragments, returns a validated `AnalysisResult`, and throws sanitized errors; it does not create a job itself. `executeAnalysis` supplies job lifecycle handling. Set `ORGTRACE_DATA_DIR` to an isolated temporary directory for tests. Evaluation must refuse to count current `isMock=true` results as real detection.

Next backend task: real evidence-backed unit/function extraction, then matching/lineage/findings/conclusion according to PLAN. Keep the existing contract stable or document a coordinated version change here and in the shared schemas. This scaffold does not yet satisfy the case's full audit demonstration.

Implementation references: [Next.js after](https://nextjs.org/docs/app/api-reference/functions/after), [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [OpenAI embeddings](https://developers.openai.com/api/docs/guides/embeddings).

## Frontend integration check — 2026-09-23

The frontend contribution from commit `6c6eeda` was merged while preserving its layout, page, components and adapter. Its existing mock passes `AnalysisResultSchema`; the requested runtime/type exports and JSON import support are available. The public mock-mode flag is now in `.env.example`.

Backend tests, backend-scoped lint, merged-app typecheck and production build pass. HTTP checks exercised all three routes with synthetic DOCX/PDF/XLSX uploads and confirmed review persistence across a real production-server restart. No live OpenAI requests or organizer-data evaluation were run.

Full-repository `npm run lint` exits 1 for two issues in frontend-owned `src/components/analysis-workspace.tsx`, preserved from the incoming contribution:

- Line 21: `react-hooks/set-state-in-effect` for synchronous URL-to-state initialization in the mount effect. Frontend should choose a URL state integration compatible with its navigation and server-rendering behavior.
- Line 42: `@next/next/no-html-link-for-pages` for the brand anchor to `/`. Frontend should use Next.js navigation while preserving its intended reset behavior.

These are requests for the frontend lane, not disabled checks or a claim of passing repository-wide lint. Browser interaction acceptance and the four screen handoffs remain frontend/QA work. The backend API scaffold is ready for integration; full audit functionality still requires the semantic stages described above.
