import { FindingTypeSchema, UnitStatusSchema, LineageStatusSchema, AlignmentStatusSchema, ConclusionKeySchema, type AnalysisMethod, type AnalysisResult, type Clause, type Evidence, type OrgFunction, type Unit, type Finding } from "@/shared/contract";
import { methodOfAlignment } from "@/shared/method";
import { content, normalize, similarity, coverage, contentTokens, acronymShare, evidenceFor, locatorNumber, type ParsedClauses } from "./clauses";
import { hash } from "./files";

const clean = (text: string) => text.replace(/[.;:]$/u, "").trim();
const uid = (...parts: string[]) => hash(parts.join("\0")).slice(0, 24);
const ambiguous = (text: string) => /Директоры департаментов и Директоры направлений/u.test(text);
export function extractUnits(result: AnalysisResult, parsed: ParsedClauses) {
  for (const side of ["before", "after"] as const) {
    const clauses = parsed.clauses.filter(c => c.side === side && !["toc", "empty"].includes(c.kind));
    const add = (name: string, kind: Unit["kind"], c: Clause, parent?: Unit, abbreviation?: string) => {
      const key = normalize(name);
      const existing = result.units.find(u => u.side === side && u.normalizedName === key && u.parentUnitId === parent?.id);
      if (existing) { if (!existing.evidence.some(e => e.quote === c.text)) existing.evidence.push(evidenceFor(c, parsed)); return existing; }
      const unit: Unit = { id: `unit-${uid(side, key, parent?.id ?? "")}`, side, name: clean(name), normalizedName: key, kind,
        ...(parent ? { parentUnitId: parent.id, parentName: parent.name } : {}), ...(abbreviation ? { abbreviation } : {}), evidence: [evidenceFor(c, parsed)] };
      result.units.push(unit); return unit;
    };
    const blockClause = clauses.find(c => /\bБВА\b/u.test(c.text) || c.text.includes("БВА"));
    if (!blockClause) { result.warnings.push(`${side}: правила извлечения структуры БВА не применимы; структура не определена. Сопоставление текста доступно.`); continue; }
    const block = add("БВА", "block", blockClause, undefined, "БВА");
    const chiefClause = clauses.find(c => c.text.includes("Главный аудитор"));
    const chief = chiefClause ? add("Главный аудитор", "position", chiefClause, block) : undefined;
    const departments: Unit[] = [];
    for (const c of clauses.filter(c => c.sectionNumber === "3" && c.kind === "item")) {
      const match = content(c).match(/^(Департамент\s+.+?)\s*\(([А-ЯЁA-Z]+)\)/u);
      if (match) departments.push(add(match[1], "department", c, block, match[2]));
    }
    const departmentFor = (text: string) => departments.find(d => (d.abbreviation && new RegExp(`(?<![А-ЯЁ])${d.abbreviation}(?![А-ЯЁ])`, "u").test(text)) || normalize(text).includes(d.normalizedName.replace(/^департамент\s+/u, "")));
    let manager: Unit | undefined;
    for (const c of clauses.filter(c => c.sectionNumber === "3")) {
      if (c.kind === "clause") {
        if (/Главному аудитору подчиняются/u.test(c.text)) manager = chief;
        else if (/Директору .*подчиняются/u.test(c.text)) {
          const title = c.text.match(/Директору (.+?) (?:функционально )?подчиняются/u)?.[1];
          const dep = departmentFor(c.text);
          manager = dep ? result.units.find(u => u.side === side && u.kind === "position" && u.parentUnitId === dep.id && /^Директор /u.test(u.name)) : undefined;
          if (!manager && title) manager = add(`Директор ${title}`, "position", c, dep ?? block);
        } else manager = undefined;
      }
      if (c.kind !== "item" || !manager) continue;
      const name = clean(content(c));
      if (!/^(Директор|Руководитель|Менеджер|Аудитор)/u.test(name)) continue;
      const namedDepartment = departmentFor(name);
      const parent = namedDepartment ?? (manager === chief ? block : result.units.find(u => u.id === manager?.parentUnitId) ?? block);
      const unit = add(name, "position", c, parent);
      // Preserve every reporting clause without forcing two reporting types into one parent field.
      const heading = clauses.find(p => p.number === c.parentNumber && p.kind === "clause");
      if (heading && !unit.evidence.some(e => e.quote === heading.text)) unit.evidence.push(evidenceFor(heading, parsed));
      if (/Центра анализа данных/u.test(name)) add("Центр анализа данных", "center", c, parent);
    }
  }
  matchUnits(result);
}

