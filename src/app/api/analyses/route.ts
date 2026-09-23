import { after } from "next/server";
import { getJobStore } from "@/server/store";
import { executeAnalysis } from "@/server/pipeline";
import { errorResponse, json, readUploads } from "@/server/http";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const files = await readUploads(request);
    const store = getJobStore();
    const job = await store.create();
    after(async () => {
      // executeAnalysis persists pipeline errors. Do not expose filesystem failures in logs.
      try { await executeAnalysis(job.id, files, store); }
      catch { console.error("AnalysisPersistenceError"); }
    });
    return json({ id: job.id }, 202);
  } catch (error) { return errorResponse(error); }
}
