import { ConclusionKeySchema, type AnalysisResult, type Evidence, type Finding, type OrgFunction, type Unit } from "@/shared/contract";
import type { Fragment } from "./ingest";
import { hash } from "./files";
import { content, type ParsedClauses } from "./clauses";

const id = (...values: string[]) => hash(values.join("\0")).slice(0, 24);
const body = (text: string) => text.trim().replace(/^(?:\d+(?:\.\d+)*[.)]?|[а-я]\))\s*/iu, "").replace(/[.;:]$/u, "").trim();
const normalized = (text: string) => body(text).toLowerCase().replace(/ё/gu, "е").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/gu, " ").trim();
// Small language rules, independent of document names, clause numbers and evaluation cases.
// Preserve negation, qualifiers and objects: similarity alone never establishes equivalence.
function tokens(text: string): string[] {
  return normalized(text).replace(/^(?:осуществляет|проводит|ведет) (?=мониторинг|контроль|анализ|оценк)/u, "").split(" ").filter(w => !/^(и|в|во|на|по|с|со|к|для|о|об|за|из)$/u.test(w)).map(w => {
    if (/^договор/u.test(w)) return "договор";
    if (/^(исполн|выполн)/u.test(w)) return "выполн";
    return w.length > 5 ? w.replace(/(?:иями|ами|ого|его|ому|ему|ыми|ими|ение|ения|ений|ает|яет|уют|ют|ит|ет|ов|ам|ям|ах|ях|ом|ем|ые|ие|ый|ий|ой|ая|яя|ое|ее|ую|юю|ы|и|а|я|у|ю)$/u, "") : w;
  }).filter(Boolean).sort();
}
function key(text: string) { return [...new Set(tokens(text))].join(" "); }
export function similarity(a: string, b: string): number {
  const x = new Set(tokens(a)), y = new Set(tokens(b));
  const common = [...x].filter(w => y.has(w)).length;
  return common / (new Set([...x, ...y]).size || 1);
}
export function equivalent(a: string, b: string): boolean { return key(a) === key(b); }
function evidence(fragment: Fragment, quote = fragment.text): Evidence {
  return { fragmentId: fragment.id, documentName: fragment.documentName, side: fragment.side, locator: fragment.locator,
    quote, fragmentText: fragment.text, verified: fragment.text.includes(quote) };
}
function role(text: string): OrgFunction["role"] {
  if (/^(?:контрол|монитор|осуществляет монитор|проводит монитор|вед[её]т монитор)/iu.test(text)) return "control";
  if (/^утвержд/iu.test(text)) return "approve";
  if (/^(?:проводит аудит|аудит|проверяет)/iu.test(text)) return "audit";
  if (/^(?:выполняет|исполняет|осуществляет|организует|проводит)/iu.test(text)) return "execute";
  return "other";
}
function actionText(text: string): boolean {
  return /^(?:осуществля|провод|вед[её]т|контрол|монитор|выявля|оценива|организ|обеспеч|разрабат|формир|подгот|готов|соглас|утвержд|провер|исполн|выполн|представ|анализ|участву|рассматр|направля|информир|консульт|координир)/iu.test(text);
}
type Assignment = { fragment: Fragment; unit: Unit; text: string };
export function extract(result: AnalysisResult, fragments: Fragment[]): Assignment[] {
  const assignments: Assignment[] = [];
  for (const document of result.documents) {
    let owner: Unit | undefined;
    let section: string | undefined;
    let lastNumber: string | undefined;
    for (const fragment of fragments.filter(f => f.documentId === document.id)) {
      for (const line of fragment.text.split(/\n/u).filter(x => x.trim())) {
        // Strip list markers only for extraction; comparison rules remain unchanged.
        const text = body(line.trim().replace(/^(?:[а-яёa-z][.)]|\d+(?:\.\d+)*[.)]?)\s*/iu, ""));
        const number = line.match(/^\s*(\d+(?:\.\d+)*)[.)\s]/u)?.[1];
        if (number) lastNumber = number;
        // A role owns only its explicit heading's descendants, never the next section.
        if (number && section && !number.startsWith(`${section}.`) && number !== section) { owner = undefined; section = undefined; }
        const department = text.match(/^((?:Департамент|Управление|Отдел|Служба|Центр|Блок)\s+[^:;.!?]+?)$/iu);
        const position = /:\s*$/u.test(line) ? text.match(/^((?:Директор(?:ы)?|Начальник|Руководитель|Главный аудитор)(?:\s+[^:;.!?]+)?)$/iu) : null;
        const heading = department ?? position;
        const predicate = /(?:^|\s)(?:осуществля[а-яё]*|обеспечива[а-яё]*|подчиня[а-яё]*|явля[а-яё]*|находится|обязан[а-яё]*|име[а-яё]* право|не име[а-яё]*|руководит|состоит)(?:\s|$)/iu.test(text)
          || text.split(/\s+/u).some(word => actionText(word) && /(?:ет|ёт|ют|ит|ят|ут)$/iu.test(word));
        if (heading && !predicate) {
          const name = heading[1].trim();
          owner = result.units.find(u => u.side === fragment.side && u.normalizedName === normalized(name));
          if (!owner) {
            owner = { id: `unit-${id(fragment.side, name)}`, side: fragment.side, name, normalizedName: normalized(name), kind: position ? "position" : /^Центр/iu.test(name) ? "center" : /^Блок/iu.test(name) ? "block" : "department", evidence: [evidence(fragment, line)] };
            result.units.push(owner);
          } else owner.evidence.push(evidence(fragment, line));
          section = number ?? lastNumber;
          if (/^Директоры /iu.test(name)) result.warnings.push(`Групповой владелец «${name}» сохранён дословно без распределения обязанностей между участниками; требуется проверка области действия.`);
          continue;
        }
        // Unrecognized unnumbered headings (including rights/prohibitions) stop inheritance.
        if (!number && /:\s*$/u.test(line) && !actionText(text)) { owner = undefined; section = undefined; }
        if (owner && actionText(text) && !/^(?:не |имеет право|имеют право)/iu.test(text)) assignments.push({ fragment, unit: owner, text });
      }
    }
  }
  if (!result.units.length) result.warnings.push("Не распознаны явные заголовки подразделений. Текущий извлекатель поддерживает разделы с названием подразделения и следующими за ним функциями; полнота анализа не подтверждена.");
  return assignments;
}
export function extractFunctions(result: AnalysisResult, assignments: Assignment[], parsed: ParsedClauses) {
  for (const { fragment, unit, text } of assignments) {
    const existing = result.functions.find(f => f.unitId === unit.id && normalized(f.text) === normalized(text));
    if (existing) { existing.evidence.push(evidence(fragment)); continue; }
    const clause = parsed.clauses.find(c => parsed.sources.get(c.id)?.fragment.id === fragment.id && normalized(content(c)) === normalized(text));
    if (!clause) throw new Error("FunctionClauseNotFound");
    const words = text.split(/\s/u);
    result.functions.push({ id: `function-${id(unit.id, text)}`, unitId: unit.id, side: fragment.side, text, clauseId: clause.id, category: "function",
      action: words[0], object: words.slice(1).join(" ") || text, process: key(words.slice(1).join(" ")) || key(text), role: role(text), evidence: [evidence(fragment), ...unit.evidence] });
  }
}
export function match(result: AnalysisResult) {
  const beforeUnits = result.units.filter(u => u.side === "before"), afterUnits = result.units.filter(u => u.side === "after");
  const usedUnits = new Set<string>();
  const unitScore = (b: Unit, a: Unit) => {
    const bf = result.functions.filter(f => f.unitId === b.id), af = result.functions.filter(f => f.unitId === a.id);
    const shared = bf.filter(f => af.some(g => equivalent(f.text, g.text))).length;
    return { name: similarity(b.name, a.name), shared, coverage: shared / Math.max(1, Math.min(bf.length, af.length)) };
  };
  // Reserve exact names before evaluating rename candidates.
  const exact = new Map(beforeUnits.map(b => [b.id, afterUnits.find(a => a.normalizedName === b.normalizedName)]));
  for (const a of exact.values()) if (a) usedUnits.add(a.id);
  for (const b of beforeUnits) {
    let a = exact.get(b.id);
    if (!a) {
      const ranked = afterUnits.filter(a => !usedUnits.has(a.id)).map(a => ({ a, ...unitScore(b, a) }))
        .filter(x => x.name >= 0.5 && x.shared >= 1 && x.coverage >= 0.5).sort((x, y) => y.name - x.name || y.shared - x.shared);
      // Do not resolve tied/ambiguous names by arbitrary ordering.
      if (ranked[0] && (!ranked[1] || ranked[0].name > ranked[1].name)) a = ranked[0].a;
    }
    if (a) usedUnits.add(a.id);
    const status = !a ? "REMOVED" : a.normalizedName === b.normalizedName ? "PRESERVED" : "RENAMED";
    result.unitChanges.push({ id: `change-${b.id}`, beforeUnitIds: [b.id], afterUnitIds: a ? [a.id] : [], status,
      rationale: !a ? "Соответствие в распознанной структуре ПОСЛЕ не найдено; требуется проверка переименования." : status === "PRESERVED" ? "Название подразделения сохранено." : `Возможное преобразование: похожесть названий ${similarity(b.name, a.name).toFixed(2)} и сохранённые функции. Требуется проверка человеком.`,
      evidence: [...b.evidence, ...(a?.evidence ?? []), ...(a && status === "RENAMED" ? result.functions.filter(f => (f.unitId === b.id || f.unitId === a.id) && result.functions.some(g => g.side !== f.side && (g.unitId === b.id || g.unitId === a.id) && equivalent(f.text, g.text))).flatMap(f => f.evidence) : [])] });
  }
  for (const a of afterUnits.filter(u => !usedUnits.has(u.id))) result.unitChanges.push({ id: `change-${a.id}`, beforeUnitIds: [], afterUnitIds: [a.id], status: "CREATED", rationale: "В распознанной структуре ДО соответствие не найдено.", evidence: a.evidence });

  // Group equivalent responsibilities across ALL owners on BOTH sides. No greedy consumption:
  // one AFTER responsibility may preserve multiple BEFORE assignments without false loss.
  const groups = new Map<string, OrgFunction[]>();
  for (const f of result.functions) { const k = key(f.text); groups.set(k, [...(groups.get(k) ?? []), f]); }
  const after = result.functions.filter(f => f.side === "after");
  for (const [k, group] of groups) {
    const b = group.filter(f => f.side === "before"), a = group.filter(f => f.side === "after");
    const sameOwner = b.every(f => a.some(g => result.unitChanges.some(c => c.beforeUnitIds.includes(f.unitId) && c.afterUnitIds.includes(g.unitId))));
    const status = !b.length ? "NEW" : !a.length ? "POSSIBLE_LOSS" : sameOwner ? "UNCHANGED" : "TRANSFERRED";
    result.lineage.push({ id: `lineage-${id(k)}`, beforeFunctionIds: b.map(f => f.id), afterFunctionIds: a.map(f => f.id), status,
      rationale: !b.length ? "Предшественник не найден в извлечённых функциях ДО." : !a.length ? "Эквивалент по языковым правилам не найден среди ВСЕХ извлечённых функций ПОСЛЕ. Это возможная потеря в пределах корпуса, не доказательство исчезновения обязанности." : sameOwner ? "Сохранены действие и объект функции у сопоставленного владельца." : "Эквивалентная функция найдена у другого владельца ПОСЛЕ; потеря не объявляется.",
      candidatesChecked: b.length ? after.map(f => ({ functionId: f.id, score: similarity(b[0].text, f.text), reason: equivalent(b[0].text, f.text) ? "Совпадают нормализованные действие, объект и ограничения." : "Эквивалентность не установлена; проверьте смысл и частичное покрытие." })).sort((a, b) => b.score - a.score).slice(0, 5).map(c => ({ functionId: c.functionId, reason: `similarity=${c.score.toFixed(3)}. ${c.reason}` })) : [] });
  }
}
export function findings(result: AnalysisResult, fragments: Fragment[]) {
  const add = (type: Finding["type"], title: string, explanation: string, functions: OrgFunction[], units: Unit[], ev: Evidence[], verified = true, searchTrace?: Finding["searchTrace"]) => {
    result.findings.push({ id: `finding-${id(type, ...functions.map(f => f.id), ...units.map(u => u.id))}`, type, title, explanation,
      reviewPriority: type === "REORGANIZATION" ? "LOW" : type === "DUPLICATION" ? "MEDIUM" : "HIGH", confidence: "medium",
      functionIds: [...new Set(functions.map(f => f.id))], unitIds: [...new Set([...functions.map(f => f.unitId), ...units.map(u => u.id)])],
      evidence: [...new Map(ev.map(e => [`${e.fragmentId}:${e.quote}`, e])).values()], verified, ...(searchTrace ? { searchTrace } : {}),
      recommendation: "Проверьте указанные пункты и полноту закрепления ответственности с владельцами подразделений.", review: { status: "NEEDS_CHECK" } });
  };
  for (const c of result.unitChanges.filter(c => c.status !== "PRESERVED")) add("REORGANIZATION", "Изменение структуры", c.rationale, [], result.units.filter(u => [...c.beforeUnitIds, ...c.afterUnitIds].includes(u.id)), c.evidence);
  const after = result.functions.filter(f => f.side === "after");
  const incomplete = result.documents.some(d => !d.fragmentCount || d.warnings.some(w => /отсутствует|не удалось|неподдерживаем/u.test(w)));
  for (const l of result.lineage.filter(l => l.status === "POSSIBLE_LOSS")) {
    const b = result.functions.filter(f => l.beforeFunctionIds.includes(f.id));
    // Search unassigned AFTER source text too: unknown ownership must not turn coverage into loss.
    const rawCoverage = fragments.some(f => f.side === "after" && f.text.split(/\n/u).some(line => equivalent(b[0].text, body(line))));
    const partial = after.some(f => similarity(b[0].text, f.text) >= 0.45);
    const verified = !incomplete && !rawCoverage && !partial && after.length > 0;
    add("LOSS", `Возможная потеря: ${b[0].text}`, `${l.rationale} Проверено функций ПОСЛЕ: ${after.length}; дополнительно просмотрены все исходные фрагменты ПОСЛЕ.${!verified ? " Диагностический кандидат: неполный охват или возможное частичное покрытие; исключён из подтверждённых счётчиков." : ""}`, b, [], b.flatMap(f => f.evidence), verified, { checkedCount: after.length, topCandidates: l.candidatesChecked });
  }
  const groups = new Map<string, OrgFunction[]>();
  for (const f of after) groups.set(key(f.text), [...(groups.get(key(f.text)) ?? []), f]);
  for (const fs of groups.values()) if (new Set(fs.map(f => f.unitId)).size >= 2) {
    add("DUPLICATION", `Возможное дублирование: ${fs[0].text}`, "Одинаковые действие, объект и ограничения закреплены за несколькими подразделениями ПОСЛЕ. similarity=1 по нормализованным токенам. Разделение областей ответственности требует проверки.", fs, [], fs.flatMap(f => f.evidence));
  }
  for (let i = 0; i < after.length; i++) for (const b of after.slice(i + 1)) {
    const a = after[i];
    if (a.unitId === b.unitId && a.process === b.process && ((a.role === "execute" && ["control", "approve", "audit"].includes(b.role)) || (b.role === "execute" && ["control", "approve", "audit"].includes(a.role)))) {
      add("CONFLICT", "Потенциальный конфликт исполнения и контроля", "В одном подразделении совпадает объект процесса у исполнения и контроля/утверждения/аудита. Проверьте разделение полномочий.", [a, b], [], [...a.evidence, ...b.evidence]);
    }
  }
}
export function finalize(result: AnalysisResult, fragments: Fragment[]) {
  const registry = new Map(fragments.map(f => [f.id, f]));
  for (const e of [...result.units, ...result.unitChanges, ...result.functions, ...result.findings].flatMap(x => x.evidence)) {
    const source = registry.get(e.fragmentId);
    if (!source || source.documentName !== e.documentName || source.side !== e.side || source.text !== e.fragmentText || !source.text.includes(e.quote) || JSON.stringify(source.locator) !== JSON.stringify(e.locator)) throw new Error("EvidenceVerificationFailed");
  }
  for (const c of result.unitChanges) result.summary.unitsByStatus[c.status]++;
  for (const l of result.lineage) result.summary.functionsByStatus[l.status]++;
  for (const f of result.findings) if (f.verified) result.summary.findingsByType[f.type]++;
}
export function conclude(result: AnalysisResult) {
  const titles = ["Изменения структуры", "Сохранение функций", "Возможные потери", "Дублирование", "Конфликты", "Требуется проверка человеком"];
  result.conclusion.sections = ConclusionKeySchema.options.map((key, index) => {
    const types: Partial<Record<typeof key, Finding["type"]>> = { orgChanges: "REORGANIZATION", possibleLosses: "LOSS", duplication: "DUPLICATION", conflicts: "CONFLICT" };
    const type = types[key];
    const fs = result.findings.filter(f => f.verified && (!type || f.type === type));
    const text = key === "functionPreservation" ? `Извлечено функций: ${result.functions.length}. Сохранённых связей: ${result.summary.functionsByStatus.UNCHANGED}; переносов между владельцами: ${result.summary.functionsByStatus.TRANSFERRED}.`
      : key === "needsHumanReview" ? "Все выводы рекомендательные. Проверка источника подтверждает цитату, а не окончательное решение о потере, дублировании или конфликте. Неподтверждённые кандидаты исключены из счётчиков. Проверьте полноту извлечения и документы вне загруженного корпуса."
      : fs.length ? fs.map(f => `${f.title}. ${f.explanation}`).join("\n") : "В пределах применённых правил подтверждённых источниками кандидатов не обнаружено. Это не подтверждает отсутствие риска.";
    return { key, title: titles[index], text, findingIds: key === "functionPreservation" ? [] : fs.map(f => f.id) };
  });
}
