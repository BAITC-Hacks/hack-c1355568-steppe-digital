import { AppError, publicError } from "./errors";
import { LIMITS, validateUploads, type UploadInput } from "./ingest";

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
export function errorResponse(error: unknown): Response {
  return json({ error: publicError(error) }, error instanceof AppError ? error.status : 500);
}

/** Cap bytes while reading, before the multipart decoder allocates file buffers. */
export async function readBody(request: Request, maxBytes: number): Promise<Uint8Array> {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > maxBytes) throw new AppError(413, "Превышен лимит запроса.");
  const reader = request.body?.getReader();
  if (!reader) throw new AppError(400, "Пустой запрос.");
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > maxBytes) { await reader.cancel(); throw new AppError(413, "Превышен лимит запроса."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}
export async function readUploads(request: Request): Promise<UploadInput[]> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) throw new AppError(415, "Используйте multipart/form-data с before[] и after[].");
  const body = await readBody(request, LIMITS.requestBytes);
  let form: FormData;
  try { form = await new Response(body as BodyInit, { headers: { "content-type": contentType } }).formData(); }
  catch { throw new AppError(400, "Не удалось прочитать multipart-запрос."); }
  const files: UploadInput[] = [];
  for (const [key, value] of form.entries()) {
    if (!["before[]", "after[]"].includes(key) || typeof value === "string") throw new AppError(400, "Ожидаются только файлы before[] и after[].");
    if (value.size > LIMITS.fileBytes) throw new AppError(413, "Файл превышает 10 MiB.");
    files.push({ name: value.name, side: key === "before[]" ? "before" : "after", bytes: new Uint8Array(await value.arrayBuffer()) });
  }
  validateUploads(files); return files;
}
export async function readJson(request: Request): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new AppError(415, "Ожидается application/json.");
  const body = await readBody(request, 32 * 1024);
  try { return JSON.parse(new TextDecoder().decode(body)); } catch { throw new AppError(400, "Некорректный JSON."); }
}
