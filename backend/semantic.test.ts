import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalysisResult } from "@/shared/contract";
import { EMPTY_SUMMARY } from "./pipeline";
import { parseClauses, alignClauses } from "./clauses";
import { ingestDocument } from "./ingest";
import { refineAlignment } from "./semantic";
import { structuredChat, embed } from "./llm";
vi.mock("./llm", async importOriginal => ({ ...await importOriginal<typeof import("./llm")>(), structuredChat: vi.fn(), embed: vi.fn() }));
beforeEach(() => { vi.stubEnv("OPENAI_API_KEY", "test-placeholder"); vi.stubEnv("OPENAI_MODEL", "test-model"); vi.stubEnv("ORGTRACE_AI", "true"); vi.mocked(embed).mockImplementation(async texts => texts.map(() => [1, 0])); });
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
async function fixture() {
  const docs = await Promise.all((["before", "after"] as const).map(side => ingestDocument({ name: `${side}.txt`, side, bytes: Buffer.from(side === "before" ? "5. Права\n5.1. Получать сведения о договорах" : "5. Права\n5.2. Направлять запросы контрактных данных") })));
  const parsed = parseClauses(docs.flatMap(d => d.fragments));
  const result: AnalysisResult = { id: "test", isMock: false, documents: docs.map(d => d.document), clauses: parsed.clauses, alignments: alignClauses(parsed.clauses), units: [], unitChanges: [], functions: [], lineage: [], findings: [], summary: structuredClone(EMPTY_SUMMARY), conclusion: { sections: [] }, warnings: [] };
  return { parsed, result };
}
describe("semantic refinement trust boundaries", () => {
  it("uses embeddings only for leftovers and validates both cited clauses", async () => {
    const { parsed, result } = await fixture();
    vi.mocked(structuredChat).mockImplementation(async options => ({ items: JSON.parse(options.input).map((p: { alignmentId: string; before: { id: string; text: string }; after: { id: string; text: string } }) => ({ alignmentId: p.alignmentId, beforeClauseId: p.before.id, afterClauseId: p.after.id, beforeQuote: p.before.text, afterQuote: p.after.text, relationship: "modified" })) }));
    await refineAlignment(result, parsed);
    expect(embed).toHaveBeenCalledOnce(); expect(result.alignments).toHaveLength(1); expect(result.alignments[0].method).toBe("llm");
    expect(result.alignments[0].status).toBe("SUBSTANTIVE");
  });
  it("retains both clauses separately when the semantic judge rejects a match", async () => {
    const { parsed, result } = await fixture();
    vi.mocked(structuredChat).mockImplementation(async options => ({ items: JSON.parse(options.input).map((p: { alignmentId: string; before: { id: string; text: string }; after: { id: string; text: string } }) => ({ alignmentId: p.alignmentId, beforeClauseId: p.before.id, afterClauseId: p.after.id, beforeQuote: p.before.text, afterQuote: p.after.text, relationship: "unrelated" })) }));
    await refineAlignment(result, parsed);
    expect(result.alignments.map(a => a.status).sort()).toEqual(["ONLY_AFTER", "ONLY_BEFORE"]);
    expect(result.alignments.every(a => a.method === "llm")).toBe(true);
  });
  it("fails fabricated evidence rather than approving an AI pairing", async () => {
    const { parsed, result } = await fixture();
    vi.mocked(structuredChat).mockImplementation(async options => ({ items: JSON.parse(options.input).map((p: { alignmentId: string; before: { id: string }; after: { id: string } }) => ({ alignmentId: p.alignmentId, beforeClauseId: p.before.id, afterClauseId: p.after.id, beforeQuote: "Выдуманное полномочие", afterQuote: "Выдуманное полномочие", relationship: "equivalent" })) }));
    await expect(refineAlignment(result, parsed)).rejects.toThrow("Unsupported semantic alignment claim");
  });
  it("does not call providers without configuration", async () => {
    vi.stubEnv("ORGTRACE_AI", "false"); const { parsed, result } = await fixture();
    await refineAlignment(result, parsed); expect(embed).not.toHaveBeenCalled(); expect(structuredChat).not.toHaveBeenCalled(); expect(result.warnings.join()).toContain("AI недоступен");
  });
});
