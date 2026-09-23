# Demo checklist — 3–5 минут

Ветка `release/hackathon-final`, база `014fd46c2623aeaff6e4101e05f1b6709caf908b`, tested application `1776156aef950eb04447b8557c5934e9a0d9bbd4`. Exact packaging SHA: `git rev-parse HEAD`.

До выступления: запустить по README с `NEXT_PUBLIC_USE_MOCK=false`, `ORGTRACE_AI=false`; подготовить оригинальные DOCX 8/9 и synthetic inputs. Показывать ограничения открыто.

| Время | Шаг | Что показать |
| --- | --- | --- |
| 0:00–0:40 | Upload → Analyze → Results | №8 в ДО, №9 в ПОСЛЕ; реальные этапы API и isMock=false |
| 0:40–1:15 | «Структура» | Сохранение/появление сущностей; отличать подразделения от должностей |
| 1:15–2:00 | «Функции и полномочия» | Владельцы, function/right, переносы и MODIFIED; например 5.5.5 → 5.5.3 |
| 2:00–2:50 | Finding → Evidence | Перенос 5.4.4 б → 5.3.3 б: документы, локаторы, оригинальные цитаты и неоднозначность владельцев |
| 2:50–3:30 | «Заключение» | Подтверждённые текстовые основания, ограничения, отсутствие доказанной потери не равно отсутствию риска |
| 3:30–4:15 | Human Review | Вернуться в Drawer, показать Confirm/Reject/Needs Review; для ambiguous owner оставить «Требует проверки» с комментарием |
| 4:15–5:00 | Контрольный synthetic результат, если время позволяет | Явно объявить искусственный набор; loss и duplication с двумя AFTER owners, S01–S06 PASS |

Контрольная цепочка: Upload → Analyze → Structure Diff → Function Lineage → Finding → Evidence → Conclusion → Human Review.

Не обещать конкретный loss на оригиналах. Не называть diagnostic duplication доказанным фактом. Не заявлять live LLM: этот режим rule-based. При задержке использовать [fallback](fallback-demo.md), честно называя ранее сохранённый результат.
