"use client";

import { useEffect, useRef, useState } from "react";
import type { AnalysisJob, AnalysisResult, Finding } from "../shared/contract";
import { createAnalysis, getAnalysis, USE_MOCK } from "../lib/api";
import { UploadForm } from "./upload-form";
import { EvidenceDrawer } from "./evidence-drawer";

export const findingLabels = { LOSS: "Возможная потеря", DUPLICATION: "Дублирование", CONFLICT: "Конфликт ролей", REORGANIZATION: "Изменение структуры" };
export const reviewLabels = { NOT_REVIEWED: "Не рассмотрено", CONFIRMED: "Подтверждено сотрудником", REJECTED: "Отклонено", NEEDS_CHECK: "Требует проверки" };
const stageLabels = { ingest: "Загрузка и разбор", units: "Подразделения", functions: "Функции", lineage: "Связи функций", findings: "Замечания", verify: "Проверка источников", conclusion: "Заключение" };
const stateLabels = { pending: "Ожидание", running: "Выполняется", done: "Готово", failed: "Ошибка" };

export function AnalysisWorkspace() {
  const [id, setId] = useState<string | null>(null);
  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const upload = useRef<AbortController | null>(null);
  useEffect(() => { setId(new URL(window.location.href).searchParams.get("analysis")); return () => upload.current?.abort(); }, []);
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    getAnalysis(id, { signal: controller.signal, onUpdate: setJob }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Не удалось загрузить анализ."); });
    return () => controller.abort();
  }, [id, retry]);
  function select(next: string | null) {
    const url = new URL(window.location.href);
    if (next) url.searchParams.set("analysis", next); else url.searchParams.delete("analysis");
    window.history.replaceState(null, "", url);
    setId(next); setJob(null); setError("");
  }
  async function submit(before: File[], after: File[]) {
    upload.current?.abort();
    const controller = new AbortController(); upload.current = controller;
    setBusy(true); setError("");
    try { const created = await createAnalysis(before, after, controller.signal); if (!controller.signal.aborted) select(created.id); }
    catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Не удалось создать анализ."); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <div className="app-shell"><header className="topbar"><a className="brand" href="/" aria-label="OrgTrace AI — новый анализ"><span className="brand-mark">◈</span>OrgTrace <span className="brand-ai">AI</span></a><span className="topbar-caption">Анализ организационных изменений</span>{(USE_MOCK || job?.result?.isMock) && <span className="demo-badge">DEMO / MOCK DATA</span>}</header>
    <div className="workspace"><aside className="sidebar"><span className="eyebrow">РАБОЧАЯ ОБЛАСТЬ</span><button className={!id ? "nav-item active" : "nav-item"} disabled={busy} onClick={() => select(null)}>＋ Создать анализ</button><div className={id ? "nav-item active" : "nav-item muted"}>▤ Текущий анализ</div><div className="sidebar-note"><span className="status-dot" />Источники прежде выводов<p>Проверяйте каждое замечание по исходному фрагменту.</p></div></aside>
      <main><div className="breadcrumb">Рабочая область <span>/</span> {id ? "Результаты анализа" : "Создать анализ"}</div>
        {!!error && <div className="error" role="alert">{error}{id && <button onClick={() => { setError(""); setRetry(value => value + 1); }}>Повторить загрузку</button>}</div>}
        {!id ? <UploadForm onSubmit={submit} busy={busy} mode={USE_MOCK ? "mock" : "real"} /> : job?.status === "done" && job.result ? <Dashboard key={id} result={job.result} onReview={finding => setJob(current => current?.result ? { ...current, result: { ...current.result, findings: current.result.findings.map(item => item.id === finding.id ? finding : item) } } : current)} /> : <section aria-live="polite"><div className="eyebrow">АНАЛИЗ ДОКУМЕНТОВ</div><h1>{job?.status === "failed" ? "Анализ остановлен" : "Проверяем изменения"}</h1><p className="intro">{job ? "Этапы и их состояние получены от сервера." : "Получаем состояние анализа…"}</p>{job?.status === "failed" && <div className="error">{job.error || "Обработка не завершена. Проверьте документы и создайте новый анализ."}</div>}<ol className="stages">{job?.stages.map(stage => <li key={stage.key} className={`stage ${stage.status}`}><span className="stage-dot" /><div><strong>{stageLabels[stage.key]}</strong>{stage.detail && <p>{stage.detail}</p>}</div><span>{stateLabels[stage.status]}</span></li>)}</ol><button onClick={() => select(null)}>Вернуться к загрузке</button></section>}
        <footer>Выводы носят рекомендательный характер и требуют проверки ответственным сотрудником</footer>
      </main></div></div>;
}

