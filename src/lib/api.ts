import { AnalysisJobSchema, AnalysisResultSchema, FindingSchema } from "../shared/contract";
import type { AnalysisJob, Finding } from "../shared/contract";
import mockResult from "../mocks/analysis-result.json";

// Backend integration requirements are recorded in docs/product/FRONTEND_HANDOFF.md.
export const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";
const DEMO_PREFIX = "orgtrace:demo:v1:";

function abort(signal?: AbortSignal) { signal?.throwIfAborted(); }

async function request(path: string, init: RequestInit): Promise<unknown> {
  try {
    const response = await fetch(path, { ...init, cache: "no-store" });
    if (!response.ok) {
      const messages: Record<number, string> = { 400: "Проверьте файлы и параметры запроса.", 404: "Анализ не найден. Создайте новый анализ.", 409: "Дождитесь завершения анализа.", 413: "Размер загружаемых файлов превышает лимит сервера.", 415: "Сервер не поддерживает этот формат документа." };
      throw new Error(messages[response.status] ?? "Сервис недоступен. Повторите попытку позже.");
    }
    return await response.json();
  } catch (error) {
    if (init.signal?.aborted) throw new DOMException("Отменено", "AbortError");
    if (error instanceof Error && /^(Проверьте|Анализ|Дождитесь|Размер|Сервер|Сервис)/.test(error.message)) throw error;
    throw new Error("Не удалось получить ответ сервера. Проверьте соединение и повторите попытку.");
  }
}

function demoJob(id: string): AnalysisJob {
  if (!id.startsWith("demo-")) throw new Error("Этот анализ недоступен в демонстрационном режиме.");
  let stored: string | null;
  try { stored = localStorage.getItem(DEMO_PREFIX + id); } catch { throw new Error("Для демонстрации разрешите локальное хранение в браузере."); }
  if (!stored) throw new Error("Демонстрационный анализ не найден в этом браузере.");
  try { return AnalysisJobSchema.parse(JSON.parse(stored)); } catch { throw new Error("Демонстрационные данные устарели. Создайте новый анализ."); }
}

function saveDemo(job: AnalysisJob) {
  try { localStorage.setItem(DEMO_PREFIX + job.id, JSON.stringify(job)); } catch { throw new Error("Не удалось сохранить демонстрационные данные в браузере."); }
}

export async function createAnalysis(before: File[], after: File[], signal?: AbortSignal): Promise<{ id: string }> {
  abort(signal);
  if (!before.length || !after.length) throw new Error("Добавьте документы ДО и ПОСЛЕ.");
  if ([...before, ...after].some(file => !/\.(pdf|docx|xlsx)$/i.test(file.name) || !file.size)) throw new Error("Выберите непустые PDF, DOCX или XLSX.");
  if (USE_MOCK) {
    const id = `demo-${crypto.randomUUID()}`;
    const result = AnalysisResultSchema.parse({ ...structuredClone(mockResult), id });
    const stages = (["ingest", "units", "functions", "lineage", "findings", "verify", "conclusion"] as const).map(key => ({ key, label: "Демонстрационный пример", status: "done", detail: "Загружен готовый синтетический пример. Этот этап анализа не выполнялся." }));
    const job = AnalysisJobSchema.parse({ id, status: "done", stages, result });
    // No pretend processing: the pre-authored synthetic example loads immediately.
    saveDemo(job);
    return { id };
  }
  const body = new FormData();
  before.forEach(file => body.append("before[]", file));
  after.forEach(file => body.append("after[]", file));
  const data = await request("/api/analyses", { method: "POST", body, signal });
  if (!data || typeof data !== "object" || !("id" in data) || typeof data.id !== "string" || !data.id) throw new Error("Сервер вернул некорректный идентификатор анализа.");
  return { id: data.id };
}

export async function getAnalysis(id: string, options: { signal: AbortSignal; onUpdate: (job: AnalysisJob) => void }): Promise<AnalysisJob> {
  const { signal, onUpdate } = options;
  while (true) {
    abort(signal);
    let job: AnalysisJob;
    if (USE_MOCK) job = demoJob(id);
    else {
      const response = await request(`/api/analyses/${encodeURIComponent(id)}`, { signal });
      const parsed = AnalysisJobSchema.safeParse(response);
      if (!parsed.success) throw new Error("Ответ сервера не соответствует контракту анализа.");
      job = parsed.data;
    }
    abort(signal);
    if (job.id !== id || (job.status === "done" && !job.result)) throw new Error("Получен неполный или неверный анализ.");
    onUpdate(job);
    if (job.status === "done" || job.status === "failed") return job;
    await new Promise<void>((resolve, reject) => {
      const cancel = () => { clearTimeout(timer); reject(new DOMException("Отменено", "AbortError")); };
      const timer = setTimeout(() => { signal.removeEventListener("abort", cancel); resolve(); }, 1500);
      signal.addEventListener("abort", cancel, { once: true });
      if (signal.aborted) cancel();
    });
  }
}

export async function reviewFinding(id: string, findingId: string, review: Pick<Finding["review"], "status" | "comment">, signal?: AbortSignal): Promise<Finding> {
  abort(signal);
  if (USE_MOCK) {
    const job = demoJob(id);
    const finding = job.result?.findings.find(item => item.id === findingId);
    if (!finding) throw new Error("Замечание не найдено.");
    const updated = FindingSchema.parse({ ...finding, review: { ...review, updatedAt: new Date().toISOString() } });
    job.result!.findings = job.result!.findings.map(item => item.id === findingId ? updated : item);
    saveDemo(job);
    return updated;
  }
  const response = await request(`/api/analyses/${encodeURIComponent(id)}/findings/${encodeURIComponent(findingId)}/review`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(review), signal });
  const parsed = FindingSchema.safeParse(response);
  if (!parsed.success || parsed.data.id !== findingId) throw new Error("Сервер вернул некорректное решение проверки.");
  return parsed.data;
}
