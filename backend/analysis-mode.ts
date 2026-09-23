import type { AnalysisMode, AnalysisResult, StageKey } from "@/shared/contract";
import type { LlmUsage } from "./llm";

export const emptyAnalysisMode = (aiEnabled: boolean): AnalysisMode => ({
  aiEnabled, embeddingsUsed: false, llmUsed: false,
  llmCalls: 0, llmCached: 0, embeddingCalls: 0, embeddingCached: 0,
  fallbacks: [], warnings: [],
});
/** Fallbacks and mode warnings are reported, never acted on: the analysis path itself is unchanged. */
export function recordFallback(result: AnalysisResult, stage: StageKey, reason: string) {
  const mode = result.analysisMode;
  if (mode && !mode.fallbacks.some(f => f.stage === stage && f.reason === reason)) mode.fallbacks.push({ stage, reason });
}
export function recordModeWarning(result: AnalysisResult, warning: string) {
  const mode = result.analysisMode;
  if (mode && !mode.warnings.includes(warning)) mode.warnings.push(warning);
}
/** Usage is observed from real provider calls, so an unused technique can never be reported as used. */
export function applyUsage(mode: AnalysisMode | undefined, usage: LlmUsage) {
  if (!mode) return;
  mode.llmCalls = usage.chat.calls; mode.llmCached = usage.chat.cached;
  mode.embeddingCalls = usage.embeddings.calls; mode.embeddingCached = usage.embeddings.cached;
  mode.llmUsed = mode.llmCalls + mode.llmCached > 0;
  mode.embeddingsUsed = mode.embeddingCalls + mode.embeddingCached > 0;
  if (usage.chat.model) mode.chatModel = usage.chat.model;
  if (usage.embeddings.model) mode.embeddingModel = usage.embeddings.model;
}
