import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { runAnalysis } from "./pipeline";
import { parseClauses, alignClauses } from "./clauses";
import { ingestDocument } from "./ingest";
import { AnalysisResultSchema } from "@/shared/contract";
import { wordDiff } from "@/components/word-diff";
let directory: string;
afterEach(async () => { vi.unstubAllEnvs(); if (directory) await rm(directory, { recursive: true, force: true }); });
describe("regulation samples: real documents, no model/network dependency", () => {
  it("parses both editions, preserves renumbered rights and detects document defects with real evidence", async () => {
    vi.stubEnv("ORGTRACE_AI", "false"); directory = await mkdtemp(path.join(os.tmpdir(), "orgtrace-regulations-")); vi.stubEnv("ORGTRACE_DATA_DIR", directory);
    const files = await Promise.all((["before", "after"] as const).map(async side => {
      const dir = path.join(process.cwd(), "data/samples", side), name = (await readdir(dir))[0];
      return { side, name, bytes: await readFile(path.join(dir, name)) };
    }));
    const stages: string[] = [];
    const result = await runAnalysis({ id: "sample-check", files, onStage: async stage => { if (stage.status === "done") stages.push(stage.key); } });
    expect(result.isMock).toBe(false); expect(stages).toHaveLength(10); expect(AnalysisResultSchema.safeParse(result).success).toBe(true);
    expect(result.clauses.some(c => c.kind === "empty" && c.number === "5.5.3" && c.side === "before")).toBe(true);
    expect(result.clauses.some(c => c.kind === "toc")).toBe(true);
    const before = result.clauses.find(c => c.side === "before" && c.number === "5.8.1" && !c.letter)!;
    const after = result.clauses.find(c => c.side === "after" && c.number === "5.7.1" && !c.letter)!;
    expect(result.alignments.find(a => a.beforeClauseId === before.id)?.afterClauseId).toBe(after.id);
    expect(result.functions.some(f => f.clauseId === after.id && f.category === "right")).toBe(true);
    for (const abbreviation of ["ДИТААД", "ДОА"]) {
      const unit = result.units.find(u => u.side === "after" && u.abbreviation === abbreviation)!;
      expect(unit).toBeDefined(); expect(result.unitChanges.find(c => c.afterUnitIds.includes(unit.id))?.status).toBe("CREATED");
    }
    for (const abbreviation of ["ДНМ", "ДККМ"]) {
      const unit = result.units.find(u => u.side === "after" && u.abbreviation === abbreviation)!;
      expect(result.unitChanges.find(c => c.afterUnitIds.includes(unit.id))?.status).toBe("PRESERVED");
    }
    expect(result.findings.some(f => f.type === "BROKEN_REFERENCE" && f.evidence.some(e => e.locator.section === "5.10.2"))).toBe(true);
    expect(result.findings.some(f => f.type === "UNDEFINED_ROLE" && f.evidence.some(e => e.locator.section === "9.37"))).toBe(true);
    expect(result.findings.some(f => f.type === "AMBIGUITY" && f.evidence.some(e => e.locator.section === "5.3"))).toBe(true);
    expect(result.lineage.some(l => l.beforeClauseNumber === "5.4.4 а" && l.afterClauseNumber === "5.3.3 а" && l.status === "TRANSFERRED")).toBe(true);
    expect(result.lineage.some(l => l.beforeClauseNumber === "5.4.2" && l.afterClauseNumber === "5.4.2" && l.status === "UNCHANGED")).toBe(true);
    expect(result.lineage.some(l => l.beforeClauseNumber === "5.3.2" && l.afterClauseNumber === "5.4.2")).toBe(false);
    expect(result.lineage.some(l => l.beforeClauseNumber === "9.37" && l.afterClauseNumber === "9.37" && l.status === "TRANSFERRED")).toBe(true);
    // A loss reports a verified quotation and an exhausted search; the interpretation still needs review.
    expect(result.findings.filter(f => f.type === "LOSS").every(f => f.verified && f.searchTrace && f.evidence.some(e => e.side === "before") && f.review.status === "NEEDS_CHECK")).toBe(true);
    console.info(JSON.stringify({ clauses: result.clauses.length, units: result.units.length, functions: result.functions.length, summary: result.summary }));
  }, 30_000);
  it("separates glued clauses, keeps non-reset letters and rejects a forged clause reference", async () => {
    const input = await ingestDocument({ name: "source.txt", side: "before", bytes: Buffer.from("\ufeff3. Структура\n3.9. Текст. 3.10.Работники работают.\n2.3.3. Перечень:\nд. Первый пункт\n5.5.3. ;\nОглавление\n3. СТРУКТУРА 8") });
    const parsed = parseClauses(input.fragments);
    expect(parsed.clauses.find(c => c.number === "3.10")?.text).toBe("3.10.Работники работают.");
    expect(parsed.clauses.find(c => c.letter === "д")?.parentNumber).toBe("2.3.3");
    expect(alignClauses(parsed.clauses).every(a => a.status === "ONLY_BEFORE")).toBe(true);
  });
  it("word highlighting preserves exact whitespace and handles repeated words", () => {
    const diff = wordDiff("право право\nна доступ", "право\nна полный доступ");
    expect(diff.before.map(p => p.text).join("")).toBe("право право\nна доступ");
    expect(diff.after.map(p => p.text).join("")).toBe("право\nна полный доступ");
    expect(diff.after.some(p => p.changed && p.text === "полный")).toBe(true);
  });
});
