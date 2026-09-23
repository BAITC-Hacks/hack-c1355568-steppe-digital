# API OrgTrace AI — v0.2.0

Источник истины — [Zod-схемы и TypeScript-типы](../../src/shared/contract.ts). [Синтетический пример](../../src/shared/analysis-result.example.json) и frontend mock обновлены синхронно. Backend находится в `backend/`, frontend — в `src/`; это одно Next.js-приложение и один origin.

## Что реализовано

TXT (UTF-8, включая `.docx.txt`), DOCX, PDF с текстовым слоем и XLSX → реальные фрагменты → пункты → alignment → структура и функции положений БВА → lineage → проверки документов → находки → верификация → заключение. Загрузки возвращают `isMock=false`; это означает анализ реальных файлов, а не гарантию полноты или включённого AI. Источники, ограничения и диагностические кандидаты показываются явно.

При настроенных `OPENAI_API_KEY` и `OPENAI_MODEL` pipeline использует embeddings для оставшихся кандидатов и structured chat для существенных/несопоставленных пунктов и их ролей. ID и цитаты проверяются сервером. `ORGTRACE_AI=false` явно отключает AI. Без конфигурации работает детерминированное сравнение с предупреждением; настоящая ошибка включённого AI завершает этап как failed, без fallback в mock. Верификация live provider отдельно от тестов с mock transport.

Ограничения текущего извлечения: структура/владельцы распознаются правилами шаблона положений БВА. Переименования, merge/split и косвенное покрытие функций не устанавливаются уверенно. Исчезнувшее точное название — кандидат удаления, новое — кандидат создания. Lineage использует alignment и текстовый поиск; possible loss и совпадающие обязанности остаются диагностическими (`verified=false`). Включение AI не превращает автоматически эти кандидаты в доказанные потери/дублирование. Проверка конфликта использует интерпретированные роли одного процесса и владельца, требует человеческой оценки.

Основной контроль — `data/samples/before/` и `data/samples/after/`. Редакции 8/9 содержат структуру и обязанности в одном регламенте. DOCX auto-numbering может отсутствовать в mammoth: выдаётся предупреждение, номера не выдумываются. OCR не реализован. Семантический `docType` пока `other`, он не равен расширению.

## Запуск и хранение

Из корня: `npm ci`, `npm run dev`; production: `npm run build`, `npm start`. Нужен Node.js 22.12+. Один долгоживущий процесс, не durable serverless jobs. Runtime читает `.env.local`; ключи не читаются инструментами и не выводятся в UI/логах. Embedding model по умолчанию `text-embedding-3-small`, override — `OPENAI_EMBEDDING_MODEL`.

`ORGTRACE_DATA_DIR` по умолчанию `.data`, `ORGTRACE_CACHE_DIR` — `.cache`. Jobs/review: `.data/jobs/<id>.json`, исходные фрагменты: `.data/fragments/<id>.json`. Записи атомарные, review сериализован внутри процесса. Исходные файлы для скачивания не сохраняются. После restart завершённые результаты сохраняются, прерванные jobs переходят в failed.

Семь этапов старого v0.1.0 несовместимы с новым контрактом: GET старого ID возвращает терминальный failed с предложением загрузить файлы повторно; исходный старый JSON не переписывается. Browser mock имеет новый storage prefix `orgtrace:demo:v2:`. Не подставлять пустые новые массивы в старые результаты как будто анализ уже выполнен.

`NEXT_PUBLIC_USE_MOCK=true` включает отдельный синтетический браузерный пример; false/отсутствие — реальный API. Компоненты обращаются только через `src/lib/api.ts`. `npm run demo:seed` до запуска сервера создаёт отдельный синтетический job для GET/PATCH; он всегда `isMock=true`. Все mock views маркируются `DEMO / MOCK DATA`.

## Endpoints

| Метод | Путь | Запрос | Ответ |
| --- | --- | --- | --- |
| POST | `/api/analyses` | multipart с повторяемыми `before[]` и `after[]`, минимум один файл на сторону | 202 `{ id: string }` |
| GET | `/api/analyses/:id` | ID | 200 `AnalysisJob` |
| PATCH | `/api/analyses/:id/findings/:findingId/review` | JSON `{ status, comment? }` | 200 полный обновлённый `Finding` |

Везде `Cache-Control: no-store`. POST не возвращает результат. Браузер сам устанавливает multipart boundary. Посторонние поля запрещены. Polling после завершения предыдущего запроса, остановка при `done`/`failed`, unmount/смене анализа; ID сохраняется в URL.