const parentOf = (result: AnalysisResult, u: Unit) => result.units.find(p => p.id === u.parentUnitId);
/** A position title may carry its own department as a qualifier; compare titles without it. */
function shortTitle(result: AnalysisResult, u: Unit): string[] {
  const parent = parentOf(result, u);
  const words = normalize(u.name).match(/[\p{L}\p{N}]+/gu) ?? [];
  const drop = new Set([normalize(parent?.abbreviation ?? "\0"), normalize(parent?.name ?? "\0")]);
  return words.filter(w => !drop.has(w));
}
const prefixOf = (short: string[], long: string[]) => short.length > 0 && short.length <= long.length && short.every((w, i) => long[i] === w);

export function matchUnits(result: AnalysisResult) {
  const before = result.units.filter(u => u.side === "before"), after = result.units.filter(u => u.side === "after");
  const used = new Set<string>(), renamed = new Map<string, Unit>();
  const sameParent = (b: Unit, a: Unit) => parentOf(result, a)?.normalizedName === parentOf(result, b)?.normalizedName;
  const exact = new Map<string, Unit>();
  for (const b of before) {
    const a = after.find(a => !used.has(a.id) && a.kind === b.kind && a.normalizedName === b.normalizedName && sameParent(b, a));
    if (a) { used.add(a.id); exact.set(b.id, a); }
  }
  // Within one preserved parent an edition may shorten a title («Директор проектов ДНМ» → «Директор проектов»).
  // Only an unambiguous head-preserving pair counts; a different head or a tie stays remove plus create.
  for (const b of before.filter(b => !exact.has(b.id) && b.kind === "position")) {
    const short = shortTitle(result, b);
    const candidates = after.filter(a => !used.has(a.id) && a.kind === "position" && sameParent(b, a) && !!parentOf(result, b))
      .filter(a => { const other = shortTitle(result, a); return prefixOf(short, other) || prefixOf(other, short); });
    if (candidates.length !== 1) continue;
    used.add(candidates[0].id); renamed.set(b.id, candidates[0]);
  }
  for (const b of before) {
    const a = exact.get(b.id) ?? renamed.get(b.id);
    const status = !a ? "REMOVED" : renamed.has(b.id) ? "RENAMED" : "PRESERVED";
    const staff = status === "PRESERVED" && ["department", "block"].includes(b.kind)
      && (before.filter(x => parentOf(result, x)?.id === b.id).length !== after.filter(x => parentOf(result, x)?.id === a!.id).length);
    result.unitChanges.push({ id: `change-${b.id}`, beforeUnitIds: [b.id], afterUnitIds: a ? [a.id] : [], status,
      rationale: !a ? "Точное соответствие должности/подразделения в структуре ПОСЛЕ не найдено. Возможное переименование требует проверки."
        : status === "RENAMED" ? `Должность сопоставлена внутри того же подразделения: название сокращено до «${a.name}» без смены руководителя. Требуется проверка человеком.`
        : staff ? "Подразделение сохранено; изменился перечень должностей в штатном расписании. Это не доказывает изменение численности; состав обязанностей проверяется отдельно."
        : "Название и структурная принадлежность сохранены; состав обязанностей проверяется отдельно.",
      evidence: [...b.evidence, ...(a?.evidence ?? [])] });
  }
  for (const a of after.filter(u => !used.has(u.id))) result.unitChanges.push({ id: `change-${a.id}`, beforeUnitIds: [], afterUnitIds: [a.id], status: "CREATED", rationale: "В структуре ДО не найдено точное соответствие. Проверьте возможное переименование.", evidence: a.evidence });
}

