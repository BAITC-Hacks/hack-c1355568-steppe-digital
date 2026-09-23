import path from "node:path";
import { AnalysisResultSchema, StageKeySchema, type AnalysisResult, type Evidence, type Stage, type StageKey } from "@/shared/contract";
import { ingestDocument, validateUploads, type Fragment, type UploadInput } from "./ingest";
import { AppError, publicError } from "./errors";
import { atomicJson, dataDirectory } from "./files";
import { STAGE_LABELS } from "./stages";
import type { JobStore } from "./store";
import { parseClauses, alignClauses, evidenceFor, type ParsedClauses } from "./clauses";
import { extractUnits, extractFunctions, traceFunctions, checkDocuments, deriveFindings, summarize, conclude } from "./regulation";
import { aiEnabled, refineAlignment, tagChangedRoles } from "./semantic";
import { newUsage, withUsage } from "./llm";
import { applyUsage, emptyAnalysisMode, recordFallback } from "./analysis-mode";
import * as generic from "./semantic-pipeline";

export const EMPTY_SUMMARY = {
  unitsByStatus: { PRESERVED: 0, RENAMED: 0, MERGED: 0, SPLIT: 0, CREATED: 0, REMOVED: 0 },
  functionsByStatus: { UNCHANGED: 0, TRANSFERRED: 0, MODIFIED: 0, NEW: 0, POSSIBLE_LOSS: 0 },
  findingsByType: { LOSS: 0, DUPLICATION: 0, CONFLICT: 0, REORGANIZATION: 0, SCOPE_CHANGE: 0, BROKEN_REFERENCE: 0, UNDEFINED_ROLE: 0, AMBIGUITY: 0 },
  alignmentsByStatus: { IDENTICAL: 0, COSMETIC: 0, SUBSTANTIVE: 0, ONLY_BEFORE: 0, ONLY_AFTER: 0 },
};
export type RunAnalysisInput = { id: string; files: UploadInput[]; onStage?: (stage: Stage) => Promise<void> };

export async function runAnalysis({ id, files, onStage }: RunAnalysisInput): Promise<AnalysisResult> {
  validateUploads(files);
  if (!/^[a-zA-Z0-9-]+$/u.test(id)) throw new AppError(400, "Некорректный идентификатор анализа.");
  const result: AnalysisResult = {
    id, isMock: false, documents: [], summary: structuredClone(EMPTY_SUMMARY), clauses: [], alignments: [], units: [], unitChanges: [],
    functions: [], lineage: [], findings: [], conclusion: { sections: [] },
    warnings: ["Извлечение владельцев настроено на структуру положений БВА. Сопоставление функций — кандидаты по содержанию; косвенное покрытие и переименования требуют проверки. Не является полным юридическим аудитом."],
    analysisMode: emptyAnalysisMode(aiEnabled()),
  };
  const usage = newUsage();
  const fragments: Fragment[] = [];
  let genericMode = false;
  let assignments: ReturnType<typeof generic.extract> = [];
  let parsed: ParsedClauses = { clauses: [], sources: new Map(), warnings: [] };
  const stage = async (key: StageKey, status: Stage["status"], detail: string) => onStage?.({ key, status, label: STAGE_LABELS[key], detail });
  await withUsage(usage, async () => {
    for (const key of StageKeySchema.options) {
      await stage(key, "running", "Выполняется.");
      try {
        if (key === "ingest") {
          for (const file of files) {
            const document = await ingestDocument(file);
            result.documents.push(document.document); fragments.push(...document.fragments);
            result.warnings.push(...document.document.warnings.map(w => `${document.document.name}: ${w}`));
          }
          await atomicJson(path.join(dataDirectory(), "fragments", `${id}.json`), fragments);
          for (const side of ["before", "after"] as const) if (!fragments.some(f => f.side === side)) throw new AppError(422, `На стороне ${side === "before" ? "ДО" : "ПОСЛЕ"} нет читаемого текста. Предоставьте документы с текстовым слоем.`);
        }
        if (key === "clauses") { parsed = parseClauses(fragments); result.clauses = parsed.clauses; result.warnings.push(...parsed.warnings); }
        if (key === "alignment") { result.alignments = alignClauses(result.clauses); await refineAlignment(result, parsed); }
        if (key === "units") {
          extractUnits(result, parsed);
          // Keep the regulation path; explicit headings cover documents outside its template.
          genericMode = result.units.length === 0;
          if (genericMode) { recordFallback(result, "units", "Правила структуры регламента не применимы: использован общий извлекатель по явным заголовкам подразделений."); assignments = generic.extract(result, fragments); }
        }
        if (key === "functions") {
          if (genericMode) generic.extractFunctions(result, assignments, parsed);
          else { extractFunctions(result, parsed); await tagChangedRoles(result, parsed); }
        }
        if (key === "lineage") { if (genericMode) generic.match(result); else traceFunctions(result, parsed); }
        if (key === "checks") checkDocuments(result, parsed);
        if (key === "findings") { if (genericMode) generic.findings(result, fragments); else deriveFindings(result, parsed); }
        if (key === "verify") {
          // Validate every source against the actual ingest registry, not merely model text.
          const sources = new Map<string, Pick<Evidence, "quote" | "fragmentText" | "side" | "documentName" | "locator">>([
            ...fragments.map(f => [f.id, { ...f, quote: f.text, fragmentText: f.text }] as const),
            ...parsed.clauses.map(c => { const e = evidenceFor(c, parsed); return [e.fragmentId, e] as const; }),
          ]);
          const evidence = [...result.units, ...result.unitChanges, ...result.functions, ...result.findings].flatMap(x => x.evidence);
          for (const e of evidence) {
            const source = sources.get(e.fragmentId);
            if (!source || source.fragmentText !== e.fragmentText || source.side !== e.side || source.documentName !== e.documentName || !source.quote.includes(e.quote) || JSON.stringify(source.locator) !== JSON.stringify(e.locator)) throw new AppError(500, "Источник не прошёл проверку исходного фрагмента.");
          }
          summarize(result); if (genericMode) generic.conclude(result); else conclude(result);
          applyUsage(result.analysisMode, usage); AnalysisResultSchema.parse(result);
        }
        if (key === "conclusion") { if (genericMode) generic.conclude(result); else conclude(result); }
        const detail = { ingest: `Документов: ${result.documents.length}; фрагментов: ${fragments.length}.`, clauses: `Пунктов и заголовков: ${result.clauses.length}.`, alignment: `Записей сравнения: ${result.alignments.length}.`, units: `Сущностей: ${result.units.length}.`, functions: `Функций и полномочий: ${result.functions.length}.`, lineage: `Связей: ${result.lineage.length}.`, checks: "Ссылки, названия ролей и неоднозначные связи проверены.", findings: `Замечаний и кандидатов: ${result.findings.length}.`, verify: "Цитаты, ссылки и счётчики проверены.", conclusion: "Сформированы разделы с ограничениями и ссылками на замечания." };
        await stage(key, "done", detail[key]);
      } catch (error) { await stage(key, "failed", publicError(error)); throw error; }
    }
  });
  applyUsage(result.analysisMode, usage);
  return AnalysisResultSchema.parse(result);
}
export async function executeAnalysis(id: string, files: UploadInput[], store: JobStore): Promise<void> {
  try {
    await store.update(id, job => { job.status = "running"; });
    const result = await runAnalysis({ id, files, onStage: stage => store.setStage(id, stage) });
    await store.complete(id, result);
  } catch (error) { await store.fail(id, publicError(error)); }
}
