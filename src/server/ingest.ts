import path from "node:path";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import type { DocumentInfo, Locator, Side } from "@/shared/contract";
import { AppError } from "./errors";
import { hash } from "./files";

export const LIMITS = {
  fileBytes: 10 * 1024 * 1024, requestBytes: 25 * 1024 * 1024, fileCount: 20,
  pdfPages: 200, spreadsheetRows: 10_000, spreadsheetCells: 100_000,
  documentCharacters: 2_000_000, fragmentsPerDocument: 2_000, fragmentCharacters: 12_000,
} as const;
export type UploadInput = { name: string; side: Side; bytes: Uint8Array };
export type Fragment = { id: string; documentId: string; documentName: string; side: Side; text: string; locator: Locator };
export type IngestedDocument = { document: DocumentInfo; fragments: Fragment[] };

export function validateUploads(inputs: UploadInput[]): void {
  if (!inputs.some(f => f.side === "before") || !inputs.some(f => f.side === "after")) throw new AppError(400, "Добавьте документы ДО и ПОСЛЕ.");
  if (inputs.length > LIMITS.fileCount || inputs.reduce((sum, f) => sum + f.bytes.byteLength, 0) > LIMITS.requestBytes) throw new AppError(413, "Превышен лимит загрузки.");
  const names = new Set<string>();
  for (const f of inputs) {
    if (!f.name.trim() || f.name.length > 255 || /[\\/\u0000-\u001f]/u.test(f.name)) throw new AppError(400, "Недопустимое имя файла.");
    if (!['.docx', '.pdf', '.xlsx'].includes(path.extname(f.name).toLowerCase())) throw new AppError(415, "Поддерживаются только PDF, DOCX и XLSX.");
    if (!f.bytes.byteLength) throw new AppError(400, "Загружен пустой файл.");
    if (f.bytes.byteLength > LIMITS.fileBytes) throw new AppError(413, "Файл превышает 10 MiB.");
    const key = `${f.side}:${f.name}`;
    if (names.has(key)) throw new AppError(400, "Имена файлов на одной стороне должны различаться.");
    names.add(key);
  }
}

function clause(text: string): string | undefined {
  return text.match(/^\s*((?:п\.\s*)?\d+(?:\.\d+)*)(?:[.)]|\s|$)/iu)?.[1];
}

export async function ingestDocument(input: UploadInput): Promise<IngestedDocument> {
  const document: DocumentInfo = {
    id: `doc-${hash(`${input.side}\0${input.name}\0${hash(input.bytes)}`).slice(0, 24)}`,
    name: input.name, side: input.side, docType: "other", fragmentCount: 0, warnings: [],
  };
  const fragments: Fragment[] = [];
  let characters = 0;
  const add = (text: string, locator: Locator) => {
    if (!text.trim()) return;
    characters += text.length;
    if (characters > LIMITS.documentCharacters) throw new AppError(413, "Документ содержит слишком много текста.");
    for (let offset = 0; offset < text.length; offset += LIMITS.fragmentCharacters) {
      if (fragments.length >= LIMITS.fragmentsPerDocument) throw new AppError(413, "Превышен лимит фрагментов документа.");
      const part = text.slice(offset, offset + LIMITS.fragmentCharacters);
      if (!part.trim()) continue;
      fragments.push({ id: `${document.id}-f${fragments.length + 1}`, documentId: document.id,
        documentName: input.name, side: input.side, text: part, locator: { ...locator } });
    }
  };
  try {
    const extension = path.extname(input.name).toLowerCase();
    if (extension === ".pdf") {
      if (!Buffer.from(input.bytes.subarray(0, 5)).equals(Buffer.from("%PDF-"))) throw new Error("Invalid PDF");
      const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const task = getDocument({ data: new Uint8Array(input.bytes), useSystemFonts: true, isEvalSupported: false, verbosity: 0 });
      try {
        const pdf = await task.promise;
        if (pdf.numPages > LIMITS.pdfPages) throw new AppError(413, "PDF превышает 200 страниц.");
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          const page = await pdf.getPage(pageNumber);
          const content = await page.getTextContent();
          const text = content.items.map(item => "str" in item ? item.str + (item.hasEOL ? "\n" : " ") : "").join("");
          if (!text.trim()) document.warnings.push(`Страница ${pageNumber}: текстовый слой отсутствует; OCR не выполнялся.`);
          for (const paragraph of text.split(/\n\s*\n/u)) {
            const section = clause(paragraph);
            add(paragraph, { page: pageNumber, ...(section ? { section } : {}), label: `Страница ${pageNumber}${section ? `, пункт ${section}` : ""}` });
          }
          page.cleanup();
        }
      } finally { await task.destroy(); }
    } else if (extension === ".docx") {
      if (input.bytes[0] !== 0x50 || input.bytes[1] !== 0x4b) throw new Error("Invalid DOCX");
      const extracted = await mammoth.extractRawText({ buffer: Buffer.from(input.bytes) });
      if (extracted.messages.length) document.warnings.push("Парсер DOCX сообщил о неподдерживаемых элементах; проверьте полноту извлечения.");
      for (const [index, paragraph] of extracted.value.split(/\n\s*\n/u).entries()) {
        const section = clause(paragraph);
        add(paragraph, { ...(section ? { section } : {}), label: section ? `Пункт ${section}` : `Абзац ${index + 1}` });
      }
    } else if (extension === ".xlsx") {
      if (input.bytes[0] !== 0x50 || input.bytes[1] !== 0x4b) throw new Error("Invalid XLSX");
      const workbook = XLSX.read(input.bytes, { type: "array", cellText: true, cellDates: false });
      let totalRows = 0, totalCells = 0;
      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet["!ref"]) continue;
        const range = XLSX.utils.decode_range(sheet["!ref"]);
        totalRows += range.e.r - range.s.r + 1;
        totalCells += (range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1);
        if (totalRows > LIMITS.spreadsheetRows || totalCells > LIMITS.spreadsheetCells) throw new AppError(413, "Таблица превышает лимит строк или ячеек.");
        for (let row = range.s.r; row <= range.e.r; row++) {
          const cells: string[] = [];
          for (let col = range.s.c; col <= range.e.c; col++) {
            const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
            cells.push(cell ? XLSX.utils.format_cell(cell) : "");
          }
          const text = cells.join("\t");
          const section = clause(text);
          add(text, { row: row + 1, ...(section ? { section } : {}), label: `${sheetName}, строка ${row + 1}` });
        }
      }
    } else throw new AppError(415, "Поддерживаются только PDF, DOCX и XLSX.");
  } catch (error) {
    if (error instanceof AppError) throw error;
    // Do not pass parser internals or partial text off as a complete document.
    fragments.length = 0;
    document.warnings.push("Не удалось прочитать файл: он повреждён, защищён или имеет неподдерживаемую структуру.");
  }
  if (!fragments.length) document.warnings.push("Текст не извлечён. Предоставьте читаемую версию документа.");
  document.fragmentCount = fragments.length;
  return { document, fragments };
}
