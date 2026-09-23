import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as XLSX from "xlsx";
import frontendMock from "@/mocks/analysis-result.json";
import example from "@/shared/analysis-result.example.json";
import { AnalysisResultSchema } from "@/shared/contract";
import { POST } from "@/app/api/analyses/route";
import { GET } from "@/app/api/analyses/[id]/route";
import { PATCH } from "@/app/api/analyses/[id]/findings/[findingId]/review/route";
import { getJobStore } from "./store";

const tasks = vi.hoisted(() => [] as (() => Promise<void>)[]);
vi.mock("next/server", () => ({ after: (task: () => Promise<void>) => { tasks.push(task); } }));
let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "orgtrace-frontend-contract-"));
  vi.stubEnv("ORGTRACE_DATA_DIR", directory); vi.stubEnv("ORGTRACE_AI", "false"); vi.stubEnv("NEXT_PUBLIC_USE_MOCK", "false");
  tasks.length = 0; vi.resetModules();
});
afterEach(async () => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });

// Drive the actual frontend adapter through the actual route exports, without a network server.
function connectRoutes() {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit = {}) => {
    const request = new Request(new URL(url, "http://localhost"), init);
    if (init.method === "POST") {
      const response = await POST(request);
      for (const task of tasks.splice(0)) await task();
      return response;
    }
    const parts = new URL(request.url).pathname.split("/");
    const id = parts[3];
    if (init.method === "PATCH") return PATCH(request, { params: Promise.resolve({ id, findingId: parts[5] }) });
    return GET(request, { params: Promise.resolve({ id }) });
  }));
}

describe("frontend and relocated backend compatibility", () => {
  it("accepts the frontend's complete mock without changing the shared contract", () => {
    expect(AnalysisResultSchema.parse(frontendMock).isMock).toBe(true);
  });
  it("supports the real frontend create/poll adapter and multipart field names", async () => {
    connectRoutes();
    const api = await import("@/lib/api");
    const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Отдел", "Функция"]]), "Структура");
    const bytes = new Uint8Array(XLSX.write(book, { type: "buffer", bookType: "xlsx" }));
    const created = await api.createAnalysis([new File([bytes], "before.xlsx")], [new File([bytes], "after.xlsx")]);
    const onUpdate = vi.fn();
    const job = await api.getAnalysis(created.id, { signal: new AbortController().signal, onUpdate });
    expect(job.status).toBe("done"); expect(job.result?.documents).toHaveLength(2);
    expect(onUpdate).toHaveBeenCalledOnce();
  });
  it("returns and persists the full Finding expected by frontend review, preserving omitted comments", async () => {
    connectRoutes(); const api = await import("@/lib/api");
    const job = await getJobStore().seedDemo(AnalysisResultSchema.parse(example));
    await api.reviewFinding(job.id, "finding-loss", { status: "CONFIRMED", comment: "Проверено" });
    const updated = await api.reviewFinding(job.id, "finding-loss", { status: "NEEDS_CHECK" });
    expect(updated.review).toMatchObject({ status: "NEEDS_CHECK", comment: "Проверено" });
    const reloaded = await api.getAnalysis(job.id, { signal: new AbortController().signal, onUpdate: () => undefined });
    expect(reloaded.result?.findings[0].review).toEqual(updated.review);
  });
  it("keeps the same comment semantics in browser demo mode and does not call fetch", async () => {
    vi.stubEnv("NEXT_PUBLIC_USE_MOCK", "true");
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    const api = await import("@/lib/api");
    const file = new File(["synthetic placeholder; not parsed in mock mode"], "demo.docx");
    const { id } = await api.createAnalysis([file], [file]);
    const job = await api.getAnalysis(id, { signal: new AbortController().signal, onUpdate: () => undefined });
    const findingId = job.result!.findings[0].id;
    await api.reviewFinding(id, findingId, { status: "CONFIRMED", comment: "Сохранить комментарий" });
    const updated = await api.reviewFinding(id, findingId, { status: "NEEDS_CHECK" });
    expect(updated.review.comment).toBe("Сохранить комментарий");
    expect(fetch).not.toHaveBeenCalled();
  });
});
