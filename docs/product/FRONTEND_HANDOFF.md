# Frontend task 01 — implementation and integration status

## Scope

Prepared on `lane/frontend`: New Analysis, server progress, Dashboard and Evidence Drawer. Structure Diff, Function Diff and Conclusion screens are intentionally deferred to the next frontend task. No backend, shared contract, dependencies, root configuration or QA-owned files were created or modified.

The repository currently has no runnable backend baseline, `package.json` or `src/shared/contract.ts`. These source files are **integration pending**, not a running or completed prototype. The user confirmed that another developer owns backend work.

## Integration requests for backend

- Publish the Next.js/React/TypeScript baseline, dependency lockfile and lint/typecheck/build scripts to `main`.
- Publish the authoritative Zod contract. The adapter currently expects runtime exports `AnalysisJobSchema`, `AnalysisResultSchema`, `FindingSchema` and type exports `AnalysisJob`, `AnalysisResult`, `Finding`, `Evidence`. These names are requested integration assumptions, not a claim that these exports exist. Adapt imports to the actual names once published; do not introduce a second schema.
- Enable TypeScript JSON imports. No additional frontend dependency is required.
- Implement the POST, GET and PATCH endpoints and count semantics in PLAN.md. Return sanitized, Russian stage details and errors. UI never renders raw HTTP error bodies.
- Document `NEXT_PUBLIC_USE_MOCK=true` for explicit local demo mode in the backend-owned environment example. Missing/false means real API mode. Changing it requires restarting/rebuilding Next.js. It is a public mode flag, not a secret.
- Reconcile `src/app/layout.tsx` and `src/app/page.tsx` with any minimal bootstrap shell at merge; retain the frontend implementation.

## Files and behavior

- `src/app/layout.tsx`, `page.tsx`, `globals.css`: Russian application shell and styling.
- `src/components/upload-form.tsx`: separate multiple-file lists, picker/drop, extension/empty-file checks, removal, submission guard and retained selections on upload errors.
- `src/components/analysis-workspace.tsx`: URL-persisted analysis ID, actual stage states, server summary cards, filters, warnings, diagnostic/empty states and review response updates.
- `src/components/evidence-drawer.tsx`: native modal dialog with keyboard focus containment and restoration, all paired source clauses, expandable function sources, scoped loss search trace and persisted human review. Closing aborts the request; no optimistic persistence claim.
- `src/components/quote-range.ts`: display-only quote normalization with original character offsets; unmappable quotations remain separately visible. This never changes source verification.
- `src/lib/api.ts`: exclusive transport layer; non-overlapping cancellable polling, terminal stop, shared-schema parsing, multipart upload and review PATCH. No real-error-to-mock fallback. Demo review storage is versioned and keyed per demo analysis; storage failures are explicit.
- `src/mocks/analysis-result.json`: explicitly synthetic Russian example, all six unit statuses, all five lineage statuses, two losses with enumerated synthetic checks, two duplications, one conflict, two verified reorganization findings, one unverified diagnostic and six grounded conclusion sections. Uploaded demo files are never read, sent or described as analyzed. Pre-authored demo stages explicitly state no processing occurred.

## Validation status

- `git diff --check` — exit 0 before staging; repeat after staging.
- `node` inline mock-integrity assertions — exit 0: references, six status cardinalities, literal verified quote inclusion, summary consistency, paired AFTER evidence, loss checked counts and verified conclusion links. This is **not** validation against the missing authoritative schema.
- `node --input-type=module` inline quote-range assertions — exit 0: whitespace/case/typographic quote normalization, Unicode offsets, no-match and empty-quote behavior.
- `npm run lint` — NOT RUN: package manifest, dependencies and lint config absent.
- `npm run typecheck` — NOT RUN: package manifest, TypeScript setup and shared contract absent.
- `npm run build` — NOT RUN: Next.js baseline and shared contract absent.
- Existing relevant tests — NOT RUN: no existing test suite or runner.
- Browser mock path, persisted review reload, cancel/retry races and real API path — NOT RUN: application cannot start before baseline integration.

## Next verification and QA handoff

1. Pull the published backend baseline, reconcile schema import names, run shared-schema validation on the mock and resolve any semantic refinements with backend.
2. Run lint, typecheck, relevant tests and production build.
3. Run the app and verify upload/drop/removal/error retention (R12/R13); actual queued/running/failed stages (R14); dashboard filters/empty state (R01/R15); two-sided evidence, diagnostics, normalized quote highlighting and review/reload/error states (R05–R09/R16/R17).
4. Verify real upload → polling → result → review → reload. Exercise switching analyses and cancelling requests so stale responses cannot replace the active analysis.
5. Append the four exact `READY FOR TEST / Feature / URL / Expected / Test cases` entries to `docs/qa/handoff.md` only once an actual running URL exists. No READY FOR TEST entry has been claimed for an unstartable application. The full QA plan is still pending.

## Blockers

Backend baseline and contract publication block schema validation, runtime checks and honest screen acceptance. Organizer files are not present, so format coverage beyond PDF/DOCX/XLSX and real analysis behavior remain unverified. No push, merge or platform submission is claimed.
