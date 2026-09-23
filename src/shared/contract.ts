import { z } from "zod";
import { validateQuote } from "./quote";

export const CONTRACT_VERSION = "0.1.0";
export const SideSchema = z.enum(["before", "after"]);
export const DocumentTypeSchema = z.enum(["structure", "regulation", "job_description", "order", "other"]);
export const UnitStatusSchema = z.enum(["PRESERVED", "RENAMED", "MERGED", "SPLIT", "CREATED", "REMOVED"]);
export const LineageStatusSchema = z.enum(["UNCHANGED", "TRANSFERRED", "MODIFIED", "NEW", "POSSIBLE_LOSS"]);
export const FindingTypeSchema = z.enum(["LOSS", "DUPLICATION", "CONFLICT", "REORGANIZATION"]);
export const RoleSchema = z.enum(["execute", "control", "approve", "audit", "support", "other"]);
export const ReviewPrioritySchema = z.enum(["HIGH", "MEDIUM", "LOW"]);
export const ConfidenceSchema = z.enum(["high", "medium", "low"]);
export const ReviewStatusSchema = z.enum(["NOT_REVIEWED", "CONFIRMED", "REJECTED", "NEEDS_CHECK"]);
export const StageKeySchema = z.enum(["ingest", "units", "functions", "lineage", "findings", "verify", "conclusion"]);
export const StageStatusSchema = z.enum(["pending", "running", "done", "failed"]);
export const JobStatusSchema = z.enum(["queued", "running", "done", "failed"]);
export const ConclusionKeySchema = z.enum(["orgChanges", "functionPreservation", "possibleLosses", "duplication", "conflicts", "needsHumanReview"]);
const id = z.string().min(1);
const text = z.string().min(1);
const count = z.number().int().nonnegative();

