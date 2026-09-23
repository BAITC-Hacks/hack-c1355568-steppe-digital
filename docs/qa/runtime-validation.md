# Независимая приёмка backend candidate c45e2a3

Дата: 2026-09-23. Проверен exact commit `c45e2a30004154fa093c32b0631e8620ef9cc4e2`, совпадает с fetched `origin/codex/real-semantic-demo`. Изолированный checkout: `codex/qa-c45e2a-acceptance`. Main и исходный checkout не изменялись; stash и чужие отчёты не трогались. Принятый frontend `c9f406e` уже является предком candidate через `0d29565`; дополнительный merge не требовался.

## Scope и команды

Diff candidate к родителю: только восемь файлов внутри `backend/`. `src/shared`, API routes, package.json и lockfile не изменены. Совместимость действующего API подтверждена tests и browser E2E; целевые расширения контракта из PLAN этим не аттестованы.

| Команда (через pnpm dlx npm@10) | Exit | Результат |
| --- | --- | --- |
| npm ci --no-audit --no-fund | 0 | 438 пакетов |
| npm run test | 0 | PASS: 33 теста, 7 файлов |
| npm run typecheck | 0 | PASS |
| npm run lint | 0 | PASS |
| npm run build | 0 | PASS |
| npm run start -- --hostname 127.0.0.1 --port 3105 | работает | Production startup PASS |

Проверялись реальные HTTP POST/GET и UI, а не developer runtime report. Environment/секреты исходного checkout не копировались: deterministic pipeline не требует LLM.

## ACTUAL до EXPECTED

Независимый HTTP runner `.data/qa/http.mjs` загрузил только `eval/synthetic/inputs/before.docx` и `after.docx`. POST 202, GET 200, job `65560b20-b4eb-4500-ae50-93390d4dbaed`, done. ACTUAL сохранён в `.data/qa/synthetic-actual.json` до открытия expected-results; SHA-256 `9A988EAD04F4448C5923E7DE9454CF1A7EFA80243016D8F6D5E7117ED8EB2D8B`. Expected прочитан только после сохранения; приложению не передавался. Developer README содержит заявленные результаты, но они не использованы как доказательство.

ACTUAL: isMock=false, 5 units, 10 functions с владельцами, 3 unitChanges, 5 lineage, 4 findings (2 REORGANIZATION, 1 LOSS, 1 DUPLICATION), 0 CONFLICT. Реальные вычисления без LLM, не stub.

| ID | EXPECTED | ACTUAL / источник | Итог |
| --- | --- | --- | --- |
| S01 | transformed/RENAMED | RENAMED: внутренний контроль → комплаенс и внутренний контроль; B/A §2, сохранённые функции §2.1 и B §2.3 → A §2.2 | PASS |
| S02 | UNCHANGED | UNCHANGED, договорный мониторинг, B/A §2.1, правильные сопоставленные owners | PASS |
| S03 | POSSIBLE_FUNCTION_LOSS | lineage POSSIBLE_LOSS + verified LOSS, закупочный контроль B §2.2, исходный владелец; 5 AFTER-функций всех 3 подразделений проверены | PASS |
| S04 | UNCHANGED | UNCHANGED, корректирующие мероприятия B §2.3 → A §2.2 | PASS |
| S05 | UNCHANGED | UNCHANGED, корпоративные риски B/A §3.1, риск-менеджмент | PASS |
| S06 | POSSIBLE_DUPLICATION | verified DUPLICATION; разные AFTER owners: риск-менеджмент §3.2 и корпоративное управление §4.1 | PASS |

Классификации LOSS/DUPLICATION в контракте описаны как возможные, не доказанная потеря/операционное дублирование. RENAMED — обоснованный кандидат, не доказательство юридического приказа.

## Дополнительные независимые проверки

