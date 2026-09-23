"use client";

import { useId, useState } from "react";

export function UploadForm({ onSubmit, busy, mode }: {
  onSubmit: (before: File[], after: File[]) => void;
  busy: boolean;
  mode: "mock" | "real";
}) {
  const [before, setBefore] = useState<File[]>([]);
  const [after, setAfter] = useState<File[]>([]);
  return <form onSubmit={event => { event.preventDefault(); if (before.length && after.length && !busy) onSubmit(before, after); }}>
    <div className="eyebrow">НОВЫЙ АНАЛИЗ</div>
    <h1>Что изменилось<br />в вашей организации?</h1>
    <p className="intro">Сопоставьте документы до и после реорганизации.<br />Проверьте изменения функций с опорой на первоисточники.</p>
    <div className="upload-grid">
      <FileZone title="До реорганизации" side="ДО" files={before} onChange={setBefore} disabled={busy} />
      <FileZone title="После реорганизации" side="ПОСЛЕ" files={after} onChange={setAfter} disabled={busy} />
    </div>
    <div className="submit-row"><p className="muted">{mode === "mock" ? "Демонстрация: файлы не отправляются. Будет показан синтетический пример." : "Для запуска добавьте хотя бы один документ с каждой стороны."}</p><button className="primary" disabled={busy || !before.length || !after.length}>{busy ? "Отправка…" : "Анализировать изменения"}<span aria-hidden="true"> ↗</span></button></div>
    <aside className="info"><strong>Каждое замечание — с источником</strong><p>Структура, функции и зоны ответственности сравниваются в пределах загруженных документов. Выводы требуют проверки ответственным сотрудником.</p></aside>
  </form>;
}

function FileZone({ title, side, files, onChange, disabled }: {
  title: string; side: string; files: File[]; onChange: (files: File[]) => void; disabled: boolean;
}) {
  const id = useId();
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  function add(incoming: File[]) {
    if (disabled) return;
    const rejected = incoming.filter(file => !/\.(pdf|docx|xlsx)$/i.test(file.name) || file.size === 0);
    setErrors(rejected.map(file => `${file.name}: ${file.size === 0 ? "файл пуст" : "допустимы только PDF, DOCX и XLSX"}.`));
    const accepted = incoming.filter(file => !rejected.includes(file));
    onChange([...files, ...accepted.filter(file => !files.some(existing => existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified))]);
  }
  return <section className="upload-panel"><div className="panel-title"><span className="side-label">{side}</span><h2>{title}</h2><span className="muted">{files.length}</span></div>
    <div className={`drop-zone ${dragging ? "dragging" : ""}`} onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); add(Array.from(event.dataTransfer.files)); }}>
      <span className="upload-icon" aria-hidden="true">↑</span><strong>Перетащите документы сюда</strong><span className="muted">или выберите на компьютере</span>
      <label className={`file-picker ${disabled ? "disabled" : ""}`} htmlFor={id}>Выбрать файлы<input id={id} type="file" multiple accept=".pdf,.docx,.xlsx" disabled={disabled} onChange={event => { add(Array.from(event.target.files ?? [])); event.target.value = ""; }} /></label><small>PDF · DOCX · XLSX</small>
    </div>
    {!!errors.length && <div role="alert" className="error">{errors.map((error, index) => <p key={index}>{error}</p>)}</div>}
    <ul className="file-list">{files.map((file, index) => <li key={`${file.name}-${file.size}-${file.lastModified}`}><span className="file-format">{file.name.split(".").pop()?.toUpperCase()}</span><span className="file-name">{file.name}<small>{new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(file.size / 1024)} КБ</small></span><button type="button" className="icon-button" aria-label={`Удалить ${file.name} из набора ${side}`} disabled={disabled} onClick={() => onChange(files.filter((_, i) => i !== index))}>×</button></li>)}</ul>
  </section>;
}
