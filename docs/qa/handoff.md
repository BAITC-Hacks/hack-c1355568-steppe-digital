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
