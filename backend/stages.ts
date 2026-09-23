import { StageKeySchema, type Stage } from "@/shared/contract";
export const STAGE_LABELS = {
  ingest: "Загрузка и разбор", clauses: "Разбор пунктов", alignment: "Сопоставление пунктов", checks: "Проверки документа", units: "Подразделения", functions: "Функции",
  lineage: "Связи функций", findings: "Замечания", verify: "Проверка источников", conclusion: "Заключение",
} as const;
export function createStages(): Stage[] {
  return StageKeySchema.options.map(key => ({ key, label: STAGE_LABELS[key], status: "pending" }));
}
