"use client";

import { useEffect, useRef, useState } from "react";
import type { AnalysisResult, Evidence, Finding } from "../shared/contract";
import { reviewFinding } from "../lib/api";
import { quoteRange } from "./quote-range";

const reviewLabels = { NOT_REVIEWED: "Не рассмотрено", CONFIRMED: "Подтверждено сотрудником", REJECTED: "Отклонено", NEEDS_CHECK: "Требует проверки" };
const typeLabels = { LOSS: "Возможная потеря", DUPLICATION: "Дублирование", CONFLICT: "Конфликт ролей", REORGANIZATION: "Изменение структуры" };

export function EvidenceDrawer({ result, finding, onClose, onReview }: {
  result: AnalysisResult; finding: Finding; onClose: () => void; onReview: (finding: Finding) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef<AbortController | null>(null);
  const [comment, setComment] = useState(finding.review.comment ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.showModal();
    const overflow = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { request.current?.abort(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  async function save(status: Finding["review"]["status"]) {
    if (pending) return;
    const controller = new AbortController(); request.current = controller;
    setPending(true); setError("");
    try { const updated = await reviewFinding(result.id, finding.id, { status, comment: comment.trim() }, controller.signal); if (!controller.signal.aborted) onReview(updated); }
    catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Не удалось сохранить решение."); }
    finally { if (!controller.signal.aborted) setPending(false); }
  }
  return <dialog ref={dialog} className="evidence-drawer" aria-labelledby="finding-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="drawer-top"><span className="eyebrow">ПРОВЕРКА ПО ИСТОЧНИКАМ</span>{result.isMock && <span className="demo-badge">DEMO / MOCK DATA</span>}<button className="icon-button" onClick={onClose} aria-label="Закрыть источники">×</button></div>
    <span className="type-badge">{typeLabels[finding.type]}</span><h2 id="finding-title">{finding.title}</h2>
    <div className="metadata"><span>Приоритет проверки: <strong>{{ HIGH: "Высокий", MEDIUM: "Средний", LOW: "Низкий" }[finding.reviewPriority]}</strong></span><span>Уверенность: <strong>{{ high: "Высокая", medium: "Средняя", low: "Низкая" }[finding.confidence]}</strong></span></div>
    <p className={finding.verified ? "verified-label" : "warning"}>{finding.verified ? "Подтверждено источниками" : "не подтверждено источником — диагностический кандидат, исключён из подтверждённых итогов"}</p>
    <p>{finding.explanation}</p><div className="info"><strong>Рекомендация</strong><p>{finding.recommendation}</p></div>
    <h3>Подразделения</h3><ul>{finding.unitIds.map(id => <li key={id}>{result.units.find(unit => unit.id === id)?.name ?? "Подразделение отсутствует в ответе сервера"}</li>)}</ul>
    <h3>Связанные функции</h3>{finding.functionIds.map(id => { const fn = result.functions.find(item => item.id === id); return <details className="function-detail" key={id}><summary>{fn?.text ?? "Функция отсутствует в ответе сервера"}</summary>{fn?.evidence.map((evidence, i) => <Source key={`${evidence.fragmentId}-${i}`} evidence={evidence} />)}</details>; })}
    {finding.type === "LOSS" && <section className="search-trace"><h3>Эквивалентная функция не найдена</h3><p>Только в пределах загруженного и обработанного набора документов ПОСЛЕ. Это не доказывает исчезновение функции в организации.</p>{finding.searchTrace ? <><strong>Проверено функций: {finding.searchTrace.checkedCount}</strong><ul>{finding.searchTrace.topCandidates.map((candidate, i) => <li key={`${candidate.functionId}-${i}`}><strong>{result.functions.find(fn => fn.id === candidate.functionId)?.text ?? "Функция отсутствует в ответе сервера"}</strong><p>{candidate.reason}</p></li>)}</ul></> : <p className="warning">История поиска отсутствует. Полноту поиска подтвердить нельзя.</p>}</section>}
    <h3>Исходные фрагменты</h3><div className="evidence-columns">{(["before", "after"] as const).map(side => <section key={side}><h4>{side === "before" ? "ДО" : "ПОСЛЕ"}</h4>{finding.evidence.filter(item => item.side === side).map((evidence, i) => <Source key={`${evidence.fragmentId}-${i}`} evidence={evidence} />)}{!finding.evidence.some(item => item.side === side) && <p className="empty">{side === "after" && finding.type === "LOSS" ? "Для отсутствующей функции нет цитаты ПОСЛЕ. См. историю поиска выше." : "Для этой стороны исходный фрагмент не предоставлен."}</p>}</section>)}</div>
    <section className="review-panel"><h3>Решение сотрудника</h3><p aria-live="polite">{reviewLabels[finding.review.status]}{finding.review.updatedAt && <> · <time dateTime={finding.review.updatedAt}>{new Date(finding.review.updatedAt).toLocaleString("ru-RU")}</time></>}</p>{result.isMock && <p className="muted">Демонстрационное решение сохраняется локально в этом браузере.</p>}<label htmlFor="review-comment">Комментарий <span className="muted">(необязательно)</span></label><textarea id="review-comment" value={comment} disabled={pending} onChange={event => setComment(event.target.value)} rows={3} />{error && <p role="alert" className="error">{error}</p>}<div className="review-actions"><button className="primary" disabled={pending} onClick={() => save("CONFIRMED")}>Подтвердить</button><button disabled={pending} onClick={() => save("REJECTED")}>Отклонить</button><button disabled={pending} onClick={() => save("NEEDS_CHECK")}>Требует проверки</button></div>{pending && <p role="status">Сохраняем решение…</p>}<small>Решение сотрудника не изменяет статус проверки цитат.</small></section>
  </dialog>;
}

function Source({ evidence }: { evidence: Evidence }) {
  const range = quoteRange(evidence.fragmentText, evidence.quote);
  const at = range?.[0] ?? 0;
  const end = range?.[1] ?? 0;
  const canHighlight = range !== null;
  return <article className="source"><div className="source-name">{evidence.documentName}</div><p className="source-locator">{evidence.locator.label}{evidence.locator.page && ` · стр. ${evidence.locator.page}`}{evidence.locator.section && ` · ${evidence.locator.section}`}{evidence.locator.row && ` · строка ${evidence.locator.row}`}</p><span className={evidence.verified ? "verified-label" : "unverified-label"}>{evidence.verified ? "Цитата проверена" : "не подтверждено источником"}</span><blockquote>{canHighlight ? <>{evidence.fragmentText.slice(0, at)}<mark>{evidence.fragmentText.slice(at, end)}</mark>{evidence.fragmentText.slice(end)}</> : evidence.fragmentText}</blockquote>{!canHighlight && <div className="quote-fallback"><strong>Цитата отдельно</strong><p>{evidence.quote || "Цитата не предоставлена"}</p><small>Подсветка недоступна; исходный текст сохранён без изменений.</small></div>}</article>;
}
