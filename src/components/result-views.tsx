"use client";

import { useEffect, useRef, useState } from "react";
import type { AnalysisResult, Evidence, OrgFunction } from "../shared/contract";
import { Source } from "./evidence-drawer";

const unitLabels = { PRESERVED: "Сохранено", RENAMED: "Переименовано", MERGED: "Объединено", SPLIT: "Разделено", CREATED: "Создано", REMOVED: "Упразднено" };
const functionLabels = { UNCHANGED: "Сохранена", TRANSFERRED: "Передана", MODIFIED: "Изменена", NEW: "Новая", POSSIBLE_LOSS: "Возможная потеря" };
const roles = { execute: "Исполнение", control: "Контроль", approve: "Утверждение", audit: "Аудит", support: "Поддержка", other: "Другая" };
const reviews = { NOT_REVIEWED: "Не рассмотрено", CONFIRMED: "Подтверждено сотрудником", REJECTED: "Отклонено сотрудником", NEEDS_CHECK: "Требует проверки" };
type Selection = { title: string; evidence: Evidence[] };

export function ResultViews({ view, result, transferredOnly, onFinding }: { view: string; result: AnalysisResult; transferredOnly: boolean; onFinding: (id: string) => void }) {
  const [status, setStatus] = useState(transferredOnly ? "TRANSFERRED" : "all");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<Selection | null>(null);
  const units = new Map(result.units.map(unit => [unit.id, unit]));
  const functions = new Map(result.functions.map(fn => [fn.id, fn]));
  const matches = (text: string) => text.toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru"));
  function functionCell(ids: string[]) {
    return ids.length ? ids.map(id => {
      const fn = functions.get(id);
      if (!fn) return <p key={id}>Функция отсутствует в ответе сервера</p>;
      return <article className="comparison-function" key={id}><strong>{units.get(fn.unitId)?.name ?? "Подразделение не указано"}</strong><p>{fn.text}</p><small>{roles[fn.role]} · {fn.process}</small><button onClick={() => setSource({ title: fn.text, evidence: fn.evidence })}>Источники функции</button></article>;
    }) : <p className="muted">Нет связанной функции в ответе сервера</p>;
  }
  const changes = result.unitChanges.filter(change => (status === "all" || change.status === status) && matches([...change.beforeUnitIds, ...change.afterUnitIds].map(id => units.get(id)?.name).join(" ") + " " + change.rationale));
  const lineage = result.lineage.filter(link => (status === "all" || link.status === status) && matches([...link.beforeFunctionIds, ...link.afterFunctionIds].map(id => { const fn = functions.get(id); return `${fn?.text ?? ""} ${units.get(fn?.unitId ?? "")?.name ?? ""}`; }).join(" ") + " " + link.rationale));
  const labels = view === "structure" ? unitLabels : functionLabels;
  const counts: Record<string, number> = view === "structure" ? result.summary.unitsByStatus : result.summary.functionsByStatus;
  return <section className="result-section">
    <h2>{view === "structure" ? "Изменения структуры" : view === "functions" ? "Сравнение функций" : "Аналитическое заключение"}</h2>
    {view !== "conclusion" && <><p className="muted">Статусы и итоги получены от сервера. Количества обозначают записи сопоставления.</p><div className="result-filters"><label>Поиск по названию и обоснованию<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label><label>Статус<select value={status} onChange={event => setStatus(event.target.value)}><option value="all">Все статусы</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label} · {counts[key]}</option>)}</select></label></div></>}
    {view === "structure" && (changes.length ? <div className="table-scroll" tabIndex={0} role="region" aria-label="Таблица изменений структуры"><table><caption>Подразделения ДО → ПОСЛЕ</caption><thead><tr><th scope="col">ДО</th><th scope="col">ПОСЛЕ</th><th scope="col">Изменение и источники</th></tr></thead><tbody>{changes.map(change => <tr key={change.id}>{[change.beforeUnitIds, change.afterUnitIds].map((ids, side) => <td key={side}>{ids.length ? ids.map(id => { const unit = units.get(id); return <div className="comparison-function" key={id}><strong>{unit?.name ?? "Подразделение не найдено"}</strong>{unit?.parentName && <p className="muted">В составе: {unit.parentName}</p>}<button onClick={() => setSource({ title: unit?.name ?? id, evidence: unit?.evidence ?? [] })}>Источники подразделения</button></div>; }) : <span className="muted">Нет связанного подразделения</span>}</td>)}<td><span className="type-badge">{unitLabels[change.status]}</span><p>{change.rationale}</p><button onClick={() => setSource({ title: unitLabels[change.status], evidence: change.evidence })}>Источники изменения</button></td></tr>)}</tbody></table></div> : <Empty filtered={!!query || status !== "all"} />)}
    {view === "functions" && <>{lineage.length ? <div className="table-scroll" tabIndex={0} role="region" aria-label="Таблица сравнения функций"><table><caption>Связи функций ДО → ПОСЛЕ</caption><thead><tr><th scope="col">ДО</th><th scope="col">ПОСЛЕ</th><th scope="col">Результат сопоставления</th></tr></thead><tbody>{lineage.map(link => <tr key={link.id}><td>{functionCell(link.beforeFunctionIds)}</td><td>{functionCell(link.afterFunctionIds)}</td><td><span className="type-badge">{functionLabels[link.status]}</span><p>{link.rationale}</p>{link.status === "POSSIBLE_LOSS" && <p className="warning">Функция не найдена в обработанном наборе ПОСЛЕ. Это не доказывает её исчезновение в организации.</p>}<details><summary>Рассмотренные кандидаты ({link.candidatesChecked.length})</summary>{link.candidatesChecked.length ? link.candidatesChecked.map(candidate => <div key={candidate.functionId}>{functionCell([candidate.functionId])}<p>{candidate.reason}</p></div>) : <p>Сервер не предоставил кандидатов. Полноту поиска подтвердить нельзя.</p>}</details></td></tr>)}</tbody></table></div> : <Empty filtered={!!query || status !== "all"} />}<details className="function-detail"><summary>Все извлечённые функции ({result.functions.length})</summary><p className="muted">Включая функции, для которых сервер ещё не предоставил сопоставление.</p>{(["before", "after"] as OrgFunction["side"][]).map(side => <section key={side}><h3>{side === "before" ? "ДО" : "ПОСЛЕ"}</h3>{functionCell(result.functions.filter(fn => fn.side === side).map(fn => fn.id))}</section>)}</details></>}
    {view === "conclusion" && <><div className="info">Заключение получено от сервера. Решения сотрудника показаны отдельно; изменение решения не переписывает текст заключения автоматически.</div>{result.conclusion.sections.map(section => <article className="conclusion-section" key={section.key}><h3>{section.title}</h3><p>{section.text}</p>{section.findingIds.map(id => { const finding = result.findings.find(item => item.id === id); return finding?.verified ? <button className="conclusion-link" key={id} onClick={() => onFinding(id)}>{finding.title}<small>{reviews[finding.review.status]} · Открыть источники и решение</small></button> : null; })}{!section.findingIds.length && <small>Связанные замечания не предоставлены.</small>}</article>)}</>}
    {source && <SourceDialog selection={source} isMock={result.isMock} onClose={() => setSource(null)} />}
  </section>;
}
function Empty({ filtered }: { filtered: boolean }) { return <div className="empty"><h3>{filtered ? "Нет записей по выбранным условиям" : "Сервер пока не предоставил сопоставления"}</h3><p>{filtered ? "Измените поиск или выберите все статусы." : "Пустая таблица не означает отсутствие изменений или рисков."}</p></div>; }
function SourceDialog({ selection, isMock, onClose }: { selection: Selection; isMock: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <dialog ref={dialog} className="evidence-drawer" aria-labelledby="source-title" onCancel={event => { event.preventDefault(); onClose(); }}><div className="drawer-top"><span className="eyebrow">ИСХОДНЫЕ ФРАГМЕНТЫ</span>{isMock && <span className="demo-badge">DEMO / MOCK DATA</span>}<button onClick={onClose} aria-label="Закрыть источники">Закрыть</button></div><h2 id="source-title">{selection.title}</h2><div className="evidence-columns">{(["before", "after"] as const).map(side => <section key={side}><h3>{side === "before" ? "ДО" : "ПОСЛЕ"}</h3>{selection.evidence.filter(item => item.side === side).map((evidence, index) => <Source key={`${evidence.fragmentId}-${index}`} evidence={evidence} />)}{!selection.evidence.some(item => item.side === side) && <p className="empty">Исходные фрагменты для этой стороны не предоставлены.</p>}</section>)}</div></dialog>;
}
