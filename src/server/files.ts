import { createHash } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const dataDirectory = () => path.resolve(process.env.ORGTRACE_DATA_DIR || ".data");
export const cacheDirectory = () => path.resolve(process.env.ORGTRACE_CACHE_DIR || ".cache");
export const hash = (input: string | Uint8Array) => createHash("sha256").update(input).digest("hex");
export async function atomicJson(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2), { mode: 0o600 });
  await rename(temp, file);
}
