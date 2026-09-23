import { ReviewInputSchema } from "@/shared/contract";
import { getJobStore } from "@/server/store";
import { AppError } from "@/server/errors";
import { errorResponse, json, readJson } from "@/server/http";

export const runtime = "nodejs";
export async function PATCH(request: Request, context: { params: Promise<{ id: string; findingId: string }> }) {
  try {
    const input = ReviewInputSchema.safeParse(await readJson(request));
    if (!input.success) throw new AppError(400, "Некорректный статус или комментарий проверки.");
    const { id, findingId } = await context.params;
    return json(await getJobStore().review(id, findingId, input.data));
  } catch (error) { return errorResponse(error); }
}
