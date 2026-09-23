import path from "node:path";
import { AnalysisResultSchema, ConclusionKeySchema, StageKeySchema, type AnalysisResult, type Stage, type StageKey } from "@/shared/contract";
import { ingestDocument, validateUploads, type Fragment, type UploadInput } from "./ingest";
import { AppError, publicError } from "./errors";
import { atomicJson, dataDirectory } from "./files";
import { STAGE_LABELS } from "./stages";
import type { JobStore } from "./store";

export const EMPTY_SUMMARY = {
  unitsByStatus: { PRESERVED: 0, RENAMED: 0, MERGED: 0, SPLIT: 0, CREATED: 0, REMOVED: 0 },
  functionsByStatus: { UNCHANGED: 0, TRANSFERRED: 0, MODIFIED: 0, NEW: 0, POSSIBLE_LOSS: 0 },
  findingsByType: { LOSS: 0, DUPLICATION: 0, CONFLICT: 0, REORGANIZATION: 0 },
} as const;
const sectionTitles = ["Изменения структуры", "Сохранение функций", "Возможные потери", "Дублирование", "Конфликты", "Требуется проверка человеком"];
export type RunAnalysisInput = { id: string; files: UploadInput[]; onStage?: (stage: Stage) => Promise<void> };

/** Real ingestion; semantic stages are explicitly stubbed until the next backend task. */
export async function runAnalysis({ id, files, onStage }: RunAnalysisInput): Promise<AnalysisResult> {
  validateUploads(files);
  if (!/^[a-zA-Z0-9-]+$/u.test(id)) throw new AppError(400, "Некорректный идентификатор анализа.");
  const result: AnalysisResult = {
    id, isMock: true, documents: [], summary: structuredClone(EMPTY_SUMMARY), units: [], unitChanges: [],
    functions: [], lineage: [], findings: [], conclusion: { sections: [] },
    warnings: ["DEMO / MOCK DATA: файлы разобраны, но семантические этапы являются заглушками. Это не результат ИИ-аудита."],
  };
  const fragments: Fragment[] = [];
  const stage = async (key: StageKey, status: Stage["status"], detail: string) => onStage?.({ key, status, label: STAGE_LABELS[key], detail });
  for (const key of StageKeySchema.options) {
    const stub = ["units", "functions", "lineage", "findings"].includes(key);
    await stage(key, "running", stub ? "Заглушка: семантический анализ ещё не реализован." : "Выполняется.");
    try {
      if (key === "ingest") {
        for (const file of files) {
          const parsed = await ingestDocument(file);
          result.documents.push(parsed.document); fragments.push(...parsed.fragments);
          result.warnings.push(...parsed.document.warnings.map(w => `${parsed.document.name}: ${w}`));
        }
        await atomicJson(path.join(dataDirectory(), "fragments", `${id}.json`), fragments);
        for (const side of ["before", "after"] as const) {
          if (!fragments.some(f => f.side === side)) throw new AppError(422, `На стороне ${side === "before" ? "ДО" : "ПОСЛЕ"} нет читаемого текста. Предоставьте документы с текстовым слоем.`);
        }
      }
      if (key === "verify") {
        // The scaffold has no semantic claims. Still enforce all existing references/counts.
        const withSections = { ...result, conclusion: { sections: emptySections() } };
        AnalysisResultSchema.parse(withSections);
      }
      if (key === "conclusion") result.conclusion.sections = emptySections();
      await stage(key, "done", key === "ingest" ? `Документов: ${result.documents.length}; фрагментов: ${fragments.length}.` : stub ? "Заглушка завершена; выводы не сформированы." : key === "conclusion" ? "Показаны ограничения каркаса; аналитическое заключение не сформировано." : "Контракт проверен; семантических выводов пока нет.");
    } catch (error) {
      await stage(key, "failed", publicError(error)); throw error;
    }
  }
  return AnalysisResultSchema.parse(result);
}
function emptySections() {
  return ConclusionKeySchema.options.map((key, index) => ({ key, title: sectionTitles[index], text: "DEMO / MOCK DATA — этап анализа пока не реализован. Выводы отсутствуют.", findingIds: [] }));
}
export async function executeAnalysis(id: string, files: UploadInput[], store: JobStore): Promise<void> {
  try {
    await store.update(id, job => { job.status = "running"; });
    const result = await runAnalysis({ id, files, onStage: stage => store.setStage(id, stage) });
    await store.complete(id, result);
  } catch (error) { await store.fail(id, publicError(error)); }
}
