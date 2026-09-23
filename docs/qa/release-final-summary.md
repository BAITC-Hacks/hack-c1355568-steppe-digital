# Final QA summary — сдаваемый main

Дата: 2026-09-23. **MAIN READY TO SUBMIT с указанными ограничениями.**

Основная ветка: `main`. Tested application SHA: `c11483263674cdc93f95b702f11eec210bfae6ed`. Финальный packaging commit меняет только README и четыре QA/submission документа; application code заморожен. Exact packaging SHA: `git rev-parse HEAD`.

Fallback: `release/hackathon-final` → `c823ccf7770e992a2817a9756f7d527be4ec9052`. Более ранний `release/hackathon-demo` → `29c34a406706c03f3904d989760b31c7175bf439` сохранён.

## Подтверждённые результаты

Проверялся изолированный checkout c114832, Node.js 24.19.0, production server localhost:3131, NEXT_PUBLIC_USE_MOCK=false, ORGTRACE_AI=false. npm отсутствовал в PATH: выполнены точные команды package scripts через Node. При текущей финализации документации новые tests/smoke **NOT RUN** по указанию пользователя.

| Проверка | Результат |
| --- | --- |
| Tests | PASS — 46/46, 9 suites, exit 0 |
| Typegen / typecheck | PASS, exit 0 |
| Lint | PASS, exit 0 |
| Production build | PASS, exit 0 |
| Synthetic S01–S06 | Все PASS, реальный backend, isMock=false |
| ORIGINAL DOCX 8/9 | PASS, isMock=false |
| Browser | Structure → Function Lineage → Finding → Evidence → Conclusion → Human Review PASS; console errors нет |
| Human Review | NEEDS_CHECK с QA-комментарием; UI подтвердил «Решение сохранено» |
| DOCX parser | PASS — оригиналы 8/9, 491/490 fragments, source/locators |
| PDF parser | PASS — acceptance validator и один реальный parse fixture: 1 непустой fragment, documentId/documentName, page=1, section=3.1; пустая страница 2 даёт предупреждение |
| XLSX parser | PASS — acceptance validator и один реальный parse fixture: 2 непустых fragments с source, лист «Структура», rows 1/2 |

Synthetic job: `6b0efd44-7184-4665-95e7-7d8b86655601`. S01 transformed structure, S02 unchanged, S03 possible loss, S04 unchanged, S05 unchanged, S06 duplication с двумя AFTER owners — PASS.

Original job: `d6746476-d9d1-42b3-b35c-5cd47bc52e61`. Fragments 491/490; units 14/24; functions/rights 133/167; lineage 143; findings 87, source-verified 70. Lineage: UNCHANGED 91, TRANSFERRED 19, MODIFIED 7, NEW 10, POSSIBLE_LOSS 16. Verified LOSS/DUPLICATION/CONFLICT = 0; diagnostic LOSS 16 и DUPLICATION 1.

Оба analysis response прошли AnalysisResultSchema. Upload/Analyze выполнялись multipart API. Browser проверил реальные results, заполненные Structure/Lineage, findings, Evidence с оригинальным DOCX9 и §5.3, Conclusion и сохранение Human Review. File chooser отдельно не перепроверялся. PDF/XLSX проверялись только на acceptance/parse/source/locator, без semantic analysis.

Локальные evidence: checkout `qa-main-c114832`, `.data/final-main-smoke.md`, `.data/smoke-summary.json`, `.data/synthetic-actual.json`, `.data/real-actual.json`, `.data/input-format-smoke.json`. PDF/XLSX созданы по существующим fixtures из `backend/ingest.test.ts` и обработаны настоящим `backend/ingest.ts`. Runtime-артефакты и private DOCX не публикуются; job IDs доступны только при сохранённых локальных jobs.

## Ограничения

Проверенный режим deterministic/rule-based; live LLM/embeddings не проверялся. Полнота manual baseline и качество всех diagnostic findings не аттестованы. Ambiguous owners требуют человека; сомнительное duplication не доказанный факт. Source verification подтверждает цитату, не всю интерпретацию. Все выводы рекомендательные. PDF/XLSX parser PASS не означает полный semantic E2E или OCR. Новый глубокий аудит не проводился.
