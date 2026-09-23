import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Document, Packer, Paragraph } from "docx";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runAnalysis } from "./pipeline";
import { equivalent } from "./semantic-pipeline";
let directory: string;
beforeEach(async () => { directory = await mkdtemp(path.join(os.tmpdir(), "semantic-")); vi.stubEnv("ORGTRACE_DATA_DIR", directory); });
afterEach(async () => { vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });
async function analyze(before: string[], after: string[]) {
  const files = await Promise.all((["before", "after"] as const).map(async (side, i) => ({ side, name: `${side}.docx`, bytes: await Packer.toBuffer(new Document({ sections: [{ children: [before, after][i].map(text => new Paragraph(text)) }] })) })));
  return runAnalysis({ id: "regression", files });
}
describe("source-backed runtime pipeline", () => {
  it("runs the actual synthetic DOCX pair without expected-results", async () => {
    const files = await Promise.all((["before", "after"] as const).map(async side => ({ side, name: `${side}.docx`, bytes: await readFile(`eval/synthetic/inputs/${side}.docx`) })));
    const r = await runAnalysis({ id: "synthetic-runtime", files });
    expect(r.isMock).toBe(false);
    expect(r.units).toHaveLength(5); expect(r.functions).toHaveLength(10);
    expect(r.summary.unitsByStatus).toMatchObject({ RENAMED: 1, PRESERVED: 1, CREATED: 1, REMOVED: 0 });
    expect(r.summary.functionsByStatus).toMatchObject({ UNCHANGED: 4, POSSIBLE_LOSS: 1, NEW: 0 });
    expect(r.summary.findingsByType).toMatchObject({ LOSS: 1, DUPLICATION: 1, CONFLICT: 0 });
    expect(r.findings.find(f => f.type === "LOSS")?.title).toContain("процедур закупок");
    const duplicate = r.findings.find(f => f.type === "DUPLICATION")!;
    expect(duplicate.unitIds).toHaveLength(2);
    expect(new Set(duplicate.evidence.map(e => e.locator.section))).toEqual(new Set(["3.2", "3", "4.1", "4"]));
    for (const f of r.findings) for (const e of f.evidence) expect(e.fragmentText).toContain(e.quote);
  });
  it("searches all AFTER owners, including many BEFORE owners converging on one AFTER owner", async () => {
    const r = await analyze(["1. Отдел альфа", "1.1. Ведёт мониторинг качества продукции.", "2. Отдел бета", "2.1. Ведёт мониторинг качества продукции."], ["9. Отдел гамма", "9.1. Ведёт мониторинг качества продукции."]);
    expect(r.lineage).toHaveLength(1); expect(r.lineage[0].status).toBe("TRANSFERRED");
    expect(r.lineage[0].beforeFunctionIds).toHaveLength(2); expect(r.summary.findingsByType.LOSS).toBe(0);
  });
  it("does not duplicate by common words or merge different scope, negation, or action", async () => {
    const r = await analyze(["1. Отдел альфа", "1.1. Контролирует качество продукции."], ["1. Отдел альфа", "1.1. Контролирует качество продукции.", "2. Отдел бета", "2.1. Контролирует качество услуг."]);
    expect(r.summary.findingsByType.DUPLICATION).toBe(0);
    expect(equivalent("Контролирует качество продукции ежегодно", "Контролирует качество продукции ежемесячно")).toBe(false);
    expect(equivalent("Контролирует качество продукции", "Не контролирует качество продукции")).toBe(false);
    expect(equivalent("Утверждает заявки", "Выполняет заявки")).toBe(false);
  });
  it("finds a same-owner execution/control candidate only for the same process", async () => {
    const r = await analyze(["1. Отдел альфа", "1.1. Выполняет обработку заявок."], ["1. Отдел альфа", "1.1. Выполняет обработку заявок.", "1.2. Контролирует обработку заявок.", "1.3. Проверяет качество продукции."]);
    expect(r.summary.findingsByType.CONFLICT).toBe(1);
    expect(r.findings.find(f => f.type === "CONFLICT")?.functionIds).toHaveLength(2);
  });
  it("does not validate loss with partial coverage or coverage outside recognized headings", async () => {
    const r = await analyze(["1. Отдел альфа", "1.1. Контролирует качество продукции ежегодно."], ["1. Отдел альфа", "1.1. Контролирует качество продукции."]);
    expect(r.summary.findingsByType.LOSS).toBe(0);
    expect(r.findings.find(f => f.type === "LOSS")?.verified).toBe(false);
    const raw = await analyze(["1. Отдел альфа", "1.1. Контролирует качество продукции."], ["Общие обязанности", "Контролирует качество продукции.", "1. Отдел бета", "1.1. Формирует отчёт."]);
    expect(raw.summary.findingsByType.LOSS).toBe(0);
  });
  it("does not leak ownership into unrelated sibling sections", async () => {
    const r = await analyze(["1. Отдел альфа", "1.1. Формирует отчёт.", "2. Общие положения", "2.1. Утверждает бюджет."], ["1. Отдел альфа", "1.1. Формирует отчёт."]);
    expect(r.functions.filter(f => f.side === "before")).toHaveLength(1);
  });
});
