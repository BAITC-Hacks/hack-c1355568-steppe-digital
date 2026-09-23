# Final QA summary — v0.2

Дата: 2026-09-23. Решение пользователя: принять candidate для финальной сдачи. **READY TO SUBMIT с указанными ограничениями.**

## Revision и происхождение результатов

- Final branch: `release/hackathon-final`.
- База ветки: `014fd46c2623aeaff6e4101e05f1b6709caf908b`.
- Tested application SHA: `1776156aef950eb04447b8557c5934e9a0d9bbd4`.
- `git diff --name-status 1776156..014fd46`: только `A docs/product/EXPECTED_ANALYSIS_8_TO_9.md`.
- Следующий packaging commit меняет только README и четыре submission/QA документа. Его exact SHA: `git rev-parse HEAD` на final branch. Application идентичен tested SHA.
- Fallback не изменён: `release/hackathon-demo` → `29c34a406706c03f3904d989760b31c7175bf439`.

## Принятые результаты предыдущего QA

Проверялся изолированный checkout `1776156`, Node.js 24.19.0, production server, `NEXT_PUBLIC_USE_MOCK=false`, `ORGTRACE_AI=false`. При подготовке документации tests/typecheck/lint/build/smoke **NOT RUN** по указанию пользователя; результаты ниже исторические, принятые для неизменённого application code.

| Проверка | Фактический результат |
| --- | --- |
| Vitest | PASS, 46/46, 9 suites, exit 0 |
| Typegen + typecheck | PASS, exit 0 |
| Lint | PASS, exit 0 |
| Production build | PASS, exit 0 |
| Synthetic S01–S06 | Все PASS, реальный backend, isMock=false |
| ORIGINAL DOCX 8/9 | Smoke PASS, isMock=false |
| Browser Results → Finding → Evidence → Conclusion | PASS; console errors не обнаружены |
| Human Review | API/store tests PASS; controls видимы в Drawer. Повторное сохранение через browser в коротком smoke NOT RUN |

Synthetic job `8b737396-69ea-459d-9bda-51c8c98c5da6`: S01 transformed structure; S02 unchanged; S03 possible loss; S04 unchanged; S05 unchanged; S06 duplication с двумя AFTER owners — PASS.

Original job `2c3fd24b-7246-465b-91d0-59c3827f2a98`: fragments 491/490; units 14/24; functions/rights 133/167; lineage 143; findings 87, source-verified 70. Lineage: UNCHANGED 91, TRANSFERRED 19, MODIFIED 7, NEW 10, POSSIBLE_LOSS 16. Verified LOSS/DUPLICATION/CONFLICT = 0; diagnostic LOSS 16, DUPLICATION 1.

Оба ответа прошли AnalysisResultSchema. Browser Evidence для 5.4.4 б → 5.3.3 б показал документы 8/9, абзацы/пункты, исходный текст о покрытии рисков и заголовки владельцев. Conclusion отделяет подтверждённые текстовые основания от интерпретации и диагностических кандидатов.

Локальные evidence предыдущей проверки: checkout `qa-post-freeze-1776156`, файлы `.data/post-freeze-review.md`, `.data/smoke-summary.json`, `.data/synthetic-actual.json`, `.data/real-actual.json`. Эти runtime-артефакты и private DOCX не публикуются. Для воспроизведения используйте README; job IDs не являются переносимыми публичными ссылками.

## Границы verdict

Полного повторного аудита semantic accuracy не было. Manual baseline покрыт частично; качество всех diagnostic findings не аттестовано. Ambiguous owners требуют человека. Проверенная логика deterministic/rule-based, live LLM не проверялся. Сомнительное дублирование не доказанный факт; все выводы рекомендательные. v0.2 принимается целиком с согласованным frontend/backend contract.
