import path from "node:path";
import { AnalysisResultSchema, StageKeySchema, type AnalysisResult, type Stage, type StageKey } from "@/shared/contract";
import { ingestDocument, validateUploads, type Fragment, type UploadInput } from "./ingest";
import { AppError, publicError } from "./errors";
import { atomicJson, dataDirectory } from "./files";
import { STAGE_LABELS } from "./stages";
import type { JobStore } from "./store";
import { extract, extractFunctions, match, findings, finalize, conclude } from "./semantic-pipeline";

export const EMPTY_SUMMARY = {
  unitsByStatus: { PRESERVED: 0, RENAMED: 0, MERGED: 0, SPLIT: 0, CREATED: 0, REMOVED: 0 },
  functionsByStatus: { UNCHANGED: 0, TRANSFERRED: 0, MODIFIED: 0, NEW: 0, POSSIBLE_LOSS: 0 },
  findingsByType: { LOSS: 0, DUPLICATION: 0, CONFLICT: 0, REORGANIZATION: 0 },
} as const;
export type RunAnalysisInput = { id: string; files: UploadInput[]; onStage?: (stage: Stage) => Promise<void> };

/** Source-backed deterministic analysis through the existing API contract. */
export async function runAnalysis({ id, files, onStage }: RunAnalysisInput): Promise<AnalysisResult> {
  validateUploads(files);
  if (!/^[a-zA-Z0-9-]+$/u.test(id)) throw new AppError(400, "Некорректный идентификатор анализа.");
  const result: AnalysisResult = {
    id, isMock: false, documents: [], summary: structuredClone(EMPTY_SUMMARY), units: [], unitChanges: [],
    functions: [], lineage: [], findings: [], conclusion: { sections: [] },
    warnings: ["Реальный анализ документов детерминированными языковыми правилами, без LLM. Извлечение поддерживает явные заголовки подразделений и следующие за ними функции. Произвольные перефразировки, групповые владельцы, иерархии и косвенное покрытие требуют проверки человеком."],
  };
  const fragments: Fragment[] = [];
  let assignments: ReturnType<typeof extract> = [];
  const stage = async (key: StageKey, status: Stage["status"], detail: string) => onStage?.({ key, status, label: STAGE_LABELS[key], detail });
  for (const key of StageKeySchema.options) {
    await stage(key, "running", "Выполняется.");
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
      if (key === "units") assignments = extract(result, fragments);
      if (key === "functions") extractFunctions(result, assignments);
      if (key === "lineage") match(result);
      if (key === "findings") findings(result, fragments);
      if (key === "verify") { finalize(result, fragments); conclude(result); AnalysisResultSchema.parse(result); }
      if (key === "conclusion") conclude(result);
      await stage(key, "done", `Документов: ${result.documents.length}; подразделений: ${result.units.length}; функций: ${result.functions.length}; находок: ${result.findings.length}.`);
    } catch (error) {
      await stage(key, "failed", publicError(error)); throw error;
    }
  }
  return AnalysisResultSchema.parse(result);
}
export async function executeAnalysis(id: string, files: UploadInput[], store: JobStore): Promise<void> {
  try {
    await store.update(id, job => { job.status = "running"; });
    const result = await runAnalysis({ id, files, onStage: stage => store.setStage(id, stage) });
    await store.complete(id, result);
  } catch (error) { await store.fail(id, publicError(error)); }
}