```ts
const body = new FormData();
beforeFiles.forEach(file => body.append("before[]", file));
afterFiles.forEach(file => body.append("after[]", file));
const response = await fetch("/api/analyses", { method: "POST", body });
```

`AnalysisJob = { id, status, stages, error?, result? }`. Job statuses: `queued`, `running`, `done`, `failed`. Result только при done. Stage `{ key, label, status, detail? }`, status `pending`, `running`, `done`, `failed`. Ровно десять этапов в порядке:

```text
ingest, clauses, alignment, units, functions, lineage, checks, findings, verify, conclusion
```

Последующие этапы после ошибки остаются pending. Нет фальшивых процентов; быстрый этап может завершиться между poll-запросами. GET failed job возвращает 200, причину смотреть в `error`/`detail`.

Review statuses: `NOT_REVIEWED`, `CONFIRMED`, `REJECTED`, `NEEDS_CHECK`. Comment до 4000 символов; отсутствующий сохраняет прежний, `""` очищает. `updatedAt` — серверное ISO 8601 время. JSON до 32 KiB, дополнительные поля запрещены. Review не меняет evidence verification, confidence, summary или заключение. Ответ — полный Finding, не `{ finding }` и не Job. При неуспехе сохранять последнее подтверждённое состояние UI.

## Форматы и лимиты

| Ограничение | Значение |
| --- | --- |
| Расширения | `.txt`, `.docx`, `.pdf`, `.xlsx`, без учёта регистра |
| Файлы / файл / запрос | 20 / 10 MiB / 25 MiB с multipart overhead |
| PDF | 200 страниц, без OCR |
| XLSX | 10000 строк, 100000 ячеек используемого диапазона |
| Текст / фрагменты на документ | 2000000 символов / 2000 фрагментов, каждый до 12000 символов |
| Сопоставление | До 4000 содержательных пунктов суммарно, иначе явная ошибка |
| Имя | 1–255 символов, без разделителей пути/control characters; уникально на стороне |

Лимиты/пустые стороны проверяются до создания job, ошибки чтения — в ingest после 202. Повреждённый файл даёт warning без частично доверенного текста. Продолжать только при пригодном тексте обеих сторон. Частичный разбор не доказывает потерю.

Ошибки HTTP: `{ error: string }`, безопасный текст. 400 — параметры/пустая форма, 404 — ID, 409 — review до завершения, 413 — лимит, 415 — формат/Content-Type, 500 — внутренняя ошибка. Provider/config failures во время pipeline становятся failed job. Секреты, stack trace и provider payload не возвращаются.

## Объекты v0.2.0

Полное машинно-проверяемое описание и refinements — в `src/shared/contract.ts`; все массивы обязательны. Связи разрешаются внутри результата, стороны проверяются, повторные IDs запрещены.

| Объект | Поля |
| --- | --- |
| `Clause` | `id`, `side`, `documentId`, `number`, `letter?`, `parentNumber?`, `sectionNumber`, `sectionTitle`, `text`, `kind` |
| `ClauseAlignment` | `id`, `beforeClauseId?`, `afterClauseId?`, `status`, `similarity`, `method` |
| `Unit` | `id`, `side`, `name`, `normalizedName`, `kind`, `abbreviation?`, `parentUnitId?`, `parentName?`, `evidence` |
| `OrgFunction` | `id`, `unitId`, `side`, `text`, `action`, `object`, `process`, `role`, `category`, `clauseId`, `evidence` |
| `FunctionLineage` | `id`, `beforeFunctionIds`, `afterFunctionIds`, `status`, `rationale`, `beforeClauseNumber?`, `afterClauseNumber?`, `candidatesChecked` |
| `Finding` | `id`, `type`, `reviewPriority`, `confidence`, `title`, `explanation`, `unitIds`, `functionIds`, `evidence`, `searchTrace?`, `recommendation`, `verified`, `review` |
| `Evidence` | `fragmentId`, `documentName`, `side`, `locator`, `quote`, `fragmentText`, `verified` |
| `DocumentInfo` | `id`, `name`, `side`, `docType`, `fragmentCount`, `warnings` |
| `UnitChange` | `id`, `beforeUnitIds`, `afterUnitIds`, `status`, `rationale`, `evidence` |
| `AnalysisResult` | `id`, `isMock`, `documents`, `summary`, `clauses`, `alignments`, `units`, `unitChanges`, `functions`, `lineage`, `findings`, `conclusion`, `warnings` |

