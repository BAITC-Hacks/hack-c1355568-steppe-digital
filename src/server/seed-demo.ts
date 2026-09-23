import example from "@/shared/analysis-result.example.json";
import { AnalysisResultSchema } from "@/shared/contract";
import { getJobStore } from "./store";

async function main() {
  const job = await getJobStore().seedDemo(AnalysisResultSchema.parse(example));
  console.log(`DEMO / MOCK DATA\nAnalysis ID: ${job.id}\nGET /api/analyses/${job.id}\nReview finding ID: finding-loss`);
}
main().catch(() => { console.error("DemoSeedError"); process.exitCode = 1; });
