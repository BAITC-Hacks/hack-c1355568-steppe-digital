"use client";

import { useEffect, useRef, useState } from "react";
import type { AnalysisResult, Evidence, Finding } from "../shared/contract";
import { reviewFinding, USE_MOCK } from "../lib/api";
import { quoteRange } from "./quote-range";
import { findingLabels as typeLabels } from "../shared/labels";
import { Icon } from "./ui-icons";

const reviewLabels = { NOT_REVIEWED: "Не рассмотрено", CONFIRMED: "Подтверждено сотрудником", REJECTED: "Отклонено", NEEDS_CHECK: "Требует проверки" };

export function EvidenceDrawer({ result, finding, onClose, onReview, initialComment, onCommentChange, onPrevious, onNext }: {
  result: AnalysisResult;
  finding: Finding;
  onClose: () => void;
  onReview: (finding: Finding) => void;
  initialComment?: string;
  onCommentChange?: (comment: string) => void;
  onPrevious?: () => void;
  onNext?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef<AbortController | null>(null);
  const saving = useRef(false);
  const [comment, setComment] = useState(initialComment ?? finding.review.comment ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const hasDraft = comment !== (finding.review.comment ?? "");
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { request.current?.abort(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  function close() { if (!saving.current) onClose(); }
  async function save(status: Finding["review"]["status"]) {
    if (saving.current) return;
    saving.current = true;
    const controller = new AbortController(); request.current = controller;
    setPending(true); setError(""); setSaved(false);
    try {
      const updated = await reviewFinding(result.id, finding.id, { status, comment: comment.trim() }, controller.signal);
      if (!controller.signal.aborted) {
        onReview(updated);
        setComment(updated.review.comment ?? "");
        onCommentChange?.(updated.review.comment ?? "");
        setSaved(true);
      }
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Не удалось сохранить решение.");
    } finally {
      saving.current = false;
      if (!controller.signal.aborted) setPending(false);
    }
  }
  return <dialog ref={dialog} className="evidence-drawer" aria-labelledby="finding-title" onCancel={event => { event.preventDefault(); close(); }}>
    <div className="drawer-top"><div><span className="eyebrow">ПРОВЕРКА ЗАМЕЧАНИЯ</span>{result.isMock && <span className="demo-badge">DEMO / MOCK DATA</span>}</div><div className="drawer-navigation"><button disabled={pending || !onPrevious} onClick={onPrevious} aria-label="Предыдущее замечание"><Icon name="chevron" className="rotate" /></button><button disabled={pending || !onNext} onClick={onNext} aria-label="Следующее замечание"><Icon name="chevron" /></button><button className="icon-button" disabled={pending} onClick={close} aria-label="Закрыть источники"><Icon name="close" /></button></div></div>
    <div className="drawer-content">
      <span className={`type-badge ${finding.type.toLowerCase()}`}>{typeLabels[finding.type]}</span><h2 id="finding-title">{finding.title}</h2>
      <div className="metadata"><span>Приоритет: <strong>{{ HIGH: "Высокий", MEDIUM: "Средний", LOW: "Низкий" }[finding.reviewPriority]}</strong></span><span>Уверенность: <strong>{{ high: "Высокая", medium: "Средняя", low: "Низкая" }[finding.confidence]}</strong></span></div>
      <div className={finding.verified ? "evidence-status verified" : "evidence-status diagnostic"}><Icon name={finding.verified ? "shield" : "alert"} /><span>{finding.verified ? "Текстовые основания подтверждены. Интерпретация требует проверки." : "Диагностический кандидат. Вывод не подтверждён и исключён из подтверждённых итогов."}</span></div>
      <p className="finding-explanation">{finding.explanation}</p>
      <h3 className="source-heading">Исходные фрагменты</h3>
      <div className="evidence-columns">{(["before", "after"] as const).map(side => <section key={side}><h4><span className="side-label">{side === "before" ? "ДО" : "ПОСЛЕ"}</span>{side === "before" ? "Прежняя редакция" : "Новая редакция"}</h4>{finding.evidence.filter(item => item.side === side).map((evidence, i) => <Source key={`${evidence.fragmentId}-${i}`} evidence={evidence} />)}{!finding.evidence.some(item => item.side === side) && <div className="empty-source"><Icon name="file" /><p>{side === "after" && finding.type === "LOSS" ? "Эквивалент не найден в обработанных документах. Цитаты об отсутствии нет." : "Для этой стороны исходный фрагмент не предоставлен."}</p></div>}</section>)}</div>
      <div className="recommendation"><Icon name="report" /><div><strong>Рекомендация</strong><p>{finding.recommendation}</p></div></div>
      {finding.unitIds.length > 0 && <div className="related-units"><h3>Подразделения и должности</h3>{finding.unitIds.map(id => <span className="neutral-badge" key={id}>{result.units.find(unit => unit.id === id)?.name ?? "Подразделение отсутствует в ответе сервера"}</span>)}</div>}
      {finding.functionIds.length > 0 && <details className="context-details"><summary>Связанные функции и полномочия <span className="count-badge">{finding.functionIds.length}</span></summary>{finding.functionIds.map(id => { const fn = result.functions.find(item => item.id === id); return <details className="function-detail" key={id}><summary>{fn?.text ?? "Функция отсутствует в ответе сервера"}</summary>{fn?.evidence.map((evidence, i) => <Source key={`${evidence.fragmentId}-${i}`} evidence={evidence} />)}</details>; })}</details>}
      {finding.type === "LOSS" && <details className="context-details search-trace"><summary>Область поиска ПОСЛЕ {finding.searchTrace && <span className="count-badge">{finding.searchTrace.checkedCount} функций</span>}</summary><h3>{finding.functionIds.some(id => result.functions.find(f => f.id === id)?.category === "right") ? "Эквивалентное полномочие не найдено" : "Эквивалентная функция не найдена"}</h3><p>Только в пределах загруженного и обработанного набора ПОСЛЕ. Это не доказывает исчезновение обязанности в организации.</p>{finding.searchTrace ? <><strong>Проверено функций: {finding.searchTrace.checkedCount}</strong><ul>{finding.searchTrace.topCandidates.map((candidate, i) => <li key={`${candidate.functionId}-${i}`}><strong>{result.functions.find(fn => fn.id === candidate.functionId)?.text ?? "Функция отсутствует в ответе сервера"}</strong><p>{candidate.reason}</p></li>)}</ul></> : <p className="warning">История поиска отсутствует. Полноту поиска подтвердить нельзя.</p>}</details>}
    </div>
    <section className="review-panel"><div className="review-heading"><h3>Решение сотрудника</h3><span className={`review-badge review-${finding.review.status.toLowerCase()}`}>{reviewLabels[finding.review.status]}</span></div>
      <label htmlFor="review-comment">Комментарий <span className="muted">(необязательно)</span></label><textarea maxLength={4000} id="review-comment" value={comment} disabled={pending} onChange={event => { setComment(event.target.value); onCommentChange?.(event.target.value); setSaved(false); }} rows={2} placeholder="Добавьте обоснование решения…" />
      {error && <p role="alert" className="error">{error}</p>}
      <div className="review-actions"><button className="primary" disabled={pending} onClick={() => save("CONFIRMED")}><Icon name="check" />Подтвердить</button><button disabled={pending} onClick={() => save("REJECTED")}>Отклонить</button><button disabled={pending} onClick={() => save("NEEDS_CHECK")}>Требует проверки</button></div>
      <p className="save-status" role="status">{pending ? "Сохраняем решение. Дождитесь ответа перед закрытием." : hasDraft ? "Черновик — сохраните вместе с решением. Он доступен до перезагрузки страницы." : saved ? "Решение сохранено." : finding.review.updatedAt ? <>Сохранено <time dateTime={finding.review.updatedAt}>{new Date(finding.review.updatedAt).toLocaleString("ru-RU")}</time></> : "Решение сотрудника не изменяет статус проверки цитат."}</p>
      {result.isMock && <small>{USE_MOCK ? "Демонстрационное решение сохраняется в этом браузере." : "Демонстрационное решение сохраняется на сервере."}</small>}
    </section>
  </dialog>;
}

export function Source({ evidence }: { evidence: Evidence }) {
  const range = quoteRange(evidence.fragmentText, evidence.quote);
  const coordinates = [evidence.locator.section && `пункт ${evidence.locator.section}`, evidence.locator.page && `стр. ${evidence.locator.page}`, evidence.locator.row && `строка ${evidence.locator.row}`].filter(Boolean).join(" · ");
  return <article className="source"><div className="source-name"><Icon name="file" /><span>{evidence.documentName}</span></div><p className="source-locator">{coordinates || evidence.locator.label}</p><span className={evidence.verified ? "verified-label" : "unverified-label"}>{evidence.verified ? "Цитата проверена" : "Не подтверждено источником"}</span><blockquote>{range ? <>{evidence.fragmentText.slice(0, range[0])}<mark>{evidence.fragmentText.slice(range[0], range[1])}</mark>{evidence.fragmentText.slice(range[1])}</> : evidence.fragmentText}</blockquote>{!range && <div className="quote-fallback"><strong>Цитата отдельно</strong><p>{evidence.quote || "Цитата не предоставлена"}</p><small>Подсветка недоступна; исходный текст сохранён без изменений.</small></div>}</article>;
}