export function extractFunctions(result: AnalysisResult, parsed: ParsedClauses) {
  for (const c of parsed.clauses.filter(c => ["clause", "item"].includes(c.kind))) {
    const context = parsed.sources.get(c.id)!.context;
    if (!/^2\.4\./u.test(c.number) && !["4", "5"].includes(c.sectionNumber) && !/может поручить/u.test(c.text)) continue;
    if (/не имеют права/u.test(context)) continue;
    const body = content(c);
    if (body.length < 12 || /^(Главный аудитор|Директор[ыа]? |Работники БВА)/u.test(body) && c.sectionNumber === "5" && c.number.split(".").length === 2) continue;
    if (/^Для выполнения/u.test(context)) continue;
    const units = result.units.filter(u => u.side === c.side);
    const block = units.find(u => u.kind === "block");
    const chief = units.find(u => u.name === "Главный аудитор");
    let owners: Unit[] = [];
    if (/^2\.4\./u.test(c.number) || /Работники БВА/u.test(context)) owners = block ? [block] : [];
    else if (c.sectionNumber === "4" || /Главный аудитор/u.test(context)) owners = chief ? [chief] : [];
    else {
      const deps = units.filter(u => u.kind === "department" && ((u.abbreviation && context.includes(u.abbreviation)) || normalize(context).includes(u.normalizedName.replace(/^департамент\s+/u, ""))));
      owners = deps.flatMap(dep => units.filter(u => u.kind === "position" && u.parentUnitId === dep.id && /^Директор (?:Д[А-ЯЁ]+|департамента)/u.test(u.name)));
      if (!owners.length && /Директоры департаментов/u.test(context)) owners = units.filter(u => u.kind === "position" && /^Директор Д[А-ЯЁ]+$/u.test(u.name));
      if (!owners.length) owners = units.filter(u => u.kind === "position" && normalize(context).startsWith(u.normalizedName));
    }
    if (/может поручить/u.test(c.text)) {
      const title = c.text.match(/Директору (.+?)[.;]?$/u)?.[1];
      const department = title && units.find(u => u.kind === "department" && u.normalizedName.replace(/^департамент\s+/u, "") === normalize(clean(title)));
      const target = title && (units.find(u => normalize(u.name) === normalize(`Директор ${clean(title)}`))
        ?? (department && units.find(u => u.kind === "position" && u.parentUnitId === department.id && u.name === `Директор ${department.abbreviation}`)));
      if (department && target) result.warnings.push(`${c.side}: ${locatorNumber(c)} — название получателя делегирования предварительно сопоставлено с «${target.name}» через название департамента; проверьте синоним.`);
      owners = target ? [target] : chief ? [chief] : [];
    }
    for (const owner of owners) {
      const category = /имеют право|имеет право/u.test(context) ? "right" : "function";
      const role: OrgFunction["role"] = /утвержд/iu.test(body) ? "approve" : /контрол/iu.test(body) ? "control" : /провод.{0,20}(проверк|аудит)/iu.test(body) ? "audit" : /содейств|консульт/iu.test(body) ? "support" : "other";
      const ev = evidenceFor(c, parsed);
      const header = parsed.clauses.find(p => p.documentId === c.documentId && p.number === c.number.split(".").slice(0, 2).join(".") && p.kind === "clause");
      result.functions.push({ id: `function-${uid(c.id, owner.id)}`, clauseId: c.id, unitId: owner.id, side: c.side, text: body,
        action: body.split(/\s/u)[0], object: body, process: normalize(body), role, category,
        evidence: [ev, ...(header && header.id !== c.id ? [evidenceFor(header, parsed)] : [])] });
    }
  }
  if (!result.functions.length) result.warnings.push("Правила функций регламента не применимы к этим документам. Отсутствие извлечённых функций не означает отсутствие обязанностей.");
}

/** A duty consolidated into one AFTER clause preserves every BEFORE clause that maps to it.
 *  The schema allows one function in a single lineage record only, so such BEFORE clauses are
 *  grouped into one many-to-one record instead of the first claim winning and the rest reading as lost. */
