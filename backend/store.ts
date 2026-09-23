import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { AnalysisJobSchema, AnalysisResultSchema, ReviewInputSchema, type AnalysisJob, type AnalysisResult, type ReviewInput, type Stage } from "@/shared/contract";
import { AppError } from "./errors";
import { atomicJson, dataDirectory } from "./files";
import { createStages } from "./stages";

const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
export class JobStore {
  private jobs = new Map<string, AnalysisJob>();
  private tail: Promise<unknown> = Promise.resolve();
  private ready: Promise<void>;
  constructor(private readonly directory: string) { this.ready = this.load(); }
  private filename(id: string) { return path.join(this.directory, `${id}.json`); }
  private async load() {
    await mkdir(this.directory, { recursive: true });
    for (const file of await readdir(this.directory)) {
      const id = file.replace(/\.json$/u, "");
      if (!file.endsWith(".json") || !validId.test(id)) continue;
      const raw = JSON.parse(await readFile(this.filename(id), "utf8"));
      if (raw.id === id && Array.isArray(raw.stages) && raw.stages.length === 7 && !raw.stages.some((s: { key?: string }) => s.key === "clauses")) {
        // Retain the old file unchanged; expose an actionable terminal response for this ID.
        this.jobs.set(id, { id, status: "failed", error: "Анализ создан по контракту v0.1.0. Загрузите документы повторно для v0.2.0.", stages: createStages() });
        continue;
      }
      const parsed = AnalysisJobSchema.safeParse(raw);
      if (!parsed.success || parsed.data.id !== id) throw new AppError(500, "Хранилище заданий повреждено. Проверьте локальные данные.");
      const job = parsed.data;
      if (job.status === "queued" || job.status === "running") {
        job.status = "failed"; job.error = "Анализ прерван перезапуском сервера. Загрузите документы повторно.";
        const stage = job.stages.find(s => s.status === "failed") ?? job.stages.find(s => s.status === "running") ?? job.stages.find(s => s.status === "pending");
        if (stage) { stage.status = "failed"; stage.detail = job.error; }
        await atomicJson(this.filename(id), AnalysisJobSchema.parse(job));
      }
      this.jobs.set(id, job);
    }
  }
  private lock<T>(action: () => Promise<T>): Promise<T> {
    const next = this.tail.then(async () => { await this.ready; return action(); });
    this.tail = next.catch(() => undefined);
    return next;
  }
  private async save(job: AnalysisJob) {
    const validated = AnalysisJobSchema.parse(job);
    await atomicJson(this.filename(job.id), validated);
    this.jobs.set(job.id, validated);
    return structuredClone(validated);
  }
  async create(): Promise<AnalysisJob> {
    return this.lock(() => this.save({ id: randomUUID(), status: "queued", stages: createStages() }));
  }
  async get(id: string): Promise<AnalysisJob> {
    await this.ready; await this.tail;
    if (!validId.test(id)) throw new AppError(404, "Анализ не найден.");
    const job = this.jobs.get(id);
    if (!job) throw new AppError(404, "Анализ не найден.");
    return structuredClone(job);
  }
  async update(id: string, change: (job: AnalysisJob) => void): Promise<AnalysisJob> {
    return this.lock(async () => {
      const existing = this.jobs.get(id);
      if (!existing) throw new AppError(404, "Анализ не найден.");
      const job = structuredClone(existing); change(job); return this.save(job);
    });
  }
  async setStage(id: string, stage: Stage) {
    await this.update(id, job => { job.stages = job.stages.map(s => s.key === stage.key ? stage : s); });
  }
  async complete(id: string, result: AnalysisResult) {
    return this.update(id, job => { job.result = AnalysisResultSchema.parse(result); job.status = "done"; });
  }
  async fail(id: string, message: string) {
    return this.update(id, job => {
      job.status = "failed"; job.error = message; delete job.result;
      const stage = job.stages.find(s => s.status === "failed") ?? job.stages.find(s => s.status === "running") ?? job.stages.find(s => s.status === "pending");
      if (stage) { stage.status = "failed"; stage.detail = message; }
    });
  }
  async review(id: string, findingId: string, input: ReviewInput) {
    const parsed = ReviewInputSchema.safeParse(input);
    if (!parsed.success) throw new AppError(400, "Некорректное решение проверки.");
    const job = await this.update(id, job => {
      if (job.status !== "done" || !job.result) throw new AppError(409, "Дождитесь завершения анализа.");
      const finding = job.result.findings.find(f => f.id === findingId);
      if (!finding) throw new AppError(404, "Замечание не найдено.");
      finding.review = { ...parsed.data, ...(parsed.data.comment === undefined && finding.review.comment !== undefined ? { comment: finding.review.comment } : {}), updatedAt: new Date().toISOString() };
    });
    return job.result!.findings.find(f => f.id === findingId)!;
  }
  async seedDemo(result: AnalysisResult): Promise<AnalysisJob> {
    if (!result.isMock) throw new AppError(400, "Демонстрационные данные должны быть помечены как mock.");
    return this.lock(() => {
      const id = randomUUID();
      return this.save({ id, status: "done", stages: createStages().map(s => ({ ...s, status: "done", detail: "DEMO / MOCK DATA — готовый синтетический пример, этап не исполнялся." })), result: { ...result, id } });
    });
  }
}
const globalStore = globalThis as typeof globalThis & { orgtraceJobStore?: { directory: string; store: JobStore } };
export function getJobStore(): JobStore {
  const directory = path.join(dataDirectory(), "jobs");
  if (!globalStore.orgtraceJobStore || globalStore.orgtraceJobStore.directory !== directory) {
    globalStore.orgtraceJobStore = { directory, store: new JobStore(directory) };
  }
  return globalStore.orgtraceJobStore.store;
}
