# Frontend task 02 — comparison and conclusion views

Base: GitHub main 7716615. Lane: lane/frontend.

## Delivered

- Structure comparison displays all contract statuses and many-to-many unit names, parent names, rationales and sources.
- Function comparison displays server lineage, owning units, process and role, source fragments and checked candidates. A separate disclosure lists all extracted functions, including those without lineage.
- Search and status filters have explicit empty states. Summary values come from the server. The transfer metric opens the TRANSFERRED filter instead of a placeholder.
- Conclusion renders the six server sections and opens verified linked findings in the existing review drawer. Current human review status is shown separately; review edits do not rewrite the conclusion.
- A modal source viewer reuses the existing quote-highlighting renderer, distinguishes BEFORE/AFTER and unverified evidence, and supports Escape.
- Synthetic results retain DEMO / MOCK DATA labels. Empty semantic results do not imply absence of risk.

## Changed files

- src/components/result-views.tsx (new)
- src/components/analysis-workspace.tsx
- src/components/evidence-drawer.tsx (export shared Source renderer)
- src/app/globals.css
- docs/product/FRONTEND_HANDOFF.md

## Verification

- npm run typecheck — exit 0.
- npm run lint — exit 0.
- npm test — exit 0; 27 existing tests passed.
- npm run build — exit 0.
- git diff --check — exit 0.
- Browser: server-seeded synthetic result, structure table, paired source quotes, Escape dismissal, function table, search empty state, conclusion-to-finding navigation, and saving NEEDS_CHECK were exercised successfully. Screenshot reviewed for desktop layout.
- Dependencies were reused from the existing local checkout; no dependency/configuration changes. Clean dependency installation was NOT RUN.
- Real AI extraction and full real-document end-to-end acceptance were NOT RUN: backend semantic pipeline remains stubbed.

## Backend / QA requests

No contract changes required for these screens. Backend should populate units, unitChanges, functions, lineage and evidence using actual documents. QA should exercise every structural/function status using the full frontend mock, review persistence after restart, keyboard focus, and real upload-to-conclusion once semantic processing exists.

## Limits

UI filters and selected section are session state and reset on reload; the analysis ID remains in the URL. Sources are extracted fragments, not original PDF/Word viewers. Conclusion text is server-owned and is not regenerated after review. No export feature was added.
