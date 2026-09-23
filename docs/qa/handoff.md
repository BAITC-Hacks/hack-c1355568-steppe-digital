# QA handoff log

No actual handoffs have been recorded. Frontend may append entries after each screen; QA owns test outcomes and the rest of this log. Keep mock and real mode explicit.

## Example only — not an actual handoff or passing test

```text
READY FOR TEST
Feature: New Analysis — upload validation (example only)
URL: <actual local URL to be supplied by frontend>
Expected: Separate ДО / ПОСЛЕ zones accept multiple PDF, DOCX and XLSX files; unsupported files show an error; submit stays disabled until both sides contain files. Mode: <mock or real>.
Test cases: R12, R13
```

## READY FOR TEST — 2026-09-23 — положения, редакции 8 → 9

Режим: реальные исходники из `data/samples/before/` и `data/samples/after/`, `isMock=false`, `ORGTRACE_AI=false`. Содержимое исходников не изменено. Контракт v0.2.0 описан в `docs/api/CONTRACT.md`.

Проверенный локальный URL: `http://127.0.0.1:3100/?analysis=5e1e77c9-0596-406f-9408-e842424d03d7`. Это временный тестовый сервер и локальное хранилище; после проверки сервер остановлен. Для повторения запустить приложение и загрузить пару исходников.

Ожидается: десять этапов; сопоставление пунктов с учётом перенумерации; структура с должностями и подчинением; функции отдельно от полномочий; новые типы замечаний, источники и заключение. Возможные потери и дублирование остаются диагностическими кандидатами, не входят в подтверждённые счётчики.

Проверки разработчика:

- `npm test`: exit 0, 36 тестов в 8 файлах, включая регрессии основной пары, парсер, API, контракт и проверку ответов семантического провайдера.
- `npm run typecheck`, `npm run lint`, `npm run build`, `git diff --check`: exit 0.
- Production API smoke: exit 0; реальные файлы, десять завершённых этапов, сохранённая обязанность ДНМ `5.4.2 → 5.4.2`, передача делегирования `9.37 → 9.37`.
- Браузер: загрузка пары через интерфейс, сравнение пунктов, подсветка изменений, скрытие косметики, полномочия и перенумерация, структура, источники, сохранение review после перезагрузки, заключение. На финальной сборке дополнительно проверено сохранение вкладки функций и фильтра «Полномочие» при смене типа замечаний; ошибок браузера не обнаружено.
- На основной паре: 488 сопоставлений (374 IDENTICAL, 6 COSMETIC, 55 SUBSTANTIVE, 26 ONLY_BEFORE, 27 ONLY_AFTER), 19 записей TRANSFERRED. Это регрессионные результаты, не оценка экспертной точности.

Ограничения: реальные вызовы OpenAI — NOT RUN; семантический путь проверен с подменённым транспортом. Извлечение владельцев настроено на структуру положений БВА; переименования, слияния и косвенное покрытие функций требуют дальнейшей проверки. Сопоставление названия получателя делегирования в `9.37` предварительное и сопровождается предупреждением и UNDEFINED_ROLE. Блокеров сборки нет. Запрос QA: экспертно проверить кандидатов потерь/переносов и неоднозначный групповой заголовок; полный gold-набор этим handoff не объявляется пройденным.

## P0 frontend review — 23.09.2026

READY FOR TEST
Feature: Structure Diff / Function Diff / Findings / Evidence / Conclusion, контракт 0.1.0
URL: http://127.0.0.1:3107/?analysis=c0938aa6-f36a-4ad9-bb31-b25a212e4697
Expected: Явно синтетический API seed, DEMO / MOCK DATA. Все статусы и три типа findings доступны; цитаты и выводы взяты из существующего fixture. Не результат реального upload.
Test cases: R01–R10, R16–R17; пройдены переходы structure → functions → finding → evidence → conclusion, PATCH NEEDS_CHECK и reload.

READY FOR TEST
Feature: Реальный Upload → Results и пустые аналитические массивы
URL: http://127.0.0.1:3107/?analysis=9ab9151c-6205-4ac3-8f71-a315b5746bf7
Expected: DOCX-пара eval/synthetic/inputs загружена через UI и настоящий API; backend semantic-blocked. Пустые таблицы и заключение открываются, отсутствие данных явно объяснено, fallback findings отсутствуют.
Test cases: R12–R15, пустые Structure/Function/Conclusion. Полный реальный путь до находки BLOCKED backend. Подробности: docs/product/P0_REVIEW.md.

## READY FOR TEST — объединение с frontend P0, 2026-09-23

Включены изменения команды до `cadc5fc`; исторические записи P0 выше относятся к контракту 0.1.0. Текущий контракт — 0.2.0. Сохранены поиск, фильтры структуры, кандидаты сопоставления, все извлечённые функции, статусы review в заключении и предупреждение о пустом аналитическом результате.

После разрешения конфликтов: `npm test` (36 тестов), `npm run typecheck`, `npm run lint`, `npm run build` — exit 0. В браузере на production-сборке проверены поиск ДИТААД со статусом CREATED, фильтр полномочий и его сохранение при смене типа замечаний, просмотр кандидатов, список 300 функций и заключение со статусами review. Browser errors: 0. Реальные вызовы OpenAI по-прежнему NOT RUN.
