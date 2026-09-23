/** Checks the analysis of the control pair against tests/fixtures/samples/expected-findings.json.
 *  Deterministic mode by default; pass --ai to evaluate a run with embeddings and the model enabled.
 *  Usage: node --import tsx eval/evaluate.ts [--ai] [--json] */
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AnalysisResult, Finding, FunctionLineage } from "@/shared/contract";

type ExpectedUnit = { name: string; side: "before" | "after"; status: string; renamedTo?: string; parent?: string };
type ExpectedLineage = { before: string; after: string | null; status: string; category?: string };
type ExpectedFinding = {
  type: Finding["type"]; beforeClause?: string; afterClause?: string; afterClauses?: string[]; beforeClauses?: string[];
  unit?: string; side?: "before" | "after"; verified?: boolean; searchTrace?: boolean;
  reviewPriority?: string; review?: string; confidenceAtMost?: "low" | "medium" | "high";
};
export type Expected = {
  unitsByStatus: Record<string, number>; functionsByStatus: Record<string, number>;
  units: ExpectedUnit[]; lineage: ExpectedLineage[];
  findings: { byType: Record<Finding["type"], number>; expected: ExpectedFinding[] };
};
const flags = new Set(process.argv.slice(2));

export type Check = { name: string; ok: boolean; detail: string };
let checks: Check[] = [];
const check = (name: string, ok: boolean, detail = "") => checks.push({ name, ok, detail });
const eq = (name: string, actual: unknown, want: unknown) =>
  check(name, JSON.stringify(actual) === JSON.stringify(want), `ожидалось ${JSON.stringify(want)}, получено ${JSON.stringify(actual)}`);
export const loadExpected = async (): Promise<Expected> =>
  JSON.parse(await readFile("tests/fixtures/samples/expected-findings.json", "utf8")) as Expected;

export async function evaluate() {
  if (!flags.has("--ai")) process.env.ORGTRACE_AI = "false";
  process.env.ORGTRACE_DATA_DIR = await mkdtemp(path.join(os.tmpdir(), "orgtrace-eval-"));
  const { runAnalysis } = await import("@backend/pipeline");
  const files: { side: "before" | "after"; name: string; bytes: Buffer }[] = [];
  for (const side of ["before", "after"] as const)
    for (const name of await readdir(`data/samples/${side}`))
      files.push({ side, name, bytes: await readFile(path.join(`data/samples/${side}`, name)) });
  const started = Date.now();
  const result = await runAnalysis({ id: "evaluate", files });
  return { result, ms: Date.now() - started };
}

