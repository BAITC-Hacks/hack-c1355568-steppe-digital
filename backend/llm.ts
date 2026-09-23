import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { atomicJson, cacheDirectory, hash } from "./files";
import { AppError } from "./errors";
export { validateQuote } from "@/shared/quote";

export const EMBEDDING_MODEL = "text-embedding-3-small";
const CACHE_VERSION = "orgtrace-llm-v1";

function client(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new AppError(503, "OpenAI не настроен: отсутствует ключ API.");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 30_000, maxRetries: 0 });
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
async function cached<T>(key: unknown, schema: z.ZodType<T>, operation: () => Promise<unknown>): Promise<T> {
  const filename = path.join(cacheDirectory(), `${hash(stable({ version: CACHE_VERSION, key }))}.json`);
  try { return schema.parse(JSON.parse(await readFile(filename, "utf8"))); } catch { /* Miss or invalid entry; revalidate new output. */ }
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = schema.parse(await operation());
      await atomicJson(filename, result);
      return result;
    } catch (error) {
      lastError = error;
      if (error instanceof AppError) throw error;
      if (error instanceof OpenAI.APIError && error.status && error.status < 500 && ![408, 429].includes(error.status)) break;
      if (attempt < 2) await new Promise(resolve => setTimeout(resolve, Math.min(500 * 2 ** attempt, 2000)));
    }
  }
  if (lastError instanceof OpenAI.APIError && lastError.status === 429) throw new AppError(503, "Лимит запросов OpenAI. Повторите попытку позже.");
  throw new AppError(502, "OpenAI не вернул корректный ответ после ограниченного числа попыток.");
}

/** Every interpreting schema must include fragmentId + quote for each claim. */
export async function structuredChat<T>(options: {
  schema: z.ZodType<T>; schemaName: string; promptVersion: string; system: string; input: string;
}): Promise<T> {
  const model = process.env.OPENAI_MODEL;
  if (!model) throw new AppError(503, "OpenAI не настроен: выберите модель.");
  const format = zodResponseFormat(options.schema, options.schemaName);
  const messages = [{ role: "system" as const, content: options.system }, { role: "user" as const, content: options.input }];
  return cached({ operation: "chat", model, messages, format, promptVersion: options.promptVersion }, options.schema, async () => {
    const response = await client().chat.completions.parse({ model, messages, response_format: format });
    const message = response.choices[0]?.message;
    if (!message || message.refusal || !message.parsed) throw new Error("InvalidStructuredOutput");
    return message.parsed;
  });
}

export async function embed(input: string[]): Promise<number[][]> {
  if (!input.length) return [];
  const model = process.env.OPENAI_EMBEDDING_MODEL || EMBEDDING_MODEL;
  const schema = z.array(z.array(z.number().finite()).min(1)).length(input.length)
    .refine(vectors => vectors.every(v => v.length === vectors[0]?.length));
  return cached({ operation: "embeddings", model, input, encodingFormat: "float" }, schema, async () => {
    const response = await client().embeddings.create({ model, input, encoding_format: "float" });
    return response.data.sort((a, b) => a.index - b.index).map(item => item.embedding);
  });
}