`Clause.kind`: `heading`, `clause`, `item`, `toc`, `empty`. Номер строковый, может быть пустым у ненумерованного текста. Буква не перенумеровывается, повторные номера различаются ID. Оглавление, заголовки и пустые пункты не участвуют в alignment; каждый содержательный пункт участвует ровно один раз. Исходный текст сохраняется.

Alignment statuses: `IDENTICAL`, `COSMETIC`, `SUBSTANTIVE`, `ONLY_BEFORE`, `ONLY_AFTER`. Парные требуют оба ID, односторонние — только соответствующий. Method: `exact`, `fuzzy`, `embedding`, `llm`; similarity 0–1, не вероятность. Нормализованный текст сопоставляется независимо от номера. Косметика не создаёт самостоятельных находок.

Unit kind: `block`, `department`, `position`, `center`. Parent с той же стороны, без циклов. Это структурная принадлежность; дополнительные виды подчинения сохраняются в evidence. Unit statuses: `PRESERVED`, `RENAMED`, `MERGED`, `SPLIT`, `CREATED`, `REMOVED` с кардинальностями 1:1, 1:1, N:1, 1:N, 0:1, 1:0. Последние алгоритмы сейчас консервативно не выводят rename/merge/split без подтверждения.

Function category: `function` / `right`, роль `execute`, `control`, `approve`, `audit`, `support`, `other`. Запреты не извлекаются как разрешения. Lineage: `UNCHANGED`, `TRANSFERRED`, `MODIFIED`, `NEW`, `POSSIBLE_LOSS`. NEW без BEFORE, POSSIBLE_LOSS без AFTER. При множественных функциях UI берёт все номера через `clauseId`. Перенос с изменениями остаётся TRANSFERRED.

Finding types: `LOSS`, `DUPLICATION`, `CONFLICT`, `REORGANIZATION`, `SCOPE_CHANGE`, `BROKEN_REFERENCE`, `UNDEFINED_ROLE`, `AMBIGUITY`. Документные дефекты могут не иметь function/unit IDs. Priority `HIGH`, `MEDIUM`, `LOW` — очередь проверки: потеря права MEDIUM, функции HIGH. Confidence `high`, `medium`, `low` — не процент. Новые находки изначально NEEDS_CHECK; зависимые от неоднозначных заголовков не выше medium.

`locator = { page?, section?, row?, label }`: страницы/строки с единицы; section, например `5.5.8` или `2.3.3 д`. `fragmentText` берётся из registry, не из LLM. Quote проверяется до публикации; verified finding требует все verified evidence. `searchTrace = { checkedCount, topCandidates: { functionId, reason }[] }`. Отсутствие эквивалента — ограниченный поиск, не вымышленная цитата ПОСЛЕ.

## Счётчики и заключение

`summary.unitsByStatus` — отношения изменения, не численность; `functionsByStatus` — lineage records; `findingsByType` — только verified findings; `alignmentsByStatus` — записи сравнения (пара считается один раз). Все enum-ключи обязательны, включая нули. Схема сверяет счётчики с массивами. Диагностические LOSS видны в UI отдельно даже при нулевом подтверждённом счётчике.

Conclusion sections: `orgChanges`, `functionPreservation`, `possibleLosses`, `duplication`, `conflicts`, `needsHumanReview`; `{ key, title, text, findingIds }`. Только verified IDs; отсутствие вывода не означает отсутствие риска. Заключение сейчас детерминированное, не свободная генерация LLM. Постоянная подпись UI: «Выводы носят рекомендательный характер и требуют проверки ответственным сотрудником».

## Проверка и интеграция QA

`runAnalysis({ id, files, onStage? })` из `backend/pipeline.ts`, файлы `{ name, side, bytes: Uint8Array }`. ID — ASCII буквы/цифры/дефисы. Возвращает schema-valid Result, сохраняет fragments, jobs не создаёт. Для изолированных проверок задать временный `ORGTRACE_DATA_DIR`, `ORGTRACE_AI=false`.

Команды: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`. Контроль основной пары проверяет перенумерацию прав, создание/сохранение департаментов, передачу 5.4.4 → 5.3.3, пустой пункт, TOC и дефекты ссылок/роли/группового заголовка. Mock provider tests не подтверждают доступность live OpenAI и не измеряют экспертную точность всех интерпретаций.
