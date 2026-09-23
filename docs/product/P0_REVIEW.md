# Финальный P0 review фронтенда

База: `0d29565`, актуальный `origin/main` при начале проверки. API: действующий контракт `0.1.0`. Проверка выполнена 23.09.2026.

## Минимальные исправления

- Structure Diff: `RENAMED`, `MERGED`, `SPLIT` явно подписаны как «Преобразовано» с сохранением конкретного типа; фильтр `transformed` объединяет только эти три серверных статуса. Нового API enum и вычисления бизнес-статусов нет.
- При пустых `units`, `functions`, `findings` сводка сообщает «Аналитические данные не предоставлены» и «Замечания ещё не сформированы». Нули не представлены как отсутствие рисков.
- Наполненная сводка озаглавлена нейтрально: «Результаты анализа».
- Новые findings, mock-данные, fallback и изменения backend не добавлены.

## Проверенные возможности

| Пункт | Результат |
| --- | --- |
| Structure Diff | ДО/ПОСЛЕ, сохранено, преобразовано (переименование/объединение/разделение), создано, упразднено. Проверены все шесть статусов; transformed показывает три отношения. |
| Function Diff | ДО/ПОСЛЕ, сохранена, передана, изменена, возможная потеря; существующий NEW также отображается. Владельцы и источники доступны. |
| Findings | LOSS, DUPLICATION, CONFLICT открываются; неподтверждённые кандидаты маркируются. |
| Evidence Drawer | Название документа, locator/пункт, оригинальный fragmentText, quote, finding → evidence. У дублирования и конфликта видны обе AFTER-цитаты; у потери — BEFORE и searchTrace. |
| Conclusion | Отдельная вкладка с шестью серверными разделами, выводами и кнопками перехода к соответствующим findings. |
| Review | PATCH из Drawer, NEEDS_CHECK и комментарий сохраняются после reload; verified остаётся отдельным признаком. |

## Browser flow: фактическая граница подтверждения

Режим приложения: `NEXT_PUBLIC_USE_MOCK=false`, настоящий локальный API на `http://127.0.0.1:3107`.

1. Через браузер загружены существующие QA DOCX: `eval/synthetic/inputs/before.docx` и `after.docx`; до выбора обеих сторон Analyze отключён.
2. Analyze → POST → polling → Results прошли. ID: `9ab9151c-6205-4ac3-8f71-a315b5746bf7`.
3. У этого нового результата Structure Diff, Function Diff и Conclusion открываются без падения. Backend возвращает `isMock=true`, пустую аналитику и предупреждение о заглушках. Никакие готовые findings в upload-result не подставлены.
4. Для отдельной проверки наполненных экранов существующий `src/mocks/analysis-result.json` загружен через штатный `getJobStore().seedDemo`, без изменения fixture или приложения. ID: `c0938aa6-f36a-4ad9-bb31-b25a212e4697`. Этот результат явно SYNTHETIC и показывает DEMO / MOCK DATA. Это **не результат загруженных DOCX**.
5. На этом API-результате пройдены Results → Structure → Function → Findings LOSS/DUPLICATION/CONFLICT → Evidence → Conclusion → Finding → PATCH review → reload. Ошибок browser console не зарегистрировано.

**Полный реальный Upload → семантический Finding → Evidence → Conclusion остаётся BLOCKED backend.** UI-навигация и пустые состояния подтверждены; качество AI и реальные аналитические выводы не подтверждены. Не выдавать объединение двух проверок за единый успешный AI-анализ.

## Проверки

| Команда | Результат |
| --- | --- |
| `npm test` | exit 0, 27/27 существующих тестов |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npm run build` | exit 0 |
| `git diff --check` | exit 0 |

Зависимости повторно не устанавливались: использован существующий node_modules. Автогенерируемые Next.js изменения AGENTS.md и next-env.d.ts исключены из коммита. Секреты не читались и не включены в коммит.

## API / запрос backend

Несовпадений с опубликованным контрактом 0.1.0 не обнаружено:

- `POST /api/analyses`: multipart `before[]`, `after[]` → 202 `{id}`.
- `GET /api/analyses/:id`: `AnalysisJob`, при done — `result.units`, `unitChanges`, `functions`, `lineage`, `findings`, `conclusion.sections`, `summary`, `warnings`.
- `PATCH /api/analyses/:id/findings/:findingId/review`: `{status, comment}` → полный `Finding`.
- UI preserved для функций соответствует API `UNCHANGED`; transformed — UI-группа `RENAMED | MERGED | SPLIT`.

Блокер: `backend/pipeline.ts` пока не наполняет семантические массивы. Для реального demo backend должен вернуть доказательные units/unitChanges/functions/lineage/findings и conclusion.sections с корректными findingIds. TXT, clauses/alignment и новые типы findings из целевого плана 0.2.0 отсутствуют в текущем контракте и не добавлялись фронтендом. Основные TXT-образцы нельзя загрузить через текущий API (415); фронтенд согласованно принимает PDF/DOCX/XLSX.
