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
  it("recognizes lettered structural lists and keeps director ownership separate", async () => {
    const source = ["1. Состав", "а. Департамент сопровождения (ДС).", "б) Отдел расчётов.",
      "2. Директор департамента сопровождения (далее Директор ДС):", "2.1. Формирует отчёт.",
      "3. Начальник отдела расчётов:", "3.1. Контролирует обработку счетов.",
      "4. Общие положения", "4.1. Утверждает бюджет."];
    const r = await analyze(source, source);
    const units = r.units.filter(u => u.side === "after");
    expect(units.map(u => u.name)).toEqual(expect.arrayContaining(["Департамент сопровождения", "Отдел расчётов"]));
    const director = units.find(u => u.name === "Директор департамента сопровождения")!;
    expect(director.parentName).toBe("Департамент сопровождения");
    const f = r.functions.find(f => f.side === "after" && f.text === "Формирует отчёт")!;
    expect(f.unitId).toBe(director.id);
    expect(f.evidence.map(e => e.locator.section)).toContain("2.1");
    expect(f.evidence.map(e => e.locator.section)).toContain("2");
    expect(r.functions.some(f => f.text.includes("бюджет"))).toBe(false);
    expect(r.summary.findingsByType.LOSS).toBe(0);
  });
  it("retains nominal subclauses and their context across a changed collective owner", async () => {
    const r = await analyze([
      "1. Служба аналитики", "2. Руководитель службы аналитики:",
      "2.1. Взаимодействует с руководителями в части:", "а. выявления рисков с недостаточным покрытием;",
    ], [
      "1. Отдел контроля", "2. Директоры отделов контроля и сопровождения:",
      "2.1. Готовят отчёт, взаимодействуют с руководителями в части:", "а) выявления рисков с недостаточным покрытием;",
    ]);
    const before = r.functions.find(f => f.side === "before" && f.text.startsWith("выявления"))!;
    const after = r.functions.find(f => f.side === "after" && f.text.startsWith("выявления"))!;
    expect(before).toBeDefined(); expect(after).toBeDefined();
    expect(after.evidence.some(e => e.locator.section === "2.1")).toBe(true);
    expect(after.evidence.some(e => e.quote.startsWith("а)"))).toBe(true);
    expect(r.lineage.find(l => l.beforeFunctionIds.includes(before.id))).toMatchObject({ status: "TRANSFERRED", afterFunctionIds: [after.id] });
    expect(r.findings.filter(f => f.type === "LOSS").some(f => f.functionIds.includes(before.id))).toBe(false);
    expect(r.warnings.some(w => w.includes("группового"))).toBe(true);
    expect(r.units.find(u => u.id === after.unitId)?.name).toBe("Директоры отделов контроля и сопровождения");
  });
  it("does not turn inherited rights/prohibitions or structural list neighbours into functions", async () => {
    const source = ["1. Структура", "а. Отдел расчётов.", "Формирует чужой отчёт.",
      "2. Полномочия", "Главный аудитор:", "2.1. Организует проверку.",
      "2.2. Главный аудитор имеет право:", "2.2.1. Проводить совещания.",
      "3. Отдел контроля", "3.1. Контролирует качество продукции.",
      "3.2. Работники не имеют права:", "3.2.1. Выполнять обработку счетов."];
    const r = await analyze(source, source);
    expect(r.functions.filter(f => f.side === "after").map(f => f.text)).toEqual(["Организует проверку", "Контролирует качество продукции"]);
  });
});