export const LocatorSchema = z.strictObject({
  page: z.number().int().positive().optional(), section: text.optional(),
  row: z.number().int().positive().optional(), label: text,
});
export const EvidenceSchema = z.strictObject({
  fragmentId: id, documentName: text, side: SideSchema, locator: LocatorSchema,
  quote: text, fragmentText: text, verified: z.boolean(),
}).refine(e => !e.verified || validateQuote(e.fragmentText, e.quote), {
  message: "Verified evidence must contain the quoted text", path: ["quote"],
});
export const DocumentInfoSchema = z.strictObject({
  id, name: text, side: SideSchema, docType: DocumentTypeSchema,
  fragmentCount: count, warnings: z.array(text),
});
export const UnitSchema = z.strictObject({
  id, side: SideSchema, name: text, normalizedName: text,
  parentName: text.optional(), evidence: z.array(EvidenceSchema),
});
export const UnitChangeSchema = z.strictObject({
  id, beforeUnitIds: z.array(id), afterUnitIds: z.array(id), status: UnitStatusSchema,
  rationale: text, evidence: z.array(EvidenceSchema),
}).refine(c => {
  const b = c.beforeUnitIds.length, a = c.afterUnitIds.length;
  switch (c.status) {
    case "PRESERVED": case "RENAMED": return b === 1 && a === 1;
    case "MERGED": return b >= 2 && a === 1;
    case "SPLIT": return b === 1 && a >= 2;
    case "CREATED": return b === 0 && a === 1;
    case "REMOVED": return b === 1 && a === 0;
  }
}, "Unit status and relationship cardinality disagree");
export const OrgFunctionSchema = z.strictObject({
  id, unitId: id, side: SideSchema, text, action: text, object: text, process: text,
  role: RoleSchema, evidence: z.array(EvidenceSchema),
});
export const CandidateSchema = z.strictObject({ functionId: id, reason: text });
export const FunctionLineageSchema = z.strictObject({
  id, beforeFunctionIds: z.array(id), afterFunctionIds: z.array(id), status: LineageStatusSchema,
  rationale: text, candidatesChecked: z.array(CandidateSchema),
}).refine(l => {
  const b = l.beforeFunctionIds.length, a = l.afterFunctionIds.length;
  if (l.status === "NEW") return b === 0 && a > 0;
  if (l.status === "POSSIBLE_LOSS") return b > 0 && a === 0;
  return b > 0 && a > 0;
}, "Lineage status and relationship cardinality disagree");
export const ReviewInputSchema = z.strictObject({
  status: ReviewStatusSchema, comment: z.string().max(4000).optional(),
});
export const ReviewSchema = ReviewInputSchema.extend({ updatedAt: z.iso.datetime().optional() });
export const SearchTraceSchema = z.strictObject({
  checkedCount: count, topCandidates: z.array(CandidateSchema),
}).refine(s => s.checkedCount >= s.topCandidates.length, "Candidate count cannot exceed checked count");
export const FindingSchema = z.strictObject({
  id, type: FindingTypeSchema, reviewPriority: ReviewPrioritySchema, confidence: ConfidenceSchema,
  title: text, explanation: text, unitIds: z.array(id), functionIds: z.array(id),
  evidence: z.array(EvidenceSchema), searchTrace: SearchTraceSchema.optional(),
  recommendation: text, verified: z.boolean(), review: ReviewSchema,
}).superRefine((f, ctx) => {
  if (f.verified && (!f.evidence.length || f.evidence.some(e => !e.verified))) {
    ctx.addIssue({ code: "custom", message: "Verified findings require verified evidence for every claim" });
  }
  if (f.verified && f.type === "LOSS" && (!f.searchTrace || !f.evidence.some(e => e.side === "before"))) {
    ctx.addIssue({ code: "custom", message: "Loss requires BEFORE evidence and search trace" });
  }
});
export const SummarySchema = z.strictObject({
  unitsByStatus: z.strictObject({ PRESERVED: count, RENAMED: count, MERGED: count, SPLIT: count, CREATED: count, REMOVED: count }),
  functionsByStatus: z.strictObject({ UNCHANGED: count, TRANSFERRED: count, MODIFIED: count, NEW: count, POSSIBLE_LOSS: count }),
  findingsByType: z.strictObject({ LOSS: count, DUPLICATION: count, CONFLICT: count, REORGANIZATION: count }),
});
export const ConclusionSectionSchema = z.strictObject({ key: ConclusionKeySchema, title: text, text, findingIds: z.array(id) });
export const ConclusionSchema = z.strictObject({ sections: z.array(ConclusionSectionSchema) }).refine(
  c => c.sections.map(s => s.key).join() === ConclusionKeySchema.options.join(),
  "Conclusion must have the six sections in contract order",
);

