# OrgTrace AI — frontend product specification

## Outcome and scope

Build a Russian-language interface for an employee checking organizational changes. The shortest valuable path is Finding → Function → Source → original document fragment. Every conclusion is advisory; speed and clarity of human verification matter more than polished AI prose.

Documentation is English. Preserve Russian UI copy and exact English contract identifiers. Read `docs/case/case.txt`, `docs/plan/PLAN.md` and backend's `src/shared/contract.ts`. Backend owns matching, statuses, counts, priorities, confidence and all other business decisions.

## User flow

«Создать анализ» → upload documents ДО → upload documents ПОСЛЕ → «Анализировать изменения» → real stage progress → dashboard → structure changes → function changes → risks → select a risk → inspect original document clauses → «Подтвердить» / «Отклонить» / «Требует проверки» → final conclusion.

Keep navigation compact: one analysis workspace with views and a shared Drawer is sufficient. Analysis IDs survive reload and polling stops at terminal job states. Preserve selected filters when opening and closing evidence.

## Screens in build order

| Order / screen | Required behavior |
| --- | --- |
| 1. New Analysis | Two clearly separated drop zones ДО / ПОСЛЕ; drag-and-drop and file picker; multiple files; show name and format; allow removal. Accept only `.pdf`, `.docx`, `.xlsx`; reject other types with a clear Russian error. Distinguish file format from backend's semantic `docType`. Require a file on each side before enabling «Анализировать изменения». Show server upload errors without losing the selected list unnecessarily. |
| 2. Progress | List `AnalysisJob.stages` in server order, using actual `pending`, `running`, `done`, `failed` states. Labels: «Загрузка и разбор», «Подразделения», «Функции», «Связи функций», «Замечания», «Проверка источников», «Заключение». Show `detail` and sanitized failures. No fake percentages or timer-driven success. |
| 3. Dashboard | Document counts per side; cards for structure changes, possible losses, duplications, conflicts and transferred functions. Cards open the matching filtered view. Use server summary fields and documented count semantics; a merge is one relationship, not a headcount. Display warnings and an empty state. Show `DEMO / MOCK DATA` prominently whenever `isMock=true`. |
| 4. Evidence Drawer | Highest interaction priority: open from every finding and allow inspection and human review using the specification below. |
| 5. Structure Diff | Two-column BEFORE → AFTER table with unit names, status badges, rationale and evidence links. Support all six unit statuses and empty sides for created/removed units. No graph visualization. `transformed` groups `RENAMED`, `MERGED`, `SPLIT` only in the UI. |
| 6. Function Diff / Function Lineage | Table with BEFORE function, AFTER function, lineage status and evidence link. Filters: All / Loss / Duplicates / Conflicts / Transferred / Modified / New, rendered with Russian labels. Duplicates and Conflicts select functions referenced by corresponding findings; they are not lineage statuses. Many-to-many relationships display all linked functions. |
| 7. Conclusion | Six sections: organizational changes, function preservation, possible losses, duplication, conflicts, needs human review. Render server text and links to finding IDs; clicking a link opens its evidence. Persistent caption: «Выводы носят рекомендательный характер и требуют проверки ответственным сотрудником». PDF export only if time remains. |

Screens 1–4 are the first frontend task; screens 5–7 are the next task. In the first task, cards may filter a findings list or show a selected-filter placeholder for a later view; no dead clicks or invented results. Finish the full flow before the final MVP gate.

## Evidence Drawer specification

Show finding type, title, `reviewPriority`, categorical `confidence`, current human review state, involved units, linked functions, explanation and recommendation. Present priority as order of review, not legal severity. A confidence label is never a percentage.

Use side-by-side BEFORE and AFTER source panels with clear headings. Each evidence item shows `documentName`, `locator.label`, available page/section/row, and the original `fragmentText`; highlight the supported `quote` inside that text. If one side has no evidence, state why rather than inventing content. For duplication or conflicts, show all relevant AFTER clauses, even when both belong in the same side panel. Users must be able to follow a function reference to its source fragment without searching the document manually.

Use the original fragment returned by the server; do not rewrite it. Match highlights robustly to whitespace/case/quote-character normalization while preserving displayed source text. If highlighting cannot be mapped reliably, show the quote separately and the full unchanged fragment. Highlighting must not create or override a verification decision.

For a `LOSS` finding associated with `POSSIBLE_LOSS`, show the BEFORE clause, then «Эквивалентная функция не найдена» with a qualifier that this refers to the uploaded AFTER documents. Render `searchTrace.checkedCount` and `topCandidates`, with function labels and reasons. Show missing trace or incomplete parsing as a limitation, not as a fabricated zero-result search. Do not invent an AFTER quote proving absence.

Show server-provided verified status per evidence item and per finding: verified badge or «не подтверждено источником». Unverified candidates are visually distinct and not counted as validated findings. A human clicking confirm does not make an invalid quotation verified.

Review buttons map to `CONFIRMED`, `REJECTED`, `NEEDS_CHECK`. Send optional comment and status through `reviewFinding`; disable duplicate submits while pending. Use the successful server response to update the Drawer and the related card. Show failures and preserve the previous persisted state. Display server `updatedAt` when available. Reload must restore the persisted review. The mock adapter may persist local demo review state, clearly separated from real analysis IDs.

## Data access and contract rules

All data flows through `src/lib/api.ts`: `createAnalysis`, `getAnalysis` with polling, and `reviewFinding`. Use a `USE_MOCK` switch inside that layer. Components never import mock JSON directly and never call API endpoints directly. Mock and real branches obey the same shared contract. Do not silently fall back to mock when a real API fails.

Real flow: multipart POST → ID → GET polling → `done` result or `failed` error → PATCH review. Stop polling on terminal states, unmount or analysis switch; prevent overlapping polls and stale responses. Transport polling belongs in the data access layer; components only request and render state.

Frontend renders backend results and applies view filters only. No similarity calculations, loss/duplication/conflict decisions, confidence assignment, role classification or business aggregates in components. Request contract additions from backend. Mock data has `isMock=true` and a persistent `DEMO / MOCK DATA` badge across dashboard, Drawer and any result views; synthetic evidence is not a real AI output.

## Do not build before the MVP works

No login, registration, profiles, theme settings, 3D or draggable organizational charts, AI chat, decorative charts, many pages, mobile layout or complex animations. Function Passport may later expose existing function fields; it must not invent new claims. Optional external comparison needs actual supplied sources.

## QA handoff after every screen

Append an entry to `docs/qa/handoff.md` (the explicit append-only ownership exception). Use actual URLs and test IDs; never claim an unexecuted check passed.

```text
READY FOR TEST
Feature: <screen or behavior>
URL: <actual local URL and analysis ID if needed>
Expected: <visible outcome, including mock/real mode>
Test cases: <R numbers from docs/qa/TEST_PLAN.md>
```

If the test plan does not exist yet, use the reserved R numbers from the QA prompt and state that the full plan is pending. Suggested mapping: New Analysis R12/R13; Progress R14; Dashboard R01/R15; Drawer R05–R09/R16/R17; Structure Diff R01–R03; Function Diff R04–R07; Conclusion R10.
