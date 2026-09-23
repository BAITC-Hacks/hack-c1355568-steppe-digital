"use client";
import { useState } from "react";
import type { AnalysisResult, Clause, ClauseAlignment, OrgFunction } from "../shared/contract";
import { alignmentLabels, unitLabels, lineageLabels } from "../shared/labels";
import { Source } from "./evidence-drawer";
import { wordDiff } from "./word-diff";
const number = (c?: Clause) => c ? [c.number, c.letter].filter(Boolean).join(" ") || "Без номера" : "—";

export function ResultViews({ result, openFinding, initialTransferred = false }: { result: AnalysisResult; openFinding: (id: string) => void; initialTransferred?: boolean }) {
  const [view, setView] = useState(initialTransferred ? "functions" : "document");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [lineage, setLineage] = useState(initialTransferred ? "TRANSFERRED" : "all");
  const [showCosmetic, setShowCosmetic] = useState(false);
  const [page, setPage] = useState(0);
  const clauses = new Map(result.clauses.map(c => [c.id, c]));
  const rows = result.alignments.filter(a => (showCosmetic || a.status !== "COSMETIC") && (status === "all" || a.status === status));
  const FunctionCell = ({ ids }: { ids: string[] }) => <>{!ids.length && <span>—</span>}{ids.map(id => {
    const f = result.functions.find(f => f.id === id)!;
    return <details key={id}><summary><span className="type-badge">{f.category === "right" ? "Полномочие" : "Функция"}</span> {number(clauses.get(f.clauseId))} · {result.units.find(u => u.id === f.unitId)?.name}<p>{f.text}</p></summary>{f.evidence.map((e, i) => <Source key={i} evidence={e} />)}</details>;
  })}</>;
  function matchesFunctions(functions: OrgFunction[], filter: string) {
    return filter === "all" || functions.some(f => f.category === filter);
  }
  return <section className="result-views"><div className="tabs" aria-label="Представления анализа">{[["document", "Изменения документа"], ["structure", "Структура"], ["functions", "Функции и полномочия"], ["conclusion", "Заключение"]].map(([key, label]) => <button key={key} aria-pressed={view === key} onClick={() => setView(key)}>{label}</button>)}</div>
    {view === "document" && <><h2>Изменения документа</h2><p>Из {Object.values(result.summary.alignmentsByStatus).reduce((a, b) => a + b, 0)} пунктов: {Object.entries(result.summary.alignmentsByStatus).map(([key, count]) => `${alignmentLabels[key as keyof typeof alignmentLabels]} — ${count}`).join(" / ")}</p><p className="muted">Пара ДО / ПОСЛЕ считается один раз. Оглавление, заголовки и пустые пункты исключены. Отсутствие пары не доказывает потерю функции.</p>
      <div className="view-controls"><label>Статус <select value={status} onChange={e => { setStatus(e.target.value); setPage(0); if (e.target.value === "COSMETIC") setShowCosmetic(true); }}><option value="all">Все</option>{Object.entries(alignmentLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label><input type="checkbox" checked={showCosmetic} onChange={e => { setShowCosmetic(e.target.checked); setPage(0); if (!e.target.checked && status === "COSMETIC") setStatus("all"); }} /> Показать косметические изменения</label></div>
      <p role="status">Записей по фильтру: {rows.length}</p>{rows.slice(page * 30, (page + 1) * 30).map(a => <ClauseRow key={a.id} alignment={a} before={clauses.get(a.beforeClauseId ?? "")} after={clauses.get(a.afterClauseId ?? "")} result={result} />)}{!rows.length && <p className="empty">Нет пунктов по выбранному фильтру.</p>}<div className="view-controls"><button disabled={page === 0} onClick={() => setPage(p => p - 1)}>Назад</button><span>Страница {page + 1} из {Math.max(1, Math.ceil(rows.length / 30))}</span><button disabled={(page + 1) * 30 >= rows.length} onClick={() => setPage(p => p + 1)}>Далее</button></div></>}
    {view === "structure" && <><h2>Подразделения и должности</h2><p>Структурный родитель и дополнительные связи подчинения показаны с источниками. Это не численность сотрудников.</p><div className="table-scroll"><table><thead><tr><th>ДО</th><th>ПОСЛЕ</th><th>Изменение</th></tr></thead><tbody>{result.unitChanges.map(change => <tr key={change.id}>{[change.beforeUnitIds, change.afterUnitIds].map((ids, i) => <td key={i}>{!ids.length && "—"}{ids.map(id => { const u = result.units.find(u => u.id === id)!; return <details key={id}><summary><strong>{u.name}</strong><p>{{ block: "Блок", department: "Департамент", position: "Должность", center: "Центр" }[u.kind]}{u.parentName && ` · В составе: ${u.parentName}`}</p></summary>{u.evidence.map((e, i) => <Source key={i} evidence={e} />)}</details>; })}</td>)}<td>{unitLabels[change.status]}<p>{change.rationale}</p></td></tr>)}</tbody></table></div>{!result.unitChanges.length && <p className="empty">Структура не извлечена. Проверьте ограничения.</p>}</>}
    {view === "functions" && <><h2>Функции и полномочия</h2><div className="view-controls"><label>Связь <select value={lineage} onChange={e => setLineage(e.target.value)}><option value="all">Все</option>{Object.entries(lineageLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}<option value="DUPLICATION">Дублирование</option><option value="CONFLICT">Конфликты</option></select></label><label>Категория <select value={category} onChange={e => setCategory(e.target.value)}><option value="all">Все</option><option value="function">Функция</option><option value="right">Полномочие</option></select></label></div><div className="table-scroll"><table><thead><tr><th>ДО</th><th>ПОСЛЕ</th><th>Связь и проверка</th></tr></thead><tbody>{result.lineage.filter(l => {
      const ids = [...l.beforeFunctionIds, ...l.afterFunctionIds];
      return (lineage === "all" || l.status === lineage || result.findings.some(f => f.type === lineage && f.functionIds.some(id => ids.includes(id)))) && matchesFunctions(result.functions.filter(f => ids.includes(f.id)), category);
    }).map(l => <tr key={l.id}><td><FunctionCell ids={l.beforeFunctionIds} /></td><td><FunctionCell ids={l.afterFunctionIds} /></td><td><strong>{lineageLabels[l.status]}</strong><p>{l.rationale}</p>{result.findings.filter(f => f.functionIds.some(id => [...l.beforeFunctionIds, ...l.afterFunctionIds].includes(id))).map(f => <button key={f.id} onClick={() => openFinding(f.id)}>Проверить: {f.title}</button>)}</td></tr>)}</tbody></table></div>{!result.lineage.length && <p className="empty">Функции не извлечены. Это ограничение анализа.</p>}</>}
    {view === "conclusion" && <><h2>Аналитическое заключение</h2>{result.conclusion.sections.map(s => <article key={s.key}><h3>{s.title}</h3><p>{s.text}</p>{s.findingIds.map(id => <button key={id} onClick={() => openFinding(id)}>{result.findings.find(f => f.id === id)?.title}</button>)}</article>)}<p className="info">Выводы носят рекомендательный характер и требуют проверки ответственным сотрудником.</p></>}
  </section>;
}
function ClauseRow({ alignment, before, after, result }: { alignment: ClauseAlignment; before?: Clause; after?: Clause; result: AnalysisResult }) {
  const diff = alignment.status === "SUBSTANTIVE" && before && after ? wordDiff(before.text, after.text) : null;
  return <article className="clause-row"><strong>{alignmentLabels[alignment.status]}</strong>{diff?.limited && <p className="muted">Большой пункт: показан полный текст без пословной подсветки.</p>}<div className="evidence-columns">{([before, after] as const).map((c, i) => <section key={i}><h3>{i === 0 ? "ДО" : "ПОСЛЕ"} · {number(c)}</h3>{c ? <><small>{result.documents.find(d => d.id === c.documentId)?.name} · {c.sectionTitle}</small><p className="clause-text">{diff ? diff[i === 0 ? "before" : "after"].map((part, j) => part.changed ? <mark className={i === 0 ? "removed-word" : "added-word"} key={j}>{part.text}</mark> : part.text) : c.text}</p></> : <p>Соответствующий пункт не найден.</p>}</section>)}</div></article>;
}