export function traceFunctions(result: AnalysisResult, parsed: ParsedClauses) {
  const afterFunctions = result.functions.filter(f => f.side === "after");
  const beforeClauseIds = [...new Set(result.functions.filter(f => f.side === "before").map(f => f.clauseId))];
  type Ranked = { f: OrgFunction; score: number; cover: number; scope: number };
  type Choice = { clauseId: string; method: AnalysisMethod; target?: string; ranked: Ranked[] };
  // Alignment already settled one-to-one pairs; a similarity claim must not displace one.
  const reserved = new Map<string, string>();
  for (const a of result.alignments) if (a.beforeClauseId && a.afterClauseId) reserved.set(a.afterClauseId, a.beforeClauseId);
  const rankings = new Map<string, Ranked[]>();
  for (const clauseId of beforeClauseIds) {
    const before = result.functions.filter(f => f.clauseId === clauseId);
    const ranked = afterFunctions.filter(f => f.category === before[0].category)
      .map(f => ({ f, score: similarity(before[0].text, f.text), cover: coverage(before[0].text, f.text), scope: acronymShare(before[0].text, f.text) }))
      // On equal wording overlap, the candidate that keeps the same scope markers is the same duty.
      .sort((a, b) => b.score - a.score || b.scope - a.scope || b.cover - a.cover || a.f.id.localeCompare(b.f.id));
    rankings.set(clauseId, ranked);
  }
  const choices: Choice[] = [];
  for (const clauseId of beforeClauseIds) {
    const before = result.functions.filter(f => f.clauseId === clauseId);
    const alignment = result.alignments.find(a => a.beforeClauseId === clauseId);
    const ranked = rankings.get(clauseId)!;
    let target = alignment?.afterClauseId && ranked.some(c => c.f.clauseId === alignment.afterClauseId) ? alignment.afterClauseId : undefined;
    let method = methodOfAlignment(alignment);
    if (!target && alignment?.method !== "llm") {
      // Either a strong token match, or a narrowed/widened wording contained in the other. A duty kept
      // verbatim while the other side gained text scores low on tokens yet is not a loss.
      const smaller = (c: Ranked) => Math.min(contentTokens(c.f.text), contentTokens(before[0].text));
      const acceptable = ranked.filter(c => c.score >= 0.72
        || (c.score >= 0.5 && c.cover >= 0.8 && smaller(c) >= 5)
        || (c.score >= 0.4 && c.cover >= 0.95 && smaller(c) >= 8));
      const isFree = (c: Ranked) => !reserved.has(c.f.clauseId) || reserved.get(c.f.clauseId) === clauseId;
      // Otherwise join a clause that consolidated several duties. A group heading is where consolidated
      // duties are stated, so it is preferred over another owner's personal clause even at a lower score.
      const grouped = (c: Ranked) => ambiguous(parsed.sources.get(c.f.clauseId)!.context);
      const best = acceptable.find(isFree) ?? acceptable.find(grouped) ?? acceptable[0];
      if (best) { target = best.f.clauseId; method = "text_similarity"; }
    }
    choices.push({ clauseId, method, target, ranked });
  }
  const groups = new Map<string, Choice[]>();
  for (const choice of choices.filter(c => c.target)) {
    const before = result.functions.filter(f => f.clauseId === choice.clauseId);
    const key = `${choice.target}\u0000${before[0].category}`;
    groups.set(key, [...(groups.get(key) ?? []), choice]);
  }
  const trace = (choice: Choice, picked: OrgFunction[]) => choice.ranked.slice(0, 5).map(({ f, score }) => ({ functionId: f.id,
    reason: `Текстовая похожесть ${score.toFixed(2)}; ${picked.some(a => a.id === f.id) ? "выбран кандидат" : "не выбран; смысловая эквивалентность требует проверки"}.` }));
  for (const [key, members] of groups) {
    const [targetClauseId, category] = key.split("\u0000");
    const after = afterFunctions.filter(f => f.clauseId === targetClauseId && f.category === category);
    const before = members.flatMap(m => result.functions.filter(f => f.clauseId === m.clauseId));
    const sameOwners = before.every(b => after.some(a => result.unitChanges.some(u => u.beforeUnitIds.includes(b.unitId) && u.afterUnitIds.includes(a.unitId))));
    const identical = members.every(m => {
      const text = result.functions.find(f => f.clauseId === m.clauseId)!.text;
      return normalize(text) === normalize(after[0].text) || result.alignments.find(a => a.beforeClauseId === m.clauseId)?.status === "COSMETIC";
    });
    const status = !sameOwners ? "TRANSFERRED" : identical ? "UNCHANGED" : "MODIFIED";
    const numbers = members.map(m => locatorNumber(parsed.clauses.find(c => c.id === m.clauseId)!)).filter(Boolean);
    const ac = parsed.clauses.find(c => c.id === targetClauseId);
    const consolidated = members.length > 1 ? ` Пункты ДО ${numbers.join(", ")} сведены в один пункт ПОСЛЕ; распределение ответственности требует проверки.` : "";
    // A model judgement outranks a token match when several BEFORE clauses land on one AFTER clause.
    const method = members.some(m => m.method === "llm") ? "llm" : members.some(m => m.method === "embedding") ? "embedding"
      : members.every(m => m.method === "rule") ? "rule" : "text_similarity";
    result.lineage.push({ id: `lineage-${uid(...members.map(m => m.clauseId).sort())}`, beforeFunctionIds: before.map(f => f.id), afterFunctionIds: after.map(f => f.id), status,
      ...(numbers[0] ? { beforeClauseNumber: numbers[0] } : {}), ...(ac?.number ? { afterClauseNumber: locatorNumber(ac) } : {}), method,
      rationale: (status === "TRANSFERRED" ? "Сопоставлено содержание пунктов при изменении владельца. Содержательные отличия и область группового заголовка требуют проверки."
        : status === "UNCHANGED" ? "Содержание сохранено у сопоставленного владельца; номера могут различаться." : "У сопоставленного владельца изменена формулировка. Проверьте область, периодичность и условия.") + consolidated,
      candidatesChecked: trace(members[0], after) });
  }
  for (const choice of choices.filter(c => !c.target)) {
    const before = result.functions.filter(f => f.clauseId === choice.clauseId);
    const c = parsed.clauses.find(c => c.id === choice.clauseId)!;
    result.lineage.push({ id: `lineage-${uid(choice.clauseId)}`, beforeFunctionIds: before.map(f => f.id), afterFunctionIds: [], status: "POSSIBLE_LOSS",
      ...(c.number ? { beforeClauseNumber: locatorNumber(c) } : {}), method: choice.method,
      rationale: "В извлечённых функциях ПОСЛЕ соответствие не найдено. Это кандидат: требуется проверка общих обязанностей и других владельцев.",
      candidatesChecked: trace(choice, []) });
  }
  const claimed = new Set(result.lineage.flatMap(l => l.afterFunctionIds));
  for (const clauseId of new Set(afterFunctions.filter(f => !claimed.has(f.id)).map(f => f.clauseId))) {
    const after = afterFunctions.filter(f => f.clauseId === clauseId && !claimed.has(f.id));
    result.lineage.push({ id: `lineage-${uid(clauseId)}`, beforeFunctionIds: [], afterFunctionIds: after.map(f => f.id), status: "NEW", ...(parsed.clauses.find(c => c.id === clauseId)?.number ? { afterClauseNumber: locatorNumber(parsed.clauses.find(c => c.id === clauseId)!) } : {}), rationale: "Предшественник в извлечённых функциях ДО не сопоставлен; проверьте общий контекст.", candidatesChecked: [], method: "rule" });
  }
}

