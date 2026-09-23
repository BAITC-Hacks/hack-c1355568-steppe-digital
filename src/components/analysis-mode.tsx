"use client";
import type { AnalysisMethod, AnalysisMode } from "../shared/contract";
import { methodHints, methodLabels, stageLabels } from "../shared/labels";
import { Icon } from "./ui-icons";

/** Provenance is reported by the server; an absent value is shown as unknown, never as a rule or as AI. */
export function MethodBadge({ method, className = "" }: { method?: AnalysisMethod; className?: string }) {
  if (!method) return null;
  return <span className={`method-badge method-${method} ${className}`.trim()} title={methodHints[method]}>{methodLabels[method]}</span>;
}

const used = (on: boolean) => on ? "Использованы" : "Не использованы";

/** Shown above the results whenever the run degraded, so a reader never mistakes a fallback for a full analysis. */
export function AnalysisModeAlert({ mode }: { mode?: AnalysisMode }) {
  if (!mode?.fallbacks.length) return null;
  return <div className="warning" role="status">
    <strong>Анализ выполнен с переходом на резервный режим ({mode.fallbacks.length}).</strong>
    <ul>{mode.fallbacks.map((fallback, index) => <li key={index}><b>{stageLabels[fallback.stage]}:</b> {fallback.reason}</li>)}</ul>
    {!mode.llmUsed && !mode.embeddingsUsed && <p>Смысловые методы не применялись. Результат получен детерминированными правилами и текстовым сравнением.</p>}
  </div>;
}

export function AnalysisModePanel({ mode }: { mode?: AnalysisMode }) {
  if (!mode) return <section className="analysis-mode" aria-label="Режим анализа"><h2><Icon name="shield" />Режим анализа</h2><p className="muted">Сервер не сообщил режим анализа. Применение embeddings и языковой модели подтвердить нельзя.</p></section>;
  const rows: { label: string; value: string; note?: string; on: boolean }[] = [
    { label: "Embeddings", value: used(mode.embeddingsUsed), on: mode.embeddingsUsed, note: mode.embeddingModel },
    { label: "Языковая модель", value: mode.llmUsed ? "Использована" : "Не использована", on: mode.llmUsed, note: mode.chatModel },
    { label: "Запросов к модели", value: String(mode.llmCalls), on: mode.llmCalls > 0, note: mode.llmCached ? `из кэша: ${mode.llmCached}` : undefined },
    { label: "Запросов embeddings", value: String(mode.embeddingCalls), on: mode.embeddingCalls > 0, note: mode.embeddingCached ? `из кэша: ${mode.embeddingCached}` : undefined },
  ];
  return <section className="analysis-mode" aria-label="Режим анализа">
    <h2><Icon name="shield" />Режим анализа</h2>
    <p className="muted">{mode.aiEnabled ? "AI включён на сервере. Ниже — техники, фактически применённые в этом анализе." : "AI отключён или недоступен: выполнены только детерминированные правила и текстовое сравнение."}</p>
    <dl>{rows.map(row => <div key={row.label}><dt>{row.label}</dt><dd><span className={`mode-dot ${row.on ? "on" : "off"}`} aria-hidden="true" />{row.value}{row.note && <small>{row.note}</small>}</dd></div>)}</dl>
    {mode.fallbacks.length > 0 && <div className="mode-notes"><h3>Резервный режим ({mode.fallbacks.length})</h3><ul>{mode.fallbacks.map((fallback, index) => <li key={index}><b>{stageLabels[fallback.stage]}:</b> {fallback.reason}</li>)}</ul></div>}
    {mode.warnings.length > 0 && <div className="mode-notes"><h3>Предупреждения режима ({mode.warnings.length})</h3><ul>{mode.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div>}
  </section>;
}
