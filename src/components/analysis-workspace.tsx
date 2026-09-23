"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AnalysisJob, AnalysisResult, Finding } from "../shared/contract";
import { createAnalysis, getAnalysis, USE_MOCK } from "../lib/api";
import { UploadForm } from "./upload-form";
import { EvidenceDrawer } from "./evidence-drawer";
import { findingLabels } from "../shared/labels";
import { ResultViews } from "./result-views";
import { Icon, type IconName } from "./ui-icons";

export const reviewLabels = { NOT_REVIEWED: "Не рассмотрено", CONFIRMED: "Подтверждено сотрудником", REJECTED: "Отклонено", NEEDS_CHECK: "Требует проверки" };
export type WorkspaceView = "findings" | "document" | "structure" | "functions" | "conclusion";
const views: { key: WorkspaceView; label: string; icon: IconName }[] = [
  { key: "findings", label: "Обзор и замечания", icon: "grid" },
  { key: "document", label: "Документы", icon: "file" },
  { key: "structure", label: "Структура", icon: "structure" },
  { key: "functions", label: "Функции и полномочия", icon: "functions" },
  { key: "conclusion", label: "Заключение", icon: "report" },
];
const stageLabels = { ingest: "Загрузка и разбор", clauses: "Разбор пунктов", alignment: "Сопоставление пунктов", checks: "Проверки документа", units: "Подразделения", functions: "Функции", lineage: "Связи функций", findings: "Замечания", verify: "Проверка источников", conclusion: "Заключение" };
const stateLabels = { pending: "Ожидание", running: "Выполняется", done: "Готово", failed: "Ошибка" };

export function AnalysisWorkspace() {
  return <Suspense fallback={<main aria-busy="true">Загружаем анализ…</main>}><Workspace /></Suspense>;
}

