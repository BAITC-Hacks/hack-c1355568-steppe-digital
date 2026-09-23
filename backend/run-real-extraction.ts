/** Проверка extraction. Без аргументов используются DOCX-копии TXT, не оригиналы Word. */
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Document, Packer, Paragraph } from "docx";
import { runAnalysis } from "./pipeline";

async function main() {
  const originalPaths = process.argv.slice(2);
  if (originalPaths.length && originalPaths.length !== 2) throw new Error("Передайте пути BEFORE.docx AFTER.docx");
  const files = await Promise.all((["before", "after"] as const).map(async (side, index) => {
    if (originalPaths.length) return { side, name: path.basename(originalPaths[index]), bytes: await readFile(originalPaths[index]) };
    const directory = `data/samples/${side}`;
    const name = (await readdir(directory)).find(n => n.endsWith(".docx.txt"))!;
    const source = await readFile(path.join(directory, name), "utf8");
    const bytes = await Packer.toBuffer(new Document({ sections: [{ children: source.replace(/^\uFEFF/u, "").split(/\r?\n/u).filter(t => t.trim()).map(text => new Paragraph(text)) }] }));
    return { side, name: name.replace(/\.txt$/u, ""), bytes };
  }));
  const result = await runAnalysis({ id: "real-extraction", files });
  await mkdir(".data", { recursive: true });
  await writeFile(".data/real-extraction-output.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ input: originalPaths.length ? "original DOCX" : "DOCX copies of repository TXT exports; original Word not verified", isMock: result.isMock,
    fragments: result.documents.map(d => d.fragmentCount), units: ["before", "after"].map(s => result.units.filter(u => u.side === s).length),
    functions: ["before", "after"].map(s => result.functions.filter(f => f.side === s).length), lineage: result.lineage.length, findings: result.findings.length,
    summary: result.summary, unitsExample: result.units.slice(0, 3), functionsExample: result.functions.slice(0, 5).map(f => ({ text: f.text, owner: result.units.find(u => u.id === f.unitId)?.name, evidence: f.evidence[0] })),
    lineageExample: result.lineage.find(l => l.status === "UNCHANGED"), output: ".data/real-extraction-output.json" }, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : "RealExtractionFailed"); process.exitCode = 1; });
