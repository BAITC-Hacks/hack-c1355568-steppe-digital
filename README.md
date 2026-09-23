# OrgTrace AI — финальная сдача v0.2

OrgTrace AI сравнивает организационные документы ДО/ПОСЛЕ: структуру, функции и полномочия, изменения ответственности и возможные риски. Каждая находка сопровождается источниками для проверки сотрудником. Выводы рекомендательные.

**Ветка сдачи: `release/hackathon-final`.** База: `014fd46c2623aeaff6e4101e05f1b6709caf908b`. Проверенный application SHA: `1776156aef950eb04447b8557c5934e9a0d9bbd4`. Между ними добавлен только `docs/product/EXPECTED_ANALYSIS_8_TO_9.md`; финальный packaging commit изменяет только документацию. Точный SHA установленного пакета: `git rev-parse HEAD`.

Старый `release/hackathon-demo` на `29c34a406706c03f3904d989760b31c7175bf439` сохранён как отдельный fallback v0.1.

## Quick start

Node.js >=22.12 и npm; предыдущие проверки выполнены на Node.js 24.19.0. Нужен один длительно работающий Next.js-процесс; отдельная БД и LLM key для проверенного режима не нужны.

```sh
git clone --branch release/hackathon-final https://github.com/BAITC-Hacks/hack-c1355568-steppe-digital.git
cd hack-c1355568-steppe-digital
git rev-parse HEAD
npm ci
```

PowerShell — воспроизведение проверенного deterministic режима:

```powershell
$env:NEXT_PUBLIC_USE_MOCK = "false"
$env:ORGTRACE_AI = "false"
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```

Bash:

```sh
export NEXT_PUBLIC_USE_MOCK=false
export ORGTRACE_AI=false
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```

Откройте `http://127.0.0.1:3000`. Для разработки вместо build/start: `npm run dev`. Команды контроля: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`. Повторный QA при подготовке этого docs-only пакета не запускался.

## Upload → Analyze → Results

1. Загрузите оригинальную редакцию №8 в ДО, №9 в ПОСЛЕ. Оригинальные DOCX предоставляет организатор; private-файлы не включены в submission. Локально команда использует `eval/source-docs/private/`. TXT в `data/samples/` — отдельный набор, не замена проверенным DOCX.
2. Нажмите «Анализировать изменения», дождитесь завершения этапов.
3. Откройте «Структура», «Функции и полномочия», находку и её источники, затем «Заключение».
4. В Evidence Drawer выберите «Подтвердить», «Отклонить» или «Требует проверки» и при необходимости комментарий. Проверка цитаты и решение человека — независимые статусы; review не переписывает заключение автоматически.

Для воспроизводимого контрольного примера загрузите `eval/synthetic/inputs/before.docx` и `eval/synthetic/inputs/after.docx`. Это искусственные входные документы, обработанные настоящим backend (`isMock=false`), не результат AI-анализа реальной организации. Файлы expected/baseline не подаются приложению.

## Возможности v0.2

- Structure Diff: сохранённые, созданные, удалённые и преобразованные сущности; подразделения, должности, центры и блоки.
- Извлечение функций и прав (`category=function/right`), владельцев и исходных пунктов.
- Function Lineage: сохранение, перенос, `MODIFIED`, новые функции и возможные потери.
- Сравнение пунктов и word diff; findings потерь, дублирования, потенциальных конфликтов и дефектов ссылок/ролей/области ответственности.
- Clause-level evidence: документ, сторона, локатор и оригинальный фрагмент. Проверенная цитата не доказывает правильность всей интерпретации.
- Human Review и аналитическое заключение со ссылками на findings; диагностические кандидаты отображаются отдельно.

## Архитектура

`Browser → Next.js API → ingest → clauses → alignment → units → functions → lineage → checks → findings → verify → conclusion → local JSON store → UI`.

Frontend: `src/components/analysis-workspace.tsx`, `result-views.tsx`, `evidence-drawer.tsx`. Backend: `backend/pipeline.ts`, `regulation.ts`, `clauses.ts`, `semantic.ts`, `semantic-pipeline.ts`. Общая Zod-схема v0.2: `src/shared/contract.ts`; jobs и review: `backend/store.ts`, игнорируемая `.data/`.

`POST /api/analyses` принимает multipart `before[]`/`after[]`; `GET /api/analyses/:id` возвращает progress/result; `PATCH /api/analyses/:id/findings/:findingId/review` сохраняет решение. [Контракт API](docs/api/CONTRACT.md). Используйте отдельное хранилище для v0.2; payload v0.1 не взаимозаменяем с v0.2.

## Проверенные результаты и ограничения

На application `1776156`: **46/46 tests, typecheck, lint, build PASS; synthetic S01–S06 PASS; original DOCX 8/9 smoke PASS; browser Results → Finding → Evidence → Conclusion PASS; isMock=false**. Результаты приняты из предыдущей проверки, не получены повторно при packaging.

Оригиналы: fragments 491/490, units 14/24, functions/rights 133/167, lineage 143 (включая 7 MODIFIED). Рост количества сущностей не является оценкой точности.

- Проверенный semantic режим deterministic/rule-based. Опциональный live LLM/embeddings путь не проверялся; не выдавайте этот прогон за LLM-анализ.
- Качество всех diagnostic findings и полнота manual baseline аттестованы лишь частично. Универсальная accuracy не измерялась.
- Ambiguous owners, групповые заголовки, переименования и косвенное покрытие требуют Human Review.
- На оригиналах 16 LOSS-кандидатов и 1 DUPLICATION-кандидат остаются диагностическими; verified LOSS/DUPLICATION/CONFLICT = 0. Отсутствие verified finding не доказывает отсутствие риска.
- DOCX 8/9 проверены smoke; полный semantic E2E PDF/XLSX/TXT и OCR не заявлен. Автоматическая нумерация Word требует внимания к локаторам.
- Сохранение Human Review покрыто тестами API/store; в последнем коротком browser smoke проверено наличие controls, повторная browser-проверка сохранения решения не проводилась.

[Final QA summary](docs/qa/release-final-summary.md) · [Requirements matrix](docs/requirements-matrix.md) · [Demo 3–5 минут](docs/submission/demo-checklist.md) · [Fallback](docs/submission/fallback-demo.md).

Эти submission-документы описывают принятую v0.2 revision. Исторические отчёты и планы других commits не расширяют её проверенное покрытие.
