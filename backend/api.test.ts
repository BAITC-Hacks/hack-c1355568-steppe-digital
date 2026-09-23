import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as XLSX from "xlsx";
import { POST } from "@/app/api/analyses/route";
import { GET } from "@/app/api/analyses/[id]/route";
import { PATCH } from "@/app/api/analyses/[id]/findings/[findingId]/review/route";
import { getJobStore } from "./store";
import { AnalysisJobSchema, AnalysisResultSchema } from "@/shared/contract";
import example from "@/shared/analysis-result.example.json";

const tasks = vi.hoisted(() => [] as (() => Promise<void>)[]);
vi.mock("next/server", () => ({ after: (task: () => Promise<void>) => { tasks.push(task); } }));
let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(path.join(os.tmpdir(), "orgtrace-api-"));
  vi.stubEnv("ORGTRACE_DATA_DIR", directory); tasks.length = 0;
});
afterEach(async () => { vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });
function uploadRequest(corrupt = false) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([["Отдел закупок", "Ведение реестра"]]), "Структура");
  const bytes = corrupt ? new Uint8Array([1, 2, 3]) : new Uint8Array(XLSX.write(book, { type: "buffer", bookType: "xlsx" }));
  const form = new FormData();
  form.append("before[]", new Blob([bytes]), "before.xlsx"); form.append("after[]", new Blob([bytes]), "after.xlsx");
  return new Request("http://localhost/api/analyses", { method: "POST", body: form });
}
function reviewRequest(body: unknown) {
  return new Request("http://localhost/review", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
describe("API integration with real parsing and disk persistence", () => {
  it("creates a queued job, executes actual stage transitions and polls a valid labeled result", async () => {
    const response = await POST(uploadRequest()); expect(response.status).toBe(202);
    const { id } = await response.json();
    const initial = await GET(new Request("http://localhost"), { params: Promise.resolve({ id }) });
    expect((await initial.json()).status).toBe("queued");
    await tasks[0]();
    const polled = await GET(new Request("http://localhost"), { params: Promise.resolve({ id }) });
    const job = AnalysisJobSchema.parse(await polled.json());
    expect(job.status).toBe("done"); expect(job.result?.isMock).toBe(false);
    expect(job.result?.documents.map(d => d.fragmentCount)).toEqual([1, 1]);
    expect(job.result?.findings).toEqual([]);
    expect(job.stages.every(s => s.status === "done")).toBe(true);
    expect(polled.headers.get("Cache-Control")).toBe("no-store");
  });
  it("persists failed ingest without claiming later stages completed", async () => {
    const created = await POST(uploadRequest(true)); const { id } = await created.json();
    await tasks[0](); const job = await getJobStore().get(id);
    expect(job.status).toBe("failed"); expect(job.stages[0].status).toBe("failed");
    expect(job.stages[1].status).toBe("pending"); expect(job.result).toBeUndefined();
  });
  it("reviews an explicit demo finding and returns the updated contract object", async () => {
    const job = await getJobStore().seedDemo(AnalysisResultSchema.parse(example));
    const context = { params: Promise.resolve({ id: job.id, findingId: "finding-loss" }) };
    const response = await PATCH(reviewRequest({ status: "NEEDS_CHECK", comment: "Проверить источник" }), context);
    expect(response.status).toBe(200);
    expect((await response.json()).review).toMatchObject({ status: "NEEDS_CHECK", comment: "Проверить источник" });
    const bad = await PATCH(reviewRequest({ status: "INVALID" }), context); expect(bad.status).toBe(400);
    const missing = await PATCH(reviewRequest({ status: "CONFIRMED" }), { params: Promise.resolve({ id: job.id, findingId: "unknown" }) });
    expect(missing.status).toBe(404);
  });
  it("rejects empty multipart, unknown jobs and unsupported media", async () => {
    expect((await POST(new Request("http://localhost", { method: "POST", body: new FormData() }))).status).toBe(400);
    expect((await POST(new Request("http://localhost", { method: "POST", body: "bad" }))).status).toBe(415);
    expect((await GET(new Request("http://localhost"), { params: Promise.resolve({ id: "unknown" }) })).status).toBe(404);
  });
});