function Workspace() {
  const params = useSearchParams();
  const id = params.get("analysis");
  const rawView = params.get("view");
  const view = views.find(item => item.key === rawView)?.key ?? "findings";
  const router = useRouter();
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const upload = useRef<AbortController | null>(null);
  const currentJob = job?.id === id ? job : null;
  const result = currentJob?.status === "done" ? currentJob.result : undefined;
  useEffect(() => () => upload.current?.abort(), []);
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    getAnalysis(id, { signal: controller.signal, onUpdate: setJob }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Не удалось загрузить анализ.");
    });
    return () => controller.abort();
  }, [id, retry]);
  function select(next: string | null) {
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("analysis", next); else url.searchParams.delete("analysis");
    url.searchParams.delete("view");
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
    setJob(null); setError("");
  }
  function navigate(next: WorkspaceView) {
    const url = new URL(window.location.href);
    url.searchParams.set("view", next);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  async function submit(before: File[], after: File[]) {
    upload.current?.abort();
    const controller = new AbortController(); upload.current = controller;
    setBusy(true); setError("");
    try { const created = await createAnalysis(before, after, controller.signal); if (!controller.signal.aborted) select(created.id); }
    catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Не удалось создать анализ."); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
    <a className="skip-link" href="#main-content">К основному содержимому</a>
    <aside className="sidebar" aria-label="Главная навигация">
      <div className="brand"><span className="brand-mark"><Icon name="grid" /></span><div className="brand-copy"><strong>OrgTrace <span>AI</span></strong><small>Анализ изменений</small></div></div>
      <button className="new-analysis" disabled={busy} onClick={() => select(null)} title="Новый анализ"><Icon name="plus" /><span>Новый анализ</span></button>
      <div className="nav-group-label">Рабочая область</div>
      <nav>{views.map(item => <button key={item.key} title={item.label} className={`nav-item ${result && view === item.key ? "active" : ""}`} disabled={!result} aria-current={result && view === item.key ? "page" : undefined} onClick={() => navigate(item.key)}><Icon name={item.icon} /><span>{item.label}</span>{item.key === "findings" && result && <small>{result.findings.length}</small>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-note"><Icon name="shield" /><div><strong>Проверяемые источники</strong><p>Каждое решение — с опорой на документы.</p></div></div><div className="workspace-label"><span className="workspace-avatar">OT</span><div><strong>Рабочее пространство</strong><small>Организационный аудит</small></div></div></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><button className="icon-button" onClick={() => setCollapsed(value => !value)} aria-label={collapsed ? "Развернуть меню" : "Свернуть меню"} aria-expanded={!collapsed}><Icon name="panel" /></button><span className="header-divider" /><div className="breadcrumb">Рабочая область <Icon name="chevron" /><span>{id ? (result ? views.find(item => item.key === view)?.label : "Ход анализа") : "Новый анализ"}</span></div><div className="header-status">{(USE_MOCK || result?.isMock) ? <span className="demo-badge">DEMO / MOCK DATA</span> : <span className="neutral-badge"><Icon name="shield" />Проверка по документам</span>}</div></header>
      <main id="main-content">
        {error && <div className="error" role="alert">{error}{id && <button onClick={() => { setError(""); setRetry(value => value + 1); }}>Повторить загрузку</button>}</div>}
        {!id ? <UploadForm onSubmit={submit} busy={busy} mode={USE_MOCK ? "mock" : "real"} /> : result ? <Dashboard key={id} result={result} view={view} onNavigate={navigate} onReview={finding => setJob(current => current?.result ? { ...current, result: { ...current.result, findings: current.result.findings.map(item => item.id === finding.id ? finding : item) } } : current)} /> : <section className="progress-page" aria-live="polite"><span className="eyebrow">ОБРАБОТКА ДОКУМЕНТОВ</span><h1>{currentJob?.status === "failed" ? "Анализ остановлен" : "Проверяем изменения"}</h1><p className="intro">{currentJob ? `Завершено этапов: ${currentJob.stages.filter(stage => stage.status === "done").length} из ${currentJob.stages.length}` : "Получаем состояние анализа…"}</p>{currentJob?.status === "failed" && <div className="error">{currentJob.error || "Обработка не завершена. Проверьте документы и создайте новый анализ."}</div>}<ol className="stages">{currentJob?.stages.map((stage, i) => <li key={stage.key} className={`stage ${stage.status}`}><span className="stage-dot">{stage.status === "done" ? <Icon name="check" /> : i + 1}</span><div><strong>{stageLabels[stage.key]}</strong>{stage.detail && <p>{stage.detail}</p>}</div><span>{stateLabels[stage.status]}</span></li>)}</ol><button onClick={() => select(null)}>Вернуться к загрузке</button><p className="muted">Переход к загрузке не отменяет запущенный анализ. Сохраните ссылку, чтобы вернуться.</p></section>}
        <footer><Icon name="shield" />Выводы носят рекомендательный характер и требуют проверки ответственным сотрудником.</footer>
      </main>
    </div>
  </div>;
}

function Dashboard({ result, view, onNavigate, onReview }: { result: AnalysisResult; view: WorkspaceView; onNavigate: (view: WorkspaceView) => void; onReview: (finding: Finding) => void }) {
  const [type, setType] = useState("all");
  const [verification, setVerification] = useState("all");
  const [review, setReview] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const active = result.findings.find(item => item.id === selected);
  const verified = Object.values(result.summary.findingsByType).reduce((sum, count) => sum + count, 0);
  const diagnostics = result.findings.filter(item => !item.verified).length;
  const decided = result.findings.filter(item => item.review.status === "CONFIRMED" || item.review.status === "REJECTED").length;
  const priorities = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const units = new Map(result.units.map(unit => [unit.id, unit.name]));
  const visible = result.findings.filter(item => (type === "all" || item.type === type) && (verification === "all" || (verification === "verified" ? item.verified : !item.verified)) && (review === "all" || (review === "decided" ? ["CONFIRMED", "REJECTED"].includes(item.review.status) : item.review.status === review)) && `${item.title} ${item.explanation} ${item.unitIds.map(id => units.get(id) ?? "").join(" ")}`.toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru"))).sort((a, b) => priorities[a.reviewPriority] - priorities[b.reviewPriority]);
  const pageCount = Math.max(1, Math.ceil(visible.length / 12));
  const currentPage = Math.min(page, pageCount - 1);
  const warnings = [...result.warnings, ...result.documents.flatMap(doc => doc.warnings.map(warning => `${doc.name}: ${warning}`))];
  const hasFilters = type !== "all" || verification !== "all" || review !== "all" || !!query;
  const selectedIndex = visible.findIndex(item => item.id === selected);
  function reset() { setType("all"); setVerification("all"); setReview("all"); setQuery(""); setPage(0); }
  function metric(next: string) { reset(); if (next === "decided") setReview(next); else setVerification(next); onNavigate("findings"); }
  return <>
    <div className="page-heading"><div><h1>{view === "findings" ? "Обзор анализа" : views.find(item => item.key === view)?.label}</h1><p className="intro">{view === "findings" ? "Изучите изменения и проверьте замечания по первоисточникам." : "Сравнение в пределах загруженных и обработанных документов."}</p></div><details className="document-menu"><summary><Icon name="file" />Документы <span className="count-badge">{result.documents.length}</span></summary><div>{result.documents.map(doc => <p key={doc.id}><span className="side-label">{doc.side === "before" ? "ДО" : "ПОСЛЕ"}</span>{doc.name}</p>)}</div></details></div>
    {result.isMock && <div className="info"><span className="demo-badge">DEMO / MOCK DATA</span><p>{USE_MOCK ? "Синтетический пример. Загруженные файлы не анализировались. Решения сохраняются в этом браузере." : "Сервер вернул демонстрационный результат. Решения сохраняются на сервере."}</p></div>}
    {!result.units.length && !result.functions.length && !result.findings.length && <div className="warning" role="status">Аналитические данные не предоставлены. Нулевые счётчики не означают отсутствие изменений и рисков.</div>}
    {view === "findings" && <div className="metrics">{[
      { key: "all", title: "Всего замечаний", count: result.findings.length, caption: "В текущем анализе", icon: "grid" as const },
      { key: "verified", title: "Основания подтверждены", count: verified, caption: "Интерпретация требует проверки", icon: "shield" as const },
      { key: "diagnostics", title: "Кандидаты для проверки", count: diagnostics, caption: "Выводы не подтверждены", icon: "alert" as const },
      { key: "decided", title: "Решения сотрудника", count: decided, caption: "Подтверждено или отклонено", icon: "check" as const },
    ].map(card => <button key={card.key} className="metric" onClick={() => metric(card.key)} aria-pressed={!query && type === "all" && (card.key === "decided" ? review === "decided" : review === "all" && verification === card.key)}><span>{card.title}<Icon name={card.icon} /></span><strong>{card.count}</strong><small>{card.caption}</small></button>)}</div>}
    {warnings.length > 0 && <details className="analysis-warnings"><summary><Icon name="alert" /><span>Анализ выполнен с ограничениями</span><span className="count-badge">{warnings.length}</span><span className="warning-action">Подробнее</span></summary><ul>{warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>}
    <div className="result-nav" aria-label="Разделы анализа">{views.map(item => <button key={item.key} aria-pressed={view === item.key} onClick={() => onNavigate(item.key)}>{item.key === "findings" ? "Замечания" : item.label}</button>)}</div>
    <section className="findings" hidden={view !== "findings"} aria-label="Замечания и источники">
      <div className="section-heading"><div><h2>Замечания и источники</h2><p className="muted">Сначала — высокий приоритет проверки. Решение остаётся за вами.</p></div><span className="neutral-badge">{result.documents.filter(doc => doc.side === "before").length} ДО / {result.documents.filter(doc => doc.side === "after").length} ПОСЛЕ</span></div>
      <div className="finding-toolbar"><label className="search-field"><Icon name="search" /><input aria-label="Поиск замечаний" type="search" placeholder="Поиск по замечанию или подразделению…" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} /></label><label className="filter-field"><span className="sr-only">Тип замечания</span><select aria-label="Тип замечания" value={type} onChange={e => { setType(e.target.value); setPage(0); }}><option value="all">Все типы</option>{Object.entries(findingLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="filter-field"><span className="sr-only">Решение сотрудника</span><select aria-label="Решение сотрудника" value={review} onChange={e => { setReview(e.target.value); setPage(0); }}><option value="all">Все решения</option><option value="decided">Подтверждено / отклонено</option>{Object.entries(reviewLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
      <div className="filter-summary"><div className="filter-chips">{[["all", "Все основания"], ["verified", "Подтверждённые"], ["diagnostics", "Кандидаты"]].map(([key, label]) => <button key={key} aria-pressed={verification === key} onClick={() => { setVerification(key); setPage(0); }}>{label}</button>)}{hasFilters && <button className="text-button" onClick={reset}>Сбросить фильтры <Icon name="close" /></button>}</div><span role="status">Найдено: {visible.length}</span></div>
      <div className="table-scroll finding-table" tabIndex={0} role="region" aria-label="Таблица замечаний"><table><thead><tr><th>Замечание</th><th>Основание</th><th>Приоритет</th><th>Решение</th><th><span className="sr-only">Открыть</span></th></tr></thead><tbody>{visible.slice(currentPage * 12, (currentPage + 1) * 12).map(finding => <tr key={finding.id}><td><span className={`type-badge ${finding.type.toLowerCase()}`}>{findingLabels[finding.type]}</span><button className="finding-title" onClick={() => setSelected(finding.id)}>{finding.title}</button><span className="finding-owner">{finding.unitIds.map(id => units.get(id)).filter(Boolean).join(" · ") || "Проверка документа"}</span></td><td><span className={`verification-badge ${finding.verified ? "verified" : "diagnostic"}`}><span />{finding.verified ? "Подтверждено" : "Кандидат"}</span></td><td><span className={`priority priority-${finding.reviewPriority.toLowerCase()}`}><span aria-hidden="true">{finding.reviewPriority === "HIGH" ? "↑" : finding.reviewPriority === "MEDIUM" ? "→" : "↓"}</span>{{ HIGH: "Высокий", MEDIUM: "Средний", LOW: "Низкий" }[finding.reviewPriority]}</span></td><td><span className={`review-badge review-${finding.review.status.toLowerCase()}`}>{reviewLabels[finding.review.status]}</span></td><td><button className="icon-button" onClick={() => setSelected(finding.id)} aria-label={`Открыть источники: ${finding.title}`}><Icon name="arrow" /></button></td></tr>)}</tbody></table>{!visible.length && <div className="empty"><Icon name="search" /><h3>{result.findings.length ? "Ничего не найдено" : "Замечания не сформированы"}</h3><p>{result.findings.length ? "Измените запрос или сбросьте фильтры." : "Проверьте ограничения анализа. Это не подтверждает отсутствие рисков."}</p>{hasFilters && <button onClick={reset}>Сбросить фильтры</button>}</div>}</div>
      <div className="pagination"><span>{visible.length ? `${currentPage * 12 + 1}–${Math.min((currentPage + 1) * 12, visible.length)} из ${visible.length}` : "0 записей"}</span><div><span>Страница {currentPage + 1} из {pageCount}</span><button disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Назад</button><button disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>Далее</button></div></div>
    </section>
    <ResultViews result={result} openFinding={setSelected} view={view} />
    {active && <EvidenceDrawer key={active.id} result={result} finding={active} onClose={() => setSelected(null)} onReview={onReview} initialComment={drafts[active.id]} onCommentChange={comment => setDrafts(current => ({ ...current, [active.id]: comment }))} onPrevious={selectedIndex > 0 ? () => setSelected(visible[selectedIndex - 1].id) : undefined} onNext={selectedIndex >= 0 && selectedIndex < visible.length - 1 ? () => setSelected(visible[selectedIndex + 1].id) : undefined} />}
  </>;
}
