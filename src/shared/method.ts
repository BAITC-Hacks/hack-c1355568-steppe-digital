import type { AnalysisMethod, ClauseAlignment } from "./contract";

/** Clause alignment already records how a pair was matched; reuse it instead of re-deriving provenance. */
const fromAlignment: Record<ClauseAlignment["method"], AnalysisMethod> = {
  exact: "rule", fuzzy: "text_similarity", embedding: "embedding", llm: "llm",
};
export function methodOfAlignment(alignment?: Pick<ClauseAlignment, "method">): AnalysisMethod {
  return alignment ? fromAlignment[alignment.method] : "rule";
}
