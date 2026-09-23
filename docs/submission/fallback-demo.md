# Fallback demo checklist

Основная сдача: `main`, tested application `c11483263674cdc93f95b702f11eec210bfae6ed`. Проверенный fallback v0.2: `release/hackathon-final` → `c823ccf7770e992a2817a9756f7d527be4ec9052`. Старый fallback: `release/hackathon-demo` → `29c34a406706c03f3904d989760b31c7175bf439`; не изменять и не удалять.

1. Если новый анализ задержался, открыть заранее сохранённый завершённый job на том же сервере/checkout. Объявить: «Это ранее полученный результат реального backend», а не новый live анализ. Jobs хранятся локально в `.data/`; после смены машины автоматически не появятся.
2. Если оригинальных DOCX нет, загрузить `eval/synthetic/inputs/before.docx` и `after.docx`. Объявить искусственный контрольный набор, показать Structure → Function → loss/duplication → источники → Conclusion. Не загружать expected/baseline как inputs.
3. Если main сервер недоступен, использовать отдельный заранее подготовленный checkout fallback release/hackathon-final на другом порту. При необходимости доступен и более старый fallback v0.1 release/hackathon-demo. Не смешивать `.data/`, контракты или сборки; не обещать в v0.1 MODIFIED/rights/clause alignment v0.2. Сначала показать exact branch/SHA.
4. Если runtime недоступен полностью, показать README, requirements matrix и QA summary как документы предыдущей проверки. Не изображать их live результатом. Скриншоты/видеозапись в этом пакете не подготовлены.

Для доступного завершённого v0.2 job: `http://127.0.0.1:<port>/?analysis=<existing-job-id>`. ID из QA summary работают только там, где сохранены соответствующие jobs.

Проверенный режим deterministic/rule-based; live LLM не проверялся. Все интерпретации рекомендательные, ambiguous owners требуют Human Review; диагностическое дублирование не доказанный факт.
