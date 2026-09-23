import { after } from "next/server";
import { ReviewInputSchema } from "@/shared/contract";
import { getJobStore } from "./store";
import { executeAnalysis } from "./pipeline";
import { errorResponse, json, readJson, readUploads } from "./http";
import { AppError } from "./errors";

export async function createAnalysis(request: Request) {
  try {
    const files = await readUploads(request);
    const store = getJobStore();
    const job = await store.create();
    after(async () => {
      // Pipeline errors are persisted; never expose filesystem internals in logs.
      try { await executeAnalysis(job.id, files, store); }
      catch { console.error("AnalysisPersistenceError"); }
    });
    return json({ id: job.id }, 202);
  } catch (error) { return errorResponse(error); }
}

export async function getAnalysis(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { return json(await getJobStore().get((await context.params).id)); }
  catch (error) { return errorResponse(error); }
}

export async function reviewFinding(request: Request, context: { params: Promise<{ id: string; findingId: string }> }) {
  try {
    const input = ReviewInputSchema.safeParse(await readJson(request));
    if (!input.success) throw new AppError(400, "Некорректный статус или комментарий проверки.");
    const { id, findingId } = await context.params;
    return json(await getJobStore().review(id, findingId, input.data));
  } catch (error) { return errorResponse(error); }
}
