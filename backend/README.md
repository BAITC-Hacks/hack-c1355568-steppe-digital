# Backend OrgTrace AI

Серверный код расположен здесь, frontend — в `src/`, общая Zod-схема — в `src/shared/contract.ts`. Одно Next.js-приложение, корневой package и один origin. Отдельный сервер или установка зависимостей внутри `backend/` не нужны.

| Файл | Назначение |
| --- | --- |
| `handlers.ts`, `http.ts` | API и ограниченный разбор запросов |
| `ingest.ts` | TXT/DOCX/PDF/XLSX, исходные фрагменты |
| `clauses.ts` | Пункты, подпункты, TOC, exact/fuzzy alignment |
| `semantic.ts` | Опциональные embeddings и LLM, проверка цитат и ролей |
| `regulation.ts` | Структура положений БВА, функции, lineage, checks, findings и сводка |
| `pipeline.ts`, `stages.ts` | Десять реальных этапов и состояние |
| `store.ts`, `files.ts` | Атомарное хранение jobs/review, restart и несовместимость v0.1.0 |
| `llm.ts` | Cache, structured output и ограниченные повторы |
| `seed-demo.ts` | Отдельный явно синтетический пример |
| `*.test.ts` | Парсеры, основная пара, API, UI adapter, состояние, схемы и AI transport |

Запуск из корня: `npm ci`, `npm run dev`. Проверки: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`. API и ограничения реализации: [CONTRACT.md](../docs/api/CONTRACT.md).

Вызовы AI включаются при runtime-конфигурации `OPENAI_API_KEY` и `OPENAI_MODEL`; `ORGTRACE_AI=false` отключает их для воспроизводимых локальных проверок. Без AI сравнение работает с явным предупреждением, возможные потери остаются диагностическими. Не читать/логировать `.env.local` и секреты. UI никогда не импортирует backend-модули.

QA использует `runAnalysis` из `backend/pipeline.ts`; основной набор — `data/samples/before/` и `data/samples/after/`. `.data/` и `.cache/` игнорируются Git. Реальные загрузки не являются mock; это не означает полный смысловой аудит или подтверждение всех кандидатов. Поддержка структуры других шаблонов, DOCX auto-numbering и экспертная разметка остаются ограничениями.
