import { describe, expect, it } from "vitest";
import { Document, Packer, Paragraph } from "docx";
import { PDFDocument, StandardFonts } from "pdf-lib";
import * as XLSX from "xlsx";
import { ingestDocument, validateUploads, LIMITS } from "./ingest";

export async function spreadsheetBytes() {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Подразделение", "Функция"], ["Отдел закупок", "3.1. Ведение реестра договоров"]]), "Структура");
  return new Uint8Array(XLSX.write(book, { type: "buffer", bookType: "xlsx" }));
}
describe("document ingestion", () => {
  it("extracts Russian DOCX clauses with locators and stable identities", async () => {
    const bytes = await Packer.toBuffer(new Document({ sections: [{ children: [new Paragraph("Функции"), new Paragraph("3.2.1 Ведение реестра договоров"), new Paragraph("п. 5 Архивирование документов")] }] }));
    const input = { name: "regulation.docx", side: "before" as const, bytes };
    const parsed = await ingestDocument(input);
    expect(parsed.fragments.find(f => f.locator.section === "3.2.1")?.text).toContain("Ведение реестра");
    expect(parsed.fragments.find(f => f.locator.section === "п. 5")).toBeDefined();
    expect(parsed.fragments.every(f => f.locator.page === undefined)).toBe(true);
    expect((await ingestDocument(input)).fragments).toEqual(parsed.fragments);
  });
  it("preserves XLSX sheet, actual row numbers and original text", async () => {
    const parsed = await ingestDocument({ name: "org.xlsx", side: "after", bytes: await spreadsheetBytes() });
    expect(parsed.fragments[1].locator).toMatchObject({ row: 2, label: "Структура, строка 2" });
    expect(parsed.fragments[1].text).toContain("Отдел закупок");
  });
  it("extracts PDF text by page and warns for a page without a text layer", async () => {
    const pdf = await PDFDocument.create(); const font = await pdf.embedFont(StandardFonts.Helvetica);
    pdf.addPage().drawText("3.1 Contract register", { font }); pdf.addPage();
    const parsed = await ingestDocument({ name: "regulation.pdf", side: "before", bytes: await pdf.save() });
    expect(parsed.fragments[0].text).toContain("Contract register");
    expect(parsed.fragments[0].locator.page).toBe(1);
    expect(parsed.document.warnings.join()).toContain("Страница 2");
  });
  it("returns a warning for corrupt files instead of fake fragments", async () => {
    const parsed = await ingestDocument({ name: "broken.docx", side: "after", bytes: new Uint8Array([1, 2, 3]) });
    expect(parsed.fragments).toEqual([]); expect(parsed.document.warnings.length).toBeGreaterThan(0);
  });
  it("rejects missing sides, legacy formats, duplicate names and oversized files", () => {
    const file = { name: "one.docx", side: "before" as const, bytes: new Uint8Array([1]) };
    const after = { ...file, side: "after" as const };
    expect(() => validateUploads([file])).toThrow();
    expect(() => validateUploads([file, { ...after, name: "legacy.doc" }])).toThrow();
    expect(() => validateUploads([file, file, after])).toThrow();
    expect(() => validateUploads([file, { ...after, bytes: new Uint8Array(LIMITS.fileBytes + 1) }])).toThrow();
  });
});
