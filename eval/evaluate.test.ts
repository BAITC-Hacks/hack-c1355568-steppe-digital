import { describe, expect, it } from "vitest";
import { evaluate, loadExpected, runChecks } from "./evaluate";

// Acceptance gate for the control pair (ред. 8 → 9). Expectations live in the QA fixture, so a
// deliberate change to analysis quality is reviewed as a change to tests/fixtures/samples.
describe("control samples against the agreed expectations", () => {
  it("meets every expectation in tests/fixtures/samples/expected-findings.json", async () => {
    const expected = await loadExpected();
    const { result } = await evaluate();
    const failed = runChecks(result, expected).filter(c => !c.ok);
    expect(failed.map(c => `${c.name} — ${c.detail}`)).toEqual([]);
  }, 60_000);
});