export const AnalysisResultSchema = z.strictObject({
  id, isMock: z.boolean(), documents: z.array(DocumentInfoSchema), summary: SummarySchema,
  units: z.array(UnitSchema), unitChanges: z.array(UnitChangeSchema), functions: z.array(OrgFunctionSchema),
  lineage: z.array(FunctionLineageSchema), findings: z.array(FindingSchema), conclusion: ConclusionSchema,
  warnings: z.array(text),
}).superRefine((r, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  for (const items of [r.documents, r.units, r.unitChanges, r.functions, r.lineage, r.findings]) {
    if (new Set(items.map(x => x.id)).size !== items.length) issue("IDs must be unique within each collection");
  }
  const units = new Map(r.units.map(u => [u.id, u]));
  const functions = new Map(r.functions.map(f => [f.id, f]));
  const findings = new Map(r.findings.map(f => [f.id, f]));
  const checkIds = (ids: string[], map: Map<string, { side: string }>, side?: string) => {
    if (new Set(ids).size !== ids.length) issue("Duplicate relationship reference");
    for (const ref of ids) if (!map.has(ref) || (side && map.get(ref)?.side !== side)) issue("Missing or wrong-side reference");
  };
  const usedUnits = new Set<string>(), usedFunctions = new Set<string>();
  for (const c of r.unitChanges) {
    checkIds(c.beforeUnitIds, units, "before"); checkIds(c.afterUnitIds, units, "after");
    for (const ref of [...c.beforeUnitIds, ...c.afterUnitIds]) {
      if (usedUnits.has(ref)) issue("Unit occurs in multiple changes"); usedUnits.add(ref);
    }
  }
  for (const f of r.functions) checkIds([f.unitId], units, f.side);
  for (const l of r.lineage) {
    checkIds(l.beforeFunctionIds, functions, "before"); checkIds(l.afterFunctionIds, functions, "after");
    checkIds(l.candidatesChecked.map(c => c.functionId), functions, "after");
    for (const ref of [...l.beforeFunctionIds, ...l.afterFunctionIds]) {
      if (usedFunctions.has(ref)) issue("Function occurs in multiple lineage records"); usedFunctions.add(ref);
    }
  }
  for (const f of r.findings) {
    checkIds(f.unitIds, units); checkIds(f.functionIds, functions);
    if (f.searchTrace) checkIds(f.searchTrace.topCandidates.map(c => c.functionId), functions, "after");
  }
  const evidence = [...r.units, ...r.unitChanges, ...r.functions, ...r.findings].flatMap(x => x.evidence);
  const fragments = new Map<string, Evidence>();
  for (const e of evidence) {
    if (!r.documents.some(d => d.name === e.documentName && d.side === e.side)) issue("Evidence document is missing");
    const previous = fragments.get(e.fragmentId);
    if (previous && (previous.fragmentText !== e.fragmentText || previous.documentName !== e.documentName || previous.side !== e.side || JSON.stringify(previous.locator) !== JSON.stringify(e.locator))) issue("Fragment identity is inconsistent");
    fragments.set(e.fragmentId, e);
  }
  for (const section of r.conclusion.sections) {
    for (const ref of section.findingIds) if (!findings.get(ref)?.verified) issue("Conclusion references an absent or unverified finding");
  }
  for (const status of UnitStatusSchema.options) if (r.summary.unitsByStatus[status] !== r.unitChanges.filter(c => c.status === status).length) issue("Incorrect unit summary");
  for (const status of LineageStatusSchema.options) if (r.summary.functionsByStatus[status] !== r.lineage.filter(l => l.status === status).length) issue("Incorrect function summary");
  for (const type of FindingTypeSchema.options) if (r.summary.findingsByType[type] !== r.findings.filter(f => f.verified && f.type === type).length) issue("Incorrect finding summary");
});
export const StageSchema = z.strictObject({ key: StageKeySchema, label: text, status: StageStatusSchema, detail: text.optional() });
export const AnalysisJobSchema = z.strictObject({
  id, status: JobStatusSchema, stages: z.array(StageSchema), error: text.optional(), result: AnalysisResultSchema.optional(),
}).superRefine((j, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  if (j.stages.map(s => s.key).join() !== StageKeySchema.options.join()) issue("Stage order must match the contract");
  if (j.status === "done" && (!j.result || j.stages.some(s => s.status !== "done") || j.error)) issue("Completed job requires a result and completed stages");
  if (j.status !== "done" && j.result) issue("Only a completed job may contain a result");
  if (j.result && j.result.id !== j.id) issue("Job and result IDs disagree");
  if (j.status === "failed" && !j.error) issue("Failed job requires an error");
  if (j.status === "queued" && j.stages.some(s => s.status !== "pending")) issue("Queued stages must be pending");
});
export const CreateAnalysisResponseSchema = z.strictObject({ id });
export const ApiErrorSchema = z.strictObject({ error: text });

export type Side = z.infer<typeof SideSchema>;
export type Locator = z.infer<typeof LocatorSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type DocumentInfo = z.infer<typeof DocumentInfoSchema>;
export type Unit = z.infer<typeof UnitSchema>;
export type UnitChange = z.infer<typeof UnitChangeSchema>;
export type OrgFunction = z.infer<typeof OrgFunctionSchema>;
export type FunctionLineage = z.infer<typeof FunctionLineageSchema>;
export type Finding = z.infer<typeof FindingSchema>;
export type Summary = z.infer<typeof SummarySchema>;
export type Conclusion = z.infer<typeof ConclusionSchema>;
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
export type AnalysisJob = z.infer<typeof AnalysisJobSchema>;
export type Stage = z.infer<typeof StageSchema>;
export type StageKey = z.infer<typeof StageKeySchema>;
export type ReviewInput = z.infer<typeof ReviewInputSchema>;
export type CreateAnalysisResponse = z.infer<typeof CreateAnalysisResponseSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