export function addFinding(result: AnalysisResult, input: Omit<Finding, "id" | "review" | "verified"> & { verified?: boolean }) {
  const f: Finding = { ...input, id: `finding-${uid(input.type, input.title, ...input.evidence.map(e => e.fragmentId))}`,
    verified: input.verified ?? input.evidence.every(e => e.verified), review: { status: "NEEDS_CHECK" } };
  if (!result.findings.some(existing => existing.id === f.id)) result.findings.push(f);
}
export function checkDocuments(result: AnalysisResult, parsed: ParsedClauses) {
  const clauses = parsed.clauses.filter(c => c.side === "after" && ["clause", "item"].includes(c.kind));
  for (const c of clauses) {
    const base = { reviewPriority: "MEDIUM" as const, confidence: "medium" as const, unitIds: [], functionIds: [], method: "rule" as const, recommendation: "Проверьте формулировку и уточните документ у ответственного сотрудника." };
    if (ambiguous(content(c))) addFinding(result, { ...base, type: "AMBIGUITY", title: `Неоднозначный круг директоров: ${locatorNumber(c)}`, explanation: "Неясно, относится ли уточнение департаментов ко всем перечисленным директорам или только к директорам направлений.", evidence: [evidenceFor(c, parsed)] });
    for (const match of c.text.matchAll(/(?:п\.\s*| и )(\d+\.\d+\.\d+)/gu)) {
      const target = clauses.find(p => p.documentId === c.documentId && p.number === match[1] && !p.letter);
      const beforeAlignment = result.alignments.find(a => a.afterClauseId === c.id);
      const bc = parsed.clauses.find(p => p.id === beforeAlignment?.beforeClauseId);
      const oldTarget = bc && parsed.clauses.find(p => p.documentId === bc.documentId && p.number === match[1] && !p.letter);
      const movedAlignment = oldTarget && result.alignments.find(a => a.beforeClauseId === oldTarget.id);
      const moved = movedAlignment?.afterClauseId;
      if (!target || (moved && moved !== target.id)) addFinding(result, { ...base, type: "BROKEN_REFERENCE", title: `Проверить ссылку ${locatorNumber(c)} → ${match[1]}`, method: target ? methodOfAlignment(movedAlignment || undefined) : "rule",
        explanation: !target ? "Целевой пункт не найден в этом документе." : "Ссылка сохранила номер, но прежнее содержание цели сопоставлено с другим пунктом. Возможна неактуализированная ссылка после перенумерации.",
        evidence: [evidenceFor(c, parsed), ...(target ? [evidenceFor(target, parsed)] : []), ...(oldTarget ? [evidenceFor(oldTarget, parsed)] : []), ...parsed.clauses.filter(p => p.documentId === c.documentId && p.number === target?.parentNumber && p.kind === "clause").map(p => evidenceFor(p, parsed)), ...(moved ? parsed.clauses.filter(p => p.id === moved).map(p => evidenceFor(p, parsed)) : [])] });
    }
    const role = c.text.match(/(?:поручить|делегировать)[^.]*?Директору ([^.;]+)/u);
    if (role && !result.units.some(u => u.side === "after" && normalize(u.name) === normalize(`Директор ${role[1]}`))) addFinding(result, { ...base, type: "UNDEFINED_ROLE", title: `Уточнить получателя делегирования: ${locatorNumber(c)}`, explanation: `Титул «Директор ${role[1]}» не имеет точного соответствия в извлечённой структуре. Возможен синоним существующей должности.`, evidence: [evidenceFor(c, parsed)] });
  }
  // One position named in two reporting clauses reports to two managers. Reported as a conflict of
  // reporting lines; functional and administrative subordination may legitimately differ, so the finding
  // stays a candidate for review and never asserts an actual conflict of interest.
  for (const unit of result.units.filter(u => u.kind === "position")) {
    const reporting = unit.evidence.filter(e => /подчиняются/u.test(e.quote));
    // A position also appears in the clause where it is the manager; that is not its own reporting line.
    const tail = (name: string) => normalize(name).split(/\s+/u).slice(1).join(" ");
    const managers = [...new Set(reporting.map(e => e.fragmentText.match(/((?:Главному аудитору|Директору [^,]{1,80}?))\s+(?:функционально\s+)?подчиняются/u)?.[1] ?? e.locator.label))]
      .filter(name => tail(name) !== tail(unit.name));
    if (reporting.length < 2 || managers.length < 2) continue;
    const side = unit.side === "before" ? "ДО" : "ПОСЛЕ";
    addFinding(result, { type: "CONFLICT", title: `Двойное подчинение (${side}): ${unit.name}`, reviewPriority: "HIGH", confidence: "low",
      unitIds: [unit.id], functionIds: [], evidence: reporting, method: "rule",
      explanation: `Должность указана в перечнях подчинения у нескольких руководителей: ${managers.join("; ")}. Двойная линия подчинения создаёт риск несогласованных поручений и приоритетов. Источник прямо различает функциональное и административное подчинение, поэтому это кандидат для проверки, а не доказанный конфликт интересов.`,
      recommendation: "Уточните вид каждой связи (административная или функциональная), распределение поручений и приоритет руководителей." });
  }
}
export function deriveFindings(result: AnalysisResult, parsed: ParsedClauses) {
  // A document that did not fully parse cannot support a verified loss: absence of text is not absence of a duty.
  const incomplete = result.documents.some(d => !d.fragmentCount || d.warnings.some(w => /отсутствует|не удалось|неподдерживаем/u.test(w)));
  const unit = (id: string) => result.units.find(u => u.id === id)!;
  const dedupe = (ev: Evidence[]) => [...new Map(ev.map(e => [`${e.fragmentId}:${e.quote}`, e])).values()];
  const ambiguousClause = (f: OrgFunction) => ambiguous(parsed.sources.get(f.clauseId)!.context);
  // One entry per reorganized unit, so the list answers "which units were reorganized" rather than
  // repeating one finding per clause. Structural changes and duty transfers are collected together.
  type Reorg = { own: string; changes: string[]; evidence: Evidence[]; units: Set<string>; functions: Set<string> };
  const reorg = new Map<string, Reorg>();
  // Key by the unit's own UnitChange so a preserved or renamed position is one entry across both editions,
  // and two same-named positions in different departments stay apart.
  const changeOf = new Map<string, string>();
  for (const c of result.unitChanges) for (const id of [...c.beforeUnitIds, ...c.afterUnitIds]) changeOf.set(id, c.id);
  const note = (unitId: string, change: string, evidence: Evidence[], units: string[] = [], functions: string[] = []) => {
    const key = changeOf.get(unitId) ?? unitId;
    // Name the entry after the unit it is about, taking the AFTER side of its change when it survived.
    const change9 = result.unitChanges.find(c => c.id === key);
    const own = change9?.afterUnitIds[0] ?? change9?.beforeUnitIds[0] ?? unitId;
    const entry = reorg.get(key) ?? { own, changes: [], evidence: [], units: new Set([unitId]), functions: new Set<string>() };
    entry.units.add(unitId);
    if (!entry.changes.includes(change)) { entry.changes.push(change); entry.evidence.push(...evidence); }
    for (const u of units) entry.units.add(u);
    for (const f of functions) entry.functions.add(f);
    reorg.set(key, entry);
  };
  const label = (id: string) => { const u = unit(id); return u.kind === "position" && u.parentName ? `${u.name} (${u.parentName})` : u.name; };
  for (const change of result.unitChanges.filter(c => c.status !== "PRESERVED")) {
    const involved = [...change.beforeUnitIds, ...change.afterUnitIds];
    const summary = change.status === "CREATED" ? `Появление в структуре ПОСЛЕ: ${change.afterUnitIds.map(label).join(", ")}`
      : change.status === "REMOVED" ? `Удаление из перечня ДО: ${change.beforeUnitIds.map(label).join(", ")}`
      : `Переименование: ${change.beforeUnitIds.map(label).join(", ")} → ${change.afterUnitIds.map(label).join(", ")}`;
    for (const id of involved) note(id, `${summary}. ${change.rationale}`, change.evidence, involved);
  }
  const groupTransfers: { lineage: string; before: string; after: string; functions: OrgFunction[] }[] = [];
  for (const l of result.lineage.filter(l => l.status === "NEW")) {
    const functions = l.afterFunctionIds.map(id => result.functions.find(f => f.id === id)!);
    for (const id of new Set(functions.map(f => f.unitId))) note(id, `Новая обязанность ПОСЛЕ ${l.afterClauseNumber ?? "—"} без сопоставленного предшественника в ДО.`, dedupe(functions.flatMap(f => f.evidence)), [], functions.map(f => f.id));
  }
  for (const l of result.lineage.filter(l => l.status !== "UNCHANGED" && l.status !== "NEW")) {
    const functions = [...l.beforeFunctionIds, ...l.afterFunctionIds].map(id => result.functions.find(f => f.id === id)!);
    const ev = dedupe(functions.flatMap(f => f.evidence));
    const loss = l.status === "POSSIBLE_LOSS";
    const uncertain = functions.some(ambiguousClause);
    const checked = result.functions.filter(f => f.side === "after" && f.category === functions[0].category).length;
    const numbers = `${l.beforeClauseNumber ?? "—"} → ${l.afterClauseNumber ?? "—"}`;
    if (l.status === "TRANSFERRED") {
      const gaining = [...new Set(functions.filter(f => f.side === "after").map(f => f.unitId))];
      const losing = [...new Set(functions.filter(f => f.side === "before").map(f => f.unitId))];
      for (const id of losing) note(id, `Обязанность ${numbers} закреплена в ПОСЛЕ за: ${gaining.map(label).join(", ") || "не определено"}.`, ev, [...losing, ...gaining], functions.map(f => f.id));
      for (const id of gaining) note(id, `Принята обязанность ${numbers} от: ${losing.map(label).join(", ")}.`, ev, [...losing, ...gaining], functions.map(f => f.id));
      if (uncertain) groupTransfers.push({ lineage: l.id, before: l.beforeClauseNumber ?? "—", after: l.afterClauseNumber ?? "—", functions });
      continue;
    }
    addFinding(result, { type: loss ? "LOSS" : "SCOPE_CHANGE", title: `${loss ? "Возможная потеря" : "Изменение формулировки"}: ${numbers}`,
      explanation: l.rationale + (uncertain ? " Область действия группового заголовка неоднозначна." : ""),
      reviewPriority: loss && functions[0].category === "function" ? "HIGH" : "MEDIUM", confidence: loss || uncertain ? "low" : "medium",
      unitIds: [...new Set(functions.map(f => f.unitId))], functionIds: functions.map(f => f.id), evidence: ev,
      // A textual search is not a semantic loss proof; the quotation and the exhausted search are what is verified.
      method: l.method, verified: ev.every(e => e.verified) && (!loss || (checked > 0 && !incomplete)),
      ...(loss ? { searchTrace: { checkedCount: checked, topCandidates: l.candidatesChecked } } : {}),
      recommendation: loss ? "Проверьте общие обязанности, перенос к другому владельцу и непроанализированные документы." : "Проверьте смысл изменения и круг ответственных лиц." });
    if (uncertain) groupTransfers.push({ lineage: l.id, before: l.beforeClauseNumber ?? "—", after: l.afterClauseNumber ?? "—", functions });
  }
  for (const entry of reorg.values()) {
    addFinding(result, { type: "REORGANIZATION", title: `Реорганизация: ${label(entry.own)}`,
      explanation: `Изменений по этому подразделению/должности: ${entry.changes.length}.\n${entry.changes.map(c => `— ${c}`).join("\n")}`,
      unitIds: [...entry.units], functionIds: [...entry.functions], evidence: dedupe(entry.evidence).slice(0, 24),
      reviewPriority: "LOW", confidence: "medium", method: "rule", recommendation: "Проверьте соответствие должностей, передачу обязанностей и полноту штатного расписания." });
  }
  // One question per ambiguous group heading, not one per transferred clause.
  const headings = new Map<string, typeof groupTransfers>();
  for (const t of groupTransfers) {
    const after = t.functions.filter(f => f.side === "after" && ambiguousClause(f));
    const clause = after.map(f => parsed.clauses.find(c => c.id === f.clauseId)!).find(Boolean);
    const key = clause ? clause.number.split(".").slice(0, 2).join(".") : "—";
    headings.set(key, [...(headings.get(key) ?? []), t]);
  }
  for (const [key, transfers] of headings) {
    const heading = parsed.clauses.find(c => c.side === "after" && c.number === key && c.kind === "clause");
    const functions = transfers.flatMap(t => t.functions);
    addFinding(result, { type: "AMBIGUITY", title: `Неоднозначная область группового заголовка ${key}: затронуто пунктов ДО — ${transfers.length}`,
      explanation: `Обязанности перенесены под групповой заголовок ${key}. Из его формулировки не следует однозначно, распространяется ли он на прежних владельцев, поэтому перенос не подтверждает сохранение персональной ответственности.\nПункты: ${transfers.map(t => `${t.before} → ${t.after}`).join("; ")}.`,
      reviewPriority: "MEDIUM", confidence: "medium", unitIds: [...new Set(functions.map(f => f.unitId))], functionIds: [...new Set(functions.map(f => f.id))],
      evidence: dedupe([...(heading ? [evidenceFor(heading, parsed)] : []), ...functions.flatMap(f => f.evidence)]).slice(0, 24),
      method: "rule", recommendation: "Уточните у владельцев процессов, входят ли прежние владельцы в круг действия группового заголовка." });
  }
  duplication(result, parsed);
}

