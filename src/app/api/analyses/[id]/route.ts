import { getJobStore } from "@/server/store";
import { errorResponse, json } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { return json(await getJobStore().get((await context.params).id)); }
  catch (error) { return errorResponse(error); }
}
