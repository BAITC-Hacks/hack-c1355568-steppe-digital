import type { Clause, ClauseAlignment, Evidence } from "@/shared/contract";
import type { Fragment } from "./ingest";
import { hash } from "./files";
import { AppError } from "./errors";

export type ClauseSource = { fragment: Fragment; context: string };
export type ParsedClauses = { clauses: Clause[]; sources: Map<string, ClauseSource>; warnings: string[] };
export const locatorNumber = (c: Clause) => [c.number, c.letter].filter(Boolean).join(" ");
export const content = (c: Clause) => c.text.replace(/^\s*(?:\d+(?:\.\d+)*[.)]?|[а-яё][.)])\s*/iu, "").trim();
export const normalize = (text: string) => text.toLocaleLowerCase("ru").replace(/ё/gu, "е").replace(/[«»“”]/gu, '"').replace(/\s+/gu, " ").trim();
const cosmetic = (text: string) => normalize(text).replace(/[.,;:!?'"()—–-]/gu, "").replace(/\s+/gu, " ").trim();
const tokens = (value: string) => new Set(normalize(value).match(/[\p{L}\p{N}]+/gu) ?? []);
function dice(x: Set<string>, y: Set<string>): number {
  if (!x.size || !y.size) return 0;
  return 2 * [...x].filter(t => y.has(t)).length / (x.size + y.size);
}
export function similarity(a: string, b: string): number { return dice(tokens(a), tokens(b)); }
/** Share of the shorter wording contained in the longer one: a narrowed or widened duty, not a different one. */
export function coverage(a: string, b: string): number {
  const x = tokens(a), y = tokens(b);
  const [small, large] = x.size <= y.size ? [x, y] : [y, x];
  if (!small.size) return 0;
  return [...small].filter(t => large.has(t)).length / small.size;
}
export const contentTokens = (value: string) => tokens(value).size;
/** Scope markers of this domain (БВА, ДНМ, СВК, ДЗО…). Replacing one changes who or what a duty covers. */
export const acronyms = (text: string) => new Set(text.match(/(?<![\p{Ll}])[\p{Lu}]{2,8}(?![\p{Ll}])/gu) ?? []);
export function acronymShare(source: string, candidate: string): number {
  const wanted = acronyms(source);
  if (!wanted.size) return 1;
  const present = acronyms(candidate);
  return [...wanted].filter(a => present.has(a)).length / wanted.size;
}

/** Keep original text spans: a clause is never reconstructed from a model response. */
export function parseClauses(fragments: Fragment[]): ParsedClauses {
  const clauses: Clause[] = [], sources = new Map<string, ClauseSource>(), warnings: string[] = [];
  for (const documentId of new Set(fragments.map(f => f.documentId))) {
    let sectionNumber = "", sectionTitle = "", parentNumber = "", context = "", toc = false;
    const push = (fragment: Fragment, text: string, kind: Clause["kind"], number = "", letter?: string) => {
      const c: Clause = { id: `${documentId}-c${clauses.filter(c => c.documentId === documentId).length + 1}`, documentId, side: fragment.side,
        text, kind, number, ...(letter ? { letter } : {}), ...(kind === "item" ? { parentNumber } : number.includes(".") ? { parentNumber: number.split(".").slice(0, -1).join(".") } : {}), sectionNumber, sectionTitle };
      clauses.push(c); sources.set(c.id, { fragment, context });
      if (kind === "empty") warnings.push(`${fragment.documentName}: пустой пункт ${number}; исключён из функций.`);
    };
    for (const fragment of fragments.filter(f => f.documentId === documentId)) {
      const lines = fragment.text.split(/\r?\n/u).flatMap(line => line.split(/\s+(?=\d+(?:\.\d+)*\.[ \t]*[А-ЯЁ])/u));
      for (const raw of lines) {
        const text = raw.trim(); if (!text) continue;
        if (/^Оглавление\s*$/iu.test(text)) toc = true;
        if (toc) { push(fragment, text, "toc"); continue; }
        const numbered = text.match(/^(\d+(?:\.\d+)*)[.)]\s*(.*)$/u);
        if (numbered) {
          const [, number, body] = numbered;
          if (!number.includes(".")) {
            sectionNumber = number;
            const glued = body.match(/^(Внутренний аудит в ДЗО|Взаимоотношения\. Связи|Термины и определения)\s+(.*)$/u);
            sectionTitle = glued ? glued[1] : body; context = sectionTitle;
            push(fragment, glued ? text.slice(0, text.indexOf(glued[2])).trim() : text, "heading", number);
            if (glued) push(fragment, glued[2], "clause", number);
            parentNumber = number;
          } else {
            parentNumber = number;
            if (number.split(".").length === 2) context = /^(Директор|Работники|Главный аудитор|Для выполнения)/u.test(body) ? body : `${context} ${body}`;
            push(fragment, text, /[\p{L}\p{N}]/u.test(body) ? "clause" : "empty", number);
          }
        } else {
          const item = text.match(/^([а-яё])[.)]\s*(.*)$/iu);
          if (item && parentNumber) push(fragment, text, "item", parentNumber, item[1]);
          else if (/^(Главный аудитор|Директор|Работники БВА)/u.test(text)) { context = text; push(fragment, text, "heading"); }
          else push(fragment, text, sectionNumber ? "clause" : "heading");
        }
      }
    }
  }
  return { clauses, sources, warnings };
}
export function evidenceFor(c: Clause, parsed: ParsedClauses): Evidence {
  const { fragment } = parsed.sources.get(c.id)!;
  return { fragmentId: `${fragment.id}:${c.id}`, documentName: fragment.documentName, side: c.side,
    locator: { ...fragment.locator, ...(c.number ? { section: locatorNumber(c) } : {}), label: `${fragment.locator.label}${c.number ? ` · пункт ${locatorNumber(c)}` : ""}` },
    quote: c.text, fragmentText: fragment.text, verified: fragment.text.includes(c.text) };
}

