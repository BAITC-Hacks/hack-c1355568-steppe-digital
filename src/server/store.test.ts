import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import example from "@/shared/analysis-result.example.json";
import { AnalysisResultSchema } from "@/shared/contract";
import { JobStore } from "./store";

let directory: string;
beforeEach(async () => { directory = await mkdtemp(path.join(os.tmpdir(), "orgtrace-store-")); });
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });
describe("persistent jobs and review", () => {
  it("persists simultaneous reviews and keeps verification unchanged after restart", async () => {
    const store = new JobStore(directory); const job = await store.seedDemo(AnalysisResultSchema.parse(example));
    await Promise.all([
      store.review(job.id, "finding-loss", { status: "CONFIRMED", comment: "Проверено" }),
      store.review(job.id, "finding-preserved", { status: "NEEDS_CHECK" }),
    ]);
    const restored = await new JobStore(directory).get(job.id);
    expect(restored.result?.findings[0]).toMatchObject({ verified: true, review: { status: "CONFIRMED", comment: "Проверено" } });
    expect(restored.result?.findings[1].review.status).toBe("NEEDS_CHECK");
    const reviewed = await store.review(job.id, "finding-loss", { status: "REJECTED" });
    expect(reviewed.review.comment).toBe("Проверено"); expect(reviewed.review.updatedAt).toBeTruthy();
  });
  it.each(["running", "failed"] as const)("recovers an interrupted %s stage without failing later stages", async status => {
    const store = new JobStore(directory); const job = await store.create();
    await store.update(job.id, job => { job.status = "running"; job.stages[0].status = status; });
    const restored = await new JobStore(directory).get(job.id);
    expect(restored.status).toBe("failed"); expect(restored.stages[0].status).toBe("failed");
    expect(restored.stages[1].status).toBe("pending");
  });
  it("rejects unknown IDs and reviews before completion", async () => {
    const store = new JobStore(directory); const job = await store.create();
    await expect(store.get("../../other")).rejects.toMatchObject({ status: 404 });
    await expect(store.review(job.id, "finding-loss", { status: "CONFIRMED" })).rejects.toMatchObject({ status: 409 });
  });
});