export function runChecks(result: AnalysisResult, expected: Expected): Check[] {
  checks = [];
  const clauseOf = (functionId: string) => {
    const f = result.functions.find(x => x.id === functionId)!;
    const c = result.clauses.find(c => c.id === f.clauseId)!;
    return { number: [c.number, c.letter].filter(Boolean).join(" "), category: f.category, side: c.side };
  };
  const beforeNumbers = (l: FunctionLineage) => l.beforeFunctionIds.map(id => clauseOf(id).number);
  const afterNumbers = (l: FunctionLineage) => l.afterFunctionIds.map(id => clauseOf(id).number);
  const sections = (f: Finding) => f.evidence.map(e => e.locator.section ?? "");

  eq("summary.unitsByStatus", result.summary.unitsByStatus, expected.unitsByStatus);
  eq("summary.functionsByStatus", result.summary.functionsByStatus, expected.functionsByStatus);
  for (const type of Object.keys(expected.findings.byType) as Finding["type"][]) {
    const actual = result.findings.filter(f => f.type === type).length;
    check(`findings.${type}`, actual === expected.findings.byType[type], `ожидалось ${expected.findings.byType[type]}, получено ${actual}`);
  }
  for (const want of expected.units) {
    const unit = result.units.find(u => u.name === want.name && u.side === want.side && (!want.parent || u.parentName === want.parent));
    const change = unit && result.unitChanges.find(c => [...c.beforeUnitIds, ...c.afterUnitIds].includes(unit.id));
    const target = want.renamedTo && change?.afterUnitIds.map(id => result.units.find(u => u.id === id)!.name);
    check(`unit «${want.name}» → ${want.status}`, change?.status === want.status && (!want.renamedTo || !!target?.includes(want.renamedTo)),
      `получено ${change?.status ?? "нет записи"}${target ? ` → ${target.join(", ")}` : ""}`);
  }
  for (const want of expected.lineage) {
    const found = result.lineage.filter(l => beforeNumbers(l).includes(want.before)
      && (want.after === null ? !l.afterFunctionIds.length : afterNumbers(l).includes(want.after)));
    const hit = found.find(l => l.status === want.status);
    const rightCategory = !want.category || (hit && hit.beforeFunctionIds.every(id => clauseOf(id).category === want.category));
    check(`lineage ${want.before} → ${want.after ?? "—"} = ${want.status}`, !!hit && !!rightCategory,
      `получено ${found.map(l => l.status).join("/") || "нет записи"}`);
  }
  const losses = result.findings.filter(f => f.type === "LOSS");
  check("правило loss-verified", losses.length > 0 && losses.every(f => f.verified && !!f.searchTrace && f.evidence.some(e => e.side === "before")),
    `${losses.filter(f => f.verified && f.searchTrace).length} из ${losses.length} с проверенной цитатой и историей поиска`);
  check("правило loss-only-rights", losses.every(f => f.reviewPriority === "MEDIUM"), losses.map(f => f.reviewPriority).join(","));
  const titles = result.findings.filter(f => f.type === "REORGANIZATION").map(f => f.title);
  check("правило reorganization-one-per-unit", new Set(titles).size === titles.length, `${titles.length} находок, ${new Set(titles).size} уникальных`);
  const group = result.findings.filter(f => f.type === "AMBIGUITY" && /группового заголовка/u.test(f.title));
  check("правило group-ambiguity-aggregated", group.length === 1, `находок про групповой заголовок: ${group.length}`);
  check("правило all-needs-check", result.findings.every(f => f.review.status === "NEEDS_CHECK"),
    [...new Set(result.findings.map(f => f.review.status))].join(","));

  const rank = { low: 0, medium: 1, high: 2 };
  for (const w of expected.findings.expected) {
    const matches = result.findings.filter(f => f.type === w.type
      && (!w.beforeClause || f.functionIds.some(id => clauseOf(id).side === "before" && clauseOf(id).number === w.beforeClause) || sections(f).includes(w.beforeClause))
      && (!w.afterClause || sections(f).includes(w.afterClause) || f.functionIds.some(id => clauseOf(id).side === "after" && clauseOf(id).number === w.afterClause))
      && (!w.afterClauses || w.afterClauses.every(n => f.functionIds.some(id => clauseOf(id).number === n)))
      && (!w.beforeClauses || w.beforeClauses.every(n => sections(f).includes(n)))
      && (!w.unit || f.unitIds.some(id => result.units.find(u => u.id === id)?.name === w.unit))
      && (!w.side || f.evidence.every(e => e.side === w.side)));
    const first = matches[0];
    const ok = !!first
      && (w.verified === undefined || first.verified === w.verified)
      && (!w.searchTrace || !!first.searchTrace)
      && (!w.reviewPriority || first.reviewPriority === w.reviewPriority)
      && (!w.review || first.review.status === w.review)
      && (!w.confidenceAtMost || rank[first.confidence] <= rank[w.confidenceAtMost]);
    const label = [w.type, w.beforeClause, w.afterClause, w.afterClauses?.join("/"), w.unit].filter(Boolean).join(" ");
    check(`finding ${label}`, ok, first ? `найдено: verified=${first.verified} conf=${first.confidence} prio=${first.reviewPriority} review=${first.review.status}` : "не найдено");
  }
  return checks;
}

async function main() {
  const expected = await loadExpected();
  const { result, ms } = await evaluate();
  const checks = runChecks(result, expected);
  const failed = checks.filter(c => !c.ok);
  if (flags.has("--json")) console.log(JSON.stringify({ ms, mode: result.analysisMode, summary: result.summary, checks }, null, 2));
  else {
    for (const c of checks) console.log(`${c.ok ? "  ok  " : "  FAIL"}  ${c.name}${c.ok ? "" : ` — ${c.detail}`}`);
    console.log(`\nПроверок: ${checks.length}; провалено: ${failed.length}; длительность анализа: ${(ms / 1000).toFixed(1)} с`);
    console.log(`Режим: AI=${result.analysisMode?.aiEnabled}, LLM вызовов=${result.analysisMode?.llmCalls} (кэш ${result.analysisMode?.llmCached}), embeddings=${result.analysisMode?.embeddingCalls} (кэш ${result.analysisMode?.embeddingCached}), fallbacks=${result.analysisMode?.fallbacks.length}`);
  }
  process.exitCode = failed.length ? 1 : 0;
}
// Runs only when invoked directly; the vitest suite imports evaluate() and runChecks() instead.
if (/eval[\\/]evaluate\.ts$/u.test(process.argv[1] ?? "")) void main();
