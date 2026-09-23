# Fallback demo checklist

Основная сдача: `release/hackathon-final`, база `014fd46c2623aeaff6e4101e05f1b6709caf908b`, tested application `1776156aef950eb04447b8557c5934e9a0d9bbd4`. Старый fallback: `release/hackathon-demo` → `29c34a406706c03f3904d989760b31c7175bf439`; не изменять и не удалять.

1. Если новый анализ задержался, открыть заранее сохранённый завершённый job на том же сервере/checkout. Объявить: «Это ранее полученный результат реального backend», а не новый live анализ. Jobs хранятся локально в `.data/`; после смены машины автоматически не появятся.
2. Если оригинальных DOCX нет, загрузить `eval/synthetic/inputs/before.docx` и `after.docx`. Объявить искусственный контрольный набор, показать Structure → Function → loss/duplication → источники → Conclusion. Не загружать expected/baseline как inputs.
3. Если v0.2 сервер недоступен, использовать отдельный заранее подготовленный checkout старого fallback v0.1 на другом порту. Не смешивать `.data/`, контракты или сборки; не обещать в v0.1 MODIFIED/rights/clause alignment v0.2. Сначала показать exact branch/SHA.
4. Если runtime недоступен полностью, показать README, requirements matrix и QA summary как документы предыдущей проверки. Не изображать их live результатом. Скриншоты/видеозапись в этом пакете не подготовлены.

Для доступного завершённого v0.2 job: `http://127.0.0.1:<port>/?analysis=<existing-job-id>`. ID из QA summary работают только там, где сохранены соответствующие jobs.

Проверенный режим deterministic/rule-based; live LLM не проверялся. Все интерпретации рекомендательные, ambiguous owners требуют Human Review; диагностическое дублирование не доказанный факт.
