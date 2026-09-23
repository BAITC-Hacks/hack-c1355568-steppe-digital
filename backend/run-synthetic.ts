/** Reproduce from inputs only; never reads evaluation expectations. */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { runAnalysis } from "./pipeline";
async function main() {
  const files = await Promise.all((["before", "after"] as const).map(async side => ({ side, name: `${side}.docx`, bytes: await readFile(`eval/synthetic/inputs/${side}.docx`) })));
  const result = await runAnalysis({ id: "synthetic-real", files });
  await mkdir(".data", { recursive: true });
  await writeFile(".data/synthetic-real-output.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ isMock: result.isMock, units: result.units.length, functions: result.functions.length, summary: result.summary, output: ".data/synthetic-real-output.json" }, null, 2));
}
main().catch(() => { console.error("SyntheticRuntimeFailed"); process.exitCode = 1; });