export function alignClauses(clauses: Clause[]): ClauseAlignment[] {
  const eligible = clauses.filter(c => ["clause", "item"].includes(c.kind));
  if (eligible.length > 4000) throw new AppError(413, "Для сопоставления допускается не более 4000 содержательных пунктов. Разделите набор документов.");
  const before = eligible.filter(c => c.side === "before"), after = eligible.filter(c => c.side === "after");
  const usedBefore = new Set<string>(), usedAfter = new Set<string>(), result: ClauseAlignment[] = [];
  function pair(b: Clause, a: Clause, score: number) {
    usedBefore.add(b.id); usedAfter.add(a.id);
    const exact = normalize(content(b)) === normalize(content(a));
    result.push({ id: `alignment-${hash(`${b.id}:${a.id}`).slice(0, 20)}`, beforeClauseId: b.id, afterClauseId: a.id,
      status: exact ? "IDENTICAL" : cosmetic(content(b)) === cosmetic(content(a)) ? "COSMETIC" : "SUBSTANTIVE", similarity: score, method: exact ? "exact" : "fuzzy" });
  }
  const context = (c: Clause) => {
    const parent = clauses.find(p => p.documentId === c.documentId && p.number === c.number.split(".").slice(0, 2).join(".") && p.kind === "clause");
    return parent ? content(parent) : c.sectionTitle;
  };
  const contexts = new Map(eligible.map(c => [c.id, tokens(context(c))]));
  const texts = new Map(eligible.map(c => [c.id, normalize(content(c))]));
  const words = new Map(eligible.map(c => [c.id, tokens(content(c))]));
  // Rank globally so a repeated duty retains its owner before considering a transfer.
  const candidates = before.flatMap(b => after.filter(a => a.kind === b.kind).map(a => {
    const exact = texts.get(b.id) === texts.get(a.id);
    const score = exact ? 1 : dice(words.get(b.id)!, words.get(a.id)!);
    const contextScore = dice(contexts.get(b.id)!, contexts.get(a.id)!);
    return { b, a, score, exact, rank: score + 0.25 * contextScore };
  }).filter(p => p.score >= 0.58)).sort((a, b) => Number(b.exact) - Number(a.exact) || b.rank - a.rank || a.b.id.localeCompare(b.b.id) || a.a.id.localeCompare(b.a.id));
  for (const { b, a, score } of candidates) if (!usedBefore.has(b.id) && !usedAfter.has(a.id)) pair(b, a, score);
  for (const c of eligible) if (!(c.side === "before" ? usedBefore : usedAfter).has(c.id)) result.push({ id: `alignment-${hash(c.id).slice(0, 20)}`,
    ...(c.side === "before" ? { beforeClauseId: c.id } : { afterClauseId: c.id }), status: c.side === "before" ? "ONLY_BEFORE" : "ONLY_AFTER", similarity: 0, method: "fuzzy" });
  const order = new Map(eligible.map((c, i) => [c.id, i]));
  return result.sort((a, b) => order.get((a.beforeClauseId ?? a.afterClauseId)!)! - order.get((b.beforeClauseId ?? b.afterClauseId)!)!);
}
