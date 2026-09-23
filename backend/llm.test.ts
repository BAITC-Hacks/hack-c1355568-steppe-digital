import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { z } from "zod";
import { embed, newUsage, structuredChat, withUsage } from "./llm";

const calls = vi.hoisted(() => ({ parse: vi.fn(), embeddings: vi.fn() }));
vi.mock("openai", () => {
  class APIError extends Error { status?: number; }
  class Client {
    static APIError = APIError;
    chat = { completions: { parse: calls.parse } };
    embeddings = { create: calls.embeddings };
  }
  return { default: Client };
});
let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "orgtrace-cache-"));
  vi.stubEnv("ORGTRACE_CACHE_DIR", directory);
  vi.stubEnv("OPENAI_API_KEY", "unit-test-placeholder");
  vi.stubEnv("OPENAI_MODEL", "unit-test-model");
  calls.parse.mockReset(); calls.embeddings.mockReset();
});
afterEach(async () => { vi.useRealTimers(); vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });
const request = { schema: z.object({ fragmentId: z.string(), quote: z.string() }), schemaName: "claim", promptVersion: "v1", system: "Extract supported claims only", input: "synthetic fragment" };
describe("cached AI helpers (mock transport; no network)", () => {
  it("caches validated chat outputs and invalidates by prompt version", async () => {
    calls.parse.mockResolvedValue({ choices: [{ message: { parsed: { fragmentId: "f1", quote: "synthetic" } } }] });
    expect(await structuredChat(request)).toEqual({ fragmentId: "f1", quote: "synthetic" });
    await structuredChat(request); expect(calls.parse).toHaveBeenCalledTimes(1);
    await structuredChat({ ...request, promptVersion: "v2" }); expect(calls.parse).toHaveBeenCalledTimes(2);
    expect((await readdir(directory)).length).toBe(2);
  });
  it("caches embeddings in input order", async () => {
    calls.embeddings.mockResolvedValue({ data: [{ index: 1, embedding: [0, 1] }, { index: 0, embedding: [1, 0] }] });
    expect(await embed(["first", "second"])).toEqual([[1, 0], [0, 1]]);
    await embed(["first", "second"]); expect(calls.embeddings).toHaveBeenCalledTimes(1);
  });
  it("caps retries, sanitizes provider errors and never caches a failure", async () => {
    calls.parse.mockRejectedValue(new Error("private-provider-response"));
    await expect(structuredChat(request)).rejects.toMatchObject({ status: 502 });
    expect(calls.parse).toHaveBeenCalledTimes(3); expect(await readdir(directory)).toEqual([]);
  });
  it("counts provider requests and cache hits separately, per run", async () => {
    calls.parse.mockResolvedValue({ choices: [{ message: { parsed: { fragmentId: "f1", quote: "synthetic" } } }] });
    calls.embeddings.mockResolvedValue({ data: [{ index: 0, embedding: [1, 0] }] });
    const first = newUsage();
    await withUsage(first, async () => { await structuredChat(request); await structuredChat(request); await embed(["first"]); });
    expect(first).toMatchObject({ chat: { calls: 1, cached: 1, model: "unit-test-model" }, embeddings: { calls: 1, cached: 0 } });
    // A second run reports its own usage: a warm cache is never reported as a fresh provider request.
    const second = newUsage();
    await withUsage(second, async () => { await structuredChat(request); });
    expect(second).toMatchObject({ chat: { calls: 0, cached: 1 }, embeddings: { calls: 0, cached: 0 } });
    expect(calls.parse).toHaveBeenCalledTimes(1);
  });
  it("fails with an actionable error when model configuration is missing", async () => {
    vi.stubEnv("OPENAI_MODEL", "");
    await expect(structuredChat(request)).rejects.toMatchObject({ status: 503 });
    expect(calls.parse).not.toHaveBeenCalled();
  });
});
