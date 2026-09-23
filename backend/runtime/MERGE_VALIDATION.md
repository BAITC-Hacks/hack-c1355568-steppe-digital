# Интеграция extraction fix с main

Объединены `a650b24e48c11af4592f10d64bec9b4105526de4` и main `1638fff`. Конфликты `backend/pipeline.ts`, `backend/api.test.ts`, `backend/README.md` разрешены с сохранением действующего контракта v0.2.0 и pipeline БВА. Frontend и shared-контракт взяты из main без дополнительных изменений.

Для корпуса вне шаблона БВА подключён ранее проверенный semantic pipeline с extraction fix. Обязательные поля нового контракта заполнены из реально разобранных пунктов. Проверка evidence охватывает оба формата fragmentId. Выбор fallback выполняется только при отсутствии units во всём корпусе; смешанные шаблоны остаются ограничением.

## Проверки

- `npm test`: PASS, 46/46, exit 0.
- `npm run typecheck`: PASS, exit 0 после исправления типа Map реестра источников.
- `npm run lint`: PASS, exit 0.
- `npm run build`: PASS, exit 0.
- `ORGTRACE_AI=false node --import tsx backend/run-synthetic.ts`: exit 0; S01–S06 PASS (регрессионные assertions в тестах).
- `ORGTRACE_AI=false node --import tsx backend/run-real-extraction.ts`: exit 0.
- Основная TXT-пара также проверяется `backend/regulation.test.ts`: перенумерация прав, переносы, ссылки и неоднозначности — PASS.

## Результат редакций 8/9

Оригинальные Word недоступны. Runner создаёт DOCX-копии неизменённых TXT-экспортов: 492/491 fragments. Это не проверка авто-нумерации и форматирования оригинального DOCX.

| Метрика | ДО | ПОСЛЕ |
| --- | ---: | ---: |
| Units | 14 | 24 |
| Functions | 133 | 167 |

Всего lineage 143, findings 87; verified LOSS 0, `isMock=false`. Изменение чисел относительно предыдущего extraction-отчёта связано с сохранением более широкого pipeline БВА из main: он извлекает должности, права и номинальные функции.

Synthetic: units 2/3, functions 5/5; RENAMED 1, UNCHANGED 4, POSSIBLE_LOSS 1; verified LOSS 1, DUPLICATION 1, CONFLICT 0; `isMock=false`.

## Ограничения

Live LLM и финальный browser E2E: NOT RUN — проверка интеграции выполнена детерминированно, финальный независимый E2E остаётся задачей QA. Исходные Word по-прежнему нужны для отдельной аттестации. Исторические `VALIDATION.md`, `EXTRACTION_VALIDATION.md` и `synthetic-api-output.json` не описывают результат текущей интеграции.
