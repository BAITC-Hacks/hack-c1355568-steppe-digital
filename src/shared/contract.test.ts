import { describe, expect, it } from "vitest";
import example from "./analysis-result.example.json";
import { AnalysisResultSchema, UnitChangeSchema, ReviewInputSchema } from "./contract";
import { validateQuote } from "./quote";

describe("source quote verification", () => {
  it("accepts an original quote with case, whitespace and quote-character normalization", () => {
    expect(validateQuote('3.1. Ведение  «реестра»\nдоговоров.', 'ведение "реестра" договоров')).toBe(true);
  });
  it("rejects fabricated, paraphrased and empty quotes", () => {
    for (const quote of ["проводит закупочные процедуры", "создает реестр", "", " \n "]) expect(validateQuote("ведение реестра договоров", quote)).toBe(false);
  });
});
describe("shared result contract", () => {
  it("accepts the coherent synthetic frontend example", () => {
    expect(AnalysisResultSchema.parse(example).isMock).toBe(true);
  });
  it("rejects broken references, wrong summaries and unsupported conclusions", () => {
    const brokenRef = structuredClone(example); brokenRef.functions[0].unitId = "invented";
    const brokenCount = structuredClone(example); brokenCount.summary.findingsByType.LOSS = 8;
    const brokenConclusion = structuredClone(example); brokenConclusion.conclusion.sections[0].findingIds = ["invented"];
    for (const invalid of [brokenRef, brokenCount, brokenConclusion]) expect(AnalysisResultSchema.safeParse(invalid).success).toBe(false);
  });
  it("rejects missing clause references, reused alignment clauses and incorrect alignment counts", () => {
    const missing = structuredClone(example); missing.functions[0].clauseId = "invented-clause";
    const duplicate = structuredClone(example); duplicate.alignments.push({ ...duplicate.alignments[0], id: "duplicate-pair" });
    const counts = structuredClone(example); counts.summary.alignmentsByStatus.SUBSTANTIVE = 999;
    for (const value of [missing, duplicate, counts]) expect(AnalysisResultSchema.safeParse(value).success).toBe(false);
  });
  it("rejects a verified finding with a fabricated citation", () => {
    const invalid = structuredClone(example); invalid.findings[0].evidence[0].quote = "выдуманная функция";
    expect(AnalysisResultSchema.safeParse(invalid).success).toBe(false);
  });
  it("enforces relationship cardinality and rejects extra review fields", () => {
    expect(UnitChangeSchema.safeParse({ ...example.unitChanges[0], status: "MERGED" }).success).toBe(false);
    expect(ReviewInputSchema.safeParse({ status: "CONFIRMED", verified: true }).success).toBe(false);
  });
});