/** Same duty stated for different owners in the AFTER edition. A group heading and a personal block may
 *  both carry it, so an ambiguous heading keeps the candidate at medium confidence for human review. */
function duplication(result: AnalysisResult, parsed: ParsedClauses) {
  const after = result.functions.filter(f => f.side === "after");
  const unit = (id: string) => result.units.find(u => u.id === id)!;
  const related = (a: Unit, b: Unit) => a.id === b.id || a.parentUnitId === b.id || b.parentUnitId === a.id;
  const seen = new Set<string>();
  for (let i = 0; i < after.length; i++) for (let j = i + 1; j < after.length; j++) {
    const a = after[i], b = after[j];
    if (a.clauseId === b.clauseId || a.category !== b.category) continue;
    const ua = unit(a.unitId), ub = unit(b.unitId);
    if (ua.kind === "block" || ub.kind === "block") continue;
    const exact = normalize(a.text) === normalize(b.text);
    const near = similarity(a.text, b.text) >= 0.7 && coverage(a.text, b.text) >= 0.8;
    if (!exact && !near) continue;
    // Owners may be the same unit reached through a group heading and through its own block: still a
    // redundant assignment to check, because the two clauses can be read as two separate duties.
    const grouped = [a, b].some(f => ambiguous(parsed.sources.get(f.clauseId)!.context));
    if (related(ua, ub) && !grouped) continue;
    // Keep only a redundancy a reader can act on: the same duty under an ambiguous group heading and in a
    // personal block, or a verbatim repeat between unrelated owners. A general duty of the block head
    // detailed at director level is a hierarchy, so near matches across levels are not reported.
    const level = (u: Unit) => result.units.find(p => p.id === u.parentUnitId)?.kind === "block" && u.kind === "position";
    if (!grouped && (!exact || level(ua) !== level(ub))) continue;
    const key = [a.clauseId, b.clauseId].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    const numbers = [a, b].map(f => locatorNumber(parsed.clauses.find(c => c.id === f.clauseId)!)).join(" / ");
    addFinding(result, { type: "DUPLICATION", title: `Совпадающая обязанность ПОСЛЕ ${numbers}: ${ua.name}${ua.id === ub.id ? "" : ` / ${ub.name}`}`,
      explanation: `${exact ? "Дословное совпадение" : "Совпадение по содержанию"} обязанности в двух пунктах редакции ПОСЛЕ.${grouped ? " Один из пунктов находится под групповым заголовком директоров, поэтому круг владельцев допускает разное прочтение." : ""} Общая формулировка может быть штатным распределением, поэтому это кандидат для проверки.`,
      unitIds: [...new Set([a.unitId, b.unitId])], functionIds: [a.id, b.id], evidence: [...new Map([...a.evidence, ...b.evidence].map(e => [`${e.fragmentId}:${e.quote}`, e])).values()],
      reviewPriority: "MEDIUM", confidence: grouped ? "medium" : "low", verified: !grouped && exact, method: exact ? "rule" : "text_similarity",
      recommendation: "Уточните объекты ответственности и исключите нормальное распределение общей обязанности." });
  }
}
export function summarize(result: AnalysisResult) {
  for (const s of UnitStatusSchema.options) result.summary.unitsByStatus[s] = result.unitChanges.filter(x => x.status === s).length;
  for (const s of LineageStatusSchema.options) result.summary.functionsByStatus[s] = result.lineage.filter(x => x.status === s).length;
  for (const s of FindingTypeSchema.options) result.summary.findingsByType[s] = result.findings.filter(x => x.type === s && x.verified).length;
  for (const s of AlignmentStatusSchema.options) result.summary.alignmentsByStatus[s] = result.alignments.filter(x => x.status === s).length;
}
export function conclude(result: AnalysisResult) {
  const titles = ["Изменения структуры", "Сохранение функций", "Возможные потери", "Дублирование", "Конфликты", "Требуется проверка человеком"];
  const groups = [["REORGANIZATION"], ["SCOPE_CHANGE"], ["LOSS"], ["DUPLICATION"], ["CONFLICT"], ["BROKEN_REFERENCE", "UNDEFINED_ROLE", "AMBIGUITY"]];
  result.conclusion.sections = ConclusionKeySchema.options.map((key, i) => {
    const findings = result.findings.filter(f => f.verified && groups[i].includes(f.type));
    return { key, title: titles[i], text: findings.length ? `Подтверждены текстовые основания ${findings.length} замечаний. Интерпретация и распределение ответственности требуют проверки сотрудником.` : "Проверенных выводов этой категории нет. Это не доказывает отсутствие рисков; проверьте диагностические кандидаты и ограничения анализа.", findingIds: findings.map(f => f.id) };
  });
}
