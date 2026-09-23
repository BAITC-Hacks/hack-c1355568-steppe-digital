"use client";

import { useId, useState } from "react";
import { Icon } from "./ui-icons";

export function UploadForm({ onSubmit, busy, mode }: {
  onSubmit: (before: File[], after: File[]) => void;
  busy: boolean;
  mode: "mock" | "real";
}) {
  const [before, setBefore] = useState<File[]>([]);
  const [after, setAfter] = useState<File[]>([]);
  const limitError = before.length + after.length > 20 ? "Не более 20 файлов в одном анализе. Удалите лишние документы." : [...before, ...after].reduce((total, file) => total + file.size, 0) > 25 * 1024 * 1024 ? "Суммарный размер превышает 25 МиБ. Удалите часть документов." : "";
  return <form onSubmit={event => { event.preventDefault(); if (before.length && after.length && !busy && !limitError) onSubmit(before, after); }}>
    <div className="page-heading"><div><h1>Новый анализ</h1><p className="intro">Сравните документы до и после реорганизации.</p></div><span className="neutral-badge"><Icon name="file" />Два набора документов</span></div>
    <div className="upload-intro"><h2>Начните с документов</h2><p>Добавьте положения, структуру или должностные инструкции. Одного регламента с каждой стороны достаточно.</p></div>
    <div className="upload-grid">
      <FileZone title="До реорганизации" side="ДО" files={before} onChange={setBefore} disabled={busy} />
      <FileZone title="После реорганизации" side="ПОСЛЕ" files={after} onChange={setAfter} disabled={busy} />
    </div>
    {limitError && <p className="error" role="alert">{limitError}</p>}
    <div className="submit-row"><p className="muted">{mode === "mock" ? "Демонстрация: файлы не отправляются. Будет показан синтетический пример." : "До 20 файлов суммарно. Лимит запроса — 25 МиБ, включая служебные данные."}</p><button className="primary" disabled={busy || !before.length || !after.length || !!limitError}>{busy ? "Отправка…" : "Анализировать изменения"}<Icon name="arrow" /></button></div>
    <aside className="upload-assurance"><Icon name="shield" /><div><strong>Каждое замечание — с источником</strong><p>Структура, функции и зоны ответственности сравниваются в пределах загруженных документов. Выводы требуют проверки ответственным сотрудником.</p></div></aside>
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
    const next = [...files];
    const messages: string[] = [];
    for (const file of incoming) {
      const duplicate = next.find(existing => existing.name === file.name);
      if (!/\.(txt|pdf|docx|xlsx)$/i.test(file.name)) messages.push(`${file.name}: допустимы TXT, PDF, DOCX и XLSX.`);
      else if (!file.size) messages.push(`${file.name}: файл пуст.`);
      else if (file.size > 10 * 1024 * 1024) messages.push(`${file.name}: размер превышает 10 МиБ.`);
      else if (duplicate) messages.push(`${file.name}: файл с таким именем уже добавлен на сторону ${side}.`);
      else next.push(file);
    }
    setErrors(messages);
    onChange(next);
  }
  return <section className="upload-panel"><div className="panel-title"><span className="side-label">{side}</span><h2>{title}</h2><span className="muted">{files.length}</span></div>
    <div className={`drop-zone ${dragging ? "dragging" : ""}`} onDragOver={event => { event.preventDefault(); if (!disabled) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); add(Array.from(event.dataTransfer.files)); }}>
      <span className="upload-icon"><Icon name="upload" /></span><strong>Перетащите документы сюда</strong><span className="muted">или выберите на компьютере</span>
      <label className={`file-picker ${disabled ? "disabled" : ""}`} htmlFor={id}>Выбрать файлы<input id={id} type="file" multiple accept=".txt,.pdf,.docx,.xlsx" disabled={disabled} onChange={event => { add(Array.from(event.target.files ?? [])); event.target.value = ""; }} /></label><small>TXT, PDF, DOCX, XLSX · до 10 МиБ на файл</small>
    </div>
    {!!errors.length && <div role="alert" className="error">{errors.map((error, index) => <p key={index}>{error}</p>)}</div>}
    <ul className="file-list">{files.map((file, index) => <li key={`${file.name}-${file.size}-${file.lastModified}`}><span className="file-format">{file.name.split(".").pop()?.toUpperCase()}</span><span className="file-name">{file.name}<small>{new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 1 }).format(file.size / 1024)} КБ</small></span><button type="button" className="icon-button" aria-label={`Удалить ${file.name} из набора ${side}`} disabled={disabled} onClick={() => onChange(files.filter((_, i) => i !== index))}><Icon name="close" /></button></li>)}</ul>
  </section>;
}
