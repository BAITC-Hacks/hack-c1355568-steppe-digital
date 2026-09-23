import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Document, Packer, Paragraph } from "docx";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AnalysisJobSchema, AnalysisModeSchema, AnalysisResultSchema } from "@/shared/contract";
import { methodOfAlignment } from "@/shared/method";
import { runAnalysis } from "./pipeline";
import { getJobStore } from "./store";
import { GET } from "@/app/api/analyses/[id]/route";
import mock from "@/mocks/analysis-result.json";

let directory: string;
beforeEach(async () => { directory = await mkdtemp(path.join(os.tmpdir(), "analysis-mode-")); vi.stubEnv("ORGTRACE_DATA_DIR", directory); vi.stubEnv("ORGTRACE_AI", "false"); });
afterEach(async () => { vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });

const base = { aiEnabled: true, embeddingsUsed: false, llmUsed: false, llmCalls: 0, llmCached: 0, embeddingCalls: 0, embeddingCached: 0, fallbacks: [], warnings: [] };
async function analyze(id: string, before: string[], after: string[]) {
  const files = await Promise.all((["before", "after"] as const).map(async (side, i) => ({ side, name: `${side}.docx`, bytes: await Packer.toBuffer(new Document({ sections: [{ children: [before, after][i].map(text => new Paragraph(text)) }] })) })));
  return runAnalysis({ id, files });
}

describe("analysis mode telemetry", () => {
  it("delivers the mode and every method over the API the frontend reads", async () => {
    const r = await analyze("mode-api", ["1. Отдел альфа", "1.1. Ведёт мониторинг качества продукции."], ["1. Отдел альфа", "1.1. Ведёт мониторинг качества услуг."]);
    // The store only seeds marked demo data; the round-trip under test is serialization, not mock semantics.
    const job = await getJobStore().seedDemo({ ...r, isMock: true });
    const response = await GET(new Request(`http://localhost/api/analyses/${job.id}`), { params: Promise.resolve({ id: job.id }) });
    const served = AnalysisJobSchema.parse(await response.json());
    expect(served.result?.analysisMode).toEqual(r.analysisMode);
    expect(served.result?.lineage.map(l => l.method)).toEqual(r.lineage.map(l => l.method));
    expect(served.result?.findings.map(f => f.method)).toEqual(r.findings.map(f => f.method));
  });
  it("rejects usage a run cannot have produced", () => {
    expect(AnalysisModeSchema.safeParse(base).success).toBe(true);
    expect(AnalysisModeSchema.safeParse({ ...base, llmUsed: true }).success).toBe(false);
    expect(AnalysisModeSchema.safeParse({ ...base, embeddingCalls: 2 }).success).toBe(false);
    expect(AnalysisModeSchema.safeParse({ ...base, aiEnabled: false, llmUsed: true, llmCalls: 1 }).success).toBe(false);
    expect(AnalysisModeSchema.safeParse({ ...base, llmUsed: true, llmCached: 1 }).success).toBe(true);
  });
  it("reports a disabled model, zero calls and the stages that fell back", async () => {
    const r = await analyze("mode-off", ["1. Отдел альфа", "1.1. Ведёт мониторинг качества продукции."], ["1. Отдел альфа", "1.1. Ведёт мониторинг качества услуг."]);
    expect(r.analysisMode).toMatchObject({ aiEnabled: false, llmUsed: false, embeddingsUsed: false, llmCalls: 0, embeddingCalls: 0 });
    expect(r.analysisMode?.fallbacks.map(f => f.stage)).toContain("alignment");
    for (const fallback of r.analysisMode!.fallbacks) expect(fallback.reason.length).toBeGreaterThan(0);
  });
  it("labels every lineage record and finding with the method that produced it", async () => {
    const r = await analyze("mode-methods", ["1. Отдел альфа", "1.1. Ведёт мониторинг качества продукции."], ["1. Отдел альфа", "1.1. Ведёт мониторинг качества продукции.", "2. Отдел бета", "2.1. Ведёт мониторинг качества продукции."]);
    expect(r.lineage.length).toBeGreaterThan(0); expect(r.findings.length).toBeGreaterThan(0);
    for (const l of r.lineage) expect(l.method).toBeDefined();
    for (const f of r.findings) expect(f.method).toBeDefined();
    // Without a model no record may claim a model produced it.
    for (const method of [...r.lineage.map(l => l.method), ...r.findings.map(f => f.method)]) expect(["rule", "text_similarity"]).toContain(method);
  });
  it("maps clause alignment provenance onto the shared method vocabulary", () => {
    expect(methodOfAlignment({ method: "exact" })).toBe("rule");
    expect(methodOfAlignment({ method: "fuzzy" })).toBe("text_similarity");
    expect(methodOfAlignment({ method: "embedding" })).toBe("embedding");
    expect(methodOfAlignment({ method: "llm" })).toBe("llm");
    expect(methodOfAlignment()).toBe("rule");
  });
  it("keeps the regulation samples consistent and marks the demo mock as synthetic", async () => {
    const files = await Promise.all((["before", "after"] as const).map(async side => ({ side, name: `${side}.docx`, bytes: await readFile(`eval/synthetic/inputs/${side}.docx`) })));
    const r = await runAnalysis({ id: "mode-synthetic", files });
    expect(r.analysisMode?.aiEnabled).toBe(false);
    const parsed = AnalysisResultSchema.parse(mock);
    expect(parsed.isMock).toBe(true);
    expect(parsed.analysisMode?.warnings.join(" ")).toContain("DEMO / MOCK DATA");
  });
});
