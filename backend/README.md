# OrgTrace AI backend

Server implementation lives in this directory. The frontend remains under `src/`, with shared browser-safe Zod schemas in `src/shared/contract.ts`. This is still one Next.js application, one root package and one origin; the directory move does not introduce a second service or change API URLs.

| File | Responsibility |
| --- | --- |
| `handlers.ts` | POST analysis, GET job, PATCH review handlers |
| `http.ts` | Bounded request parsing and sanitized responses |
| `ingest.ts` | DOCX/PDF/XLSX parsers, fragments and locators |
| `pipeline.ts` | Real ingestion and explicitly labeled semantic stubs |
| `store.ts` | Serialized in-memory job store backed by atomic JSON writes |
| `llm.ts` | Cached structured chat/embeddings and bounded retries |
| `files.ts`, `errors.ts`, `stages.ts` | Storage, safe errors and stage metadata |
| `seed-demo.ts` | Explicit synthetic result for GET/PATCH integration |
| `*.test.ts` | Parser, API, persistence and cache tests |

`src/app/api/**/route.ts` contains only Next.js route exports and runtime configuration. These thin adapters import `@backend/handlers`. Server internals use `@backend/*` or relative imports; frontend components must never import them. Shared types remain at `@/shared/contract` to preserve existing frontend imports.

From the repository root: `npm ci`, optionally `npm run demo:seed` before starting the server, then `npm run dev`. Validation: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`. Do not run a separate install or server from this directory.

The API specification and current functionality/limitations are maintained in [docs/api/CONTRACT.md](../docs/api/CONTRACT.md). QA imports `runAnalysis` from `backend/pipeline.ts`; its signature and all HTTP contracts are unchanged. No old `src/server` compatibility shim is required by the currently tracked frontend or QA code.

Storage stays at root `.data/` and `.cache/`, or the server-only directory overrides. Secrets stay in root `.env.local`, never in browser code or this directory. The semantic analysis stages remain stubs; a successful parse is not an AI audit.