function Dashboard({ result, onReview }: { result: AnalysisResult; onReview: (finding: Finding) => void }) {
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const active = result.findings.find(item => item.id === selected);
  const cards = [
    { key: "REORGANIZATION", title: "Изменения структуры", count: result.summary.findingsByType.REORGANIZATION, caption: "Подтверждённые замечания" },
    { key: "LOSS", title: "Возможные потери", count: result.summary.findingsByType.LOSS, caption: "В загруженных документах" },
    { key: "DUPLICATION", title: "Дублирование", count: result.summary.findingsByType.DUPLICATION, caption: "Пересечения функций" },
    { key: "CONFLICT", title: "Конфликты ролей", count: result.summary.findingsByType.CONFLICT, caption: "Для проверки сотрудником" },
    { key: "transferred", title: "Передача функций", count: result.summary.functionsByStatus.TRANSFERRED, caption: "Записи сопоставления" },
  ];
  const visible = result.findings.filter(item => filter === "all" || (filter === "diagnostics" ? !item.verified : item.verified && item.type === filter));
  return <><div className="eyebrow">ОБЗОР АНАЛИЗА</div><div className="heading-row"><h1>Изменения под контролем</h1>{result.isMock && <span className="demo-badge">DEMO / MOCK DATA</span>}</div><p className="intro">Документы ДО: {result.documents.filter(doc => doc.side === "before").length} <span className="divider">/</span> Документы ПОСЛЕ: {result.documents.filter(doc => doc.side === "after").length}</p>
    {result.isMock && <div className="info">Синтетический пример. Загруженные файлы не анализировались. Решения сохраняются только в этом браузере.</div>}
    <div className="metrics">{cards.map(card => <button key={card.key} className={`metric ${filter === card.key ? "selected" : ""}`} onClick={() => setFilter(card.key)} aria-pressed={filter === card.key}><span>{card.title}</span><strong>{card.count}</strong><small>{card.caption}</small></button>)}</div>
    {(result.warnings.length > 0 || result.documents.some(doc => doc.warnings.length > 0)) && <details className="warning" open><summary>Ограничения и предупреждения</summary><ul>{result.warnings.map((warning, i) => <li key={i}>{warning}</li>)}{result.documents.flatMap(doc => doc.warnings.map((warning, i) => <li key={`${doc.id}-${i}`}>{doc.name}: {warning}</li>))}</ul></details>}
    <section className="findings"><div className="section-heading"><h2>Замечания и источники</h2><div className="tabs"><button aria-pressed={filter === "all"} onClick={() => setFilter("all")}>Все</button><button aria-pressed={filter === "diagnostics"} onClick={() => setFilter("diagnostics")}>Проверка источников</button></div></div>
      {filter === "transferred" ? <div className="empty"><h3>Выбраны переданные функции</h3><p>Таблица связей функций запланирована в следующем задании. Фильтр сохранён.</p><button onClick={() => setFilter("all")}>К замечаниям</button></div> : !visible.length ? <div className="empty"><h3>В этой категории нет замечаний</h3><p>Это не подтверждает отсутствие рисков за пределами загруженных документов.</p></div> : <div className="finding-list">{visible.map(finding => <button key={finding.id} className={`finding-card ${!finding.verified ? "unverified" : ""}`} onClick={() => setSelected(finding.id)}><span className={`type-badge ${finding.type.toLowerCase()}`}>{findingLabels[finding.type]}</span><strong>{finding.title}</strong><p>{finding.explanation}</p><div className="card-bottom"><span>{finding.verified ? "Источники подтверждены" : "не подтверждено источником"}</span><span>{reviewLabels[finding.review.status]}</span><span className="source-link">Открыть источники ↗</span></div></button>)}</div>}
    </section>{active && <EvidenceDrawer key={active.id} result={result} finding={active} onClose={() => setSelected(null)} onReview={onReview} />}</>;
}