- `.data/qa/probes.mjs` не меняет исходный synthetic set. Transfer probe добавляет закупочный контроль новому AFTER-владельцу: job `29621144-a243-4247-bad2-09b24d63ad3a`, TRANSFERRED=1, LOSS=0. Подтверждён поиск за пределами соответствующего подразделения. Код дополнительно просматривает все raw AFTER-фрагменты на эквивалент вне распознанных владельцев; сложное перефразирование этим не гарантировано.
- Отдельный conflict probe: job `c53f2f69-599b-405d-9c01-179b6b5bd505`, исполнение и контроль обработки счетов у Отдела расчётов, CONFLICT=1, AFTER §5.1 и §5.2. Это дополнительный искусственный probe, не изменение S01–S06 и не доказательство конфликта в реальных регламентах.
- Evidence integrity PASS для synthetic/probes: проверены fragmentId, document, side, locator, fragmentText, включение quote, разрешимость owner IDs и conclusion findingIds. 51 evidence entry synthetic, 54 transfer, 61 conflict; ошибок нет. Synthetic fragments дополнительно сверены с исходными параграфами `word/document.xml`, не только с реестром парсера. Результат `.data/qa/integrity.json`.
- S01–S06 проверены отдельным `.data/qa/compare.mjs`; результаты `.data/qa/s01-s06-comparison.json`. Evidence owners и пункты дополнительно прочитаны вручную в actual/UI.
- Conclusion PASS на synthetic: текст вычислен из verified findings/счётчиков, без placeholder; все findingIds разрешаются к verified findings. Раздел сохранности использует агрегаты lineage и не имеет прямых findingIds — источник проверяется через Function Lineage.

## Browser E2E

PASS для проверенного synthetic flow: UI upload обоих DOCX → Analyze → Results → заполненные Structure Diff и Function Lineage → LOSS → Evidence (BEFORE §2.2 + AFTER search 5) → DUPLICATION → Evidence (два AFTER owners/пункта) → Conclusion → Human Review. Browser job `40ef709f-2ff9-495e-bfb8-cdec3e365329`. Решение LOSS изменено через UI на CONFIRMED с QA-комментарием, затем отдельным GET подтверждена серверная запись/timestamp; `.data/qa/browser-actual-after-review.json`. Conflict filter и Drawer проверены на отдельном вычисленном conflict-probe. Никакой pre-authored mock не загружался.

## Реальные DOCX №8/№9

Job `014116d1-9cb2-48d0-bb31-529ae003e37d`, POST 202/GET 200/done, isMock=false. Исходники взяты read-only из `../hack-c1355568-steppe-digital/eval/source-docs/private/`, оригиналы не перемещались. ACTUAL `.data/qa/real-actual.json` содержит приватный корпус только в ignored runtime storage.

491 BEFORE + 490 AFTER фрагментов, без падения. Но units=0, functions=0, unitChanges=0, lineage=0, findings=0. Предупреждение явно сообщает нераспознанную структуру. Вымышленного LOSS нет. Traceability реальных semantic findings проверить невозможно: findings не созданы. Итог smoke: **FAIL по требованию непустых semantic arrays**, инфраструктура PASS.

Конкретная причина P0: `backend/semantic-pipeline.ts::extract` распознаёт только явный заголовок подразделения с последующими функциями; `body` обрабатывает буквенный префикс `а)`, но реальные пункты имеют `а. Департамент...`; заголовки обязанностей начинаются с `Директор департамента...` (§5.4/§5.5) и не попадают в regex структурного owner. Нельзя исправить это простым смешением должности и подразделения: необходимо сохранить тип/контекст владельца.

## Финальная приёмка

**NO-GO — P0 BLOCKERS** для финальной приёмки на основном реальном корпусе. Прежний blocker «pipeline полностью stub» снят, synthetic demo и интеграционный UI flow работают. Остаётся P0 извлечения units/functions/owners из реальных редакций 8/9; зависимые matching/findings/conclusion на них не аттестованы. Отсутствие LLM само по себе не является blocker. После исправления повторить real smoke и evidence/owner checks, не менять expected ради прохождения.

Никаких исправлений application code, commit, push или merge в main не выполнено. Созданы этот отчёт и ignored независимые scripts/actual evidence; обновлена только локальная QA-заметка матрицы в изолированном checkout.
