import { FindingTypeSchema, UnitStatusSchema, LineageStatusSchema, AlignmentStatusSchema, ConclusionKeySchema, type AnalysisMethod, type AnalysisResult, type Clause, type OrgFunction, type Unit, type Finding } from "@/shared/contract";
import { methodOfAlignment } from "@/shared/method";
import { content, normalize, similarity, evidenceFor, locatorNumber, type ParsedClauses } from "./clauses";
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
  const used = new Set<string>();
  for (const b of result.units.filter(u => u.side === "before")) {
    const parent = result.units.find(u => u.id === b.parentUnitId);
    const a = result.units.find(u => u.side === "after" && !used.has(u.id) && u.kind === b.kind && u.normalizedName === b.normalizedName && result.units.find(p => p.id === u.parentUnitId)?.normalizedName === parent?.normalizedName);
    if (a) used.add(a.id);
    result.unitChanges.push({ id: `change-${b.id}`, beforeUnitIds: [b.id], afterUnitIds: a ? [a.id] : [], status: a ? "PRESERVED" : "REMOVED",
      rationale: a ? "Название и структурная принадлежность сохранены; состав обязанностей проверяется отдельно." : "Точное соответствие должности/подразделения в структуре ПОСЛЕ не найдено. Возможное переименование требует проверки.", evidence: [...b.evidence, ...(a?.evidence ?? [])] });
  }
  for (const a of result.units.filter(u => u.side === "after" && !used.has(u.id))) result.unitChanges.push({ id: `change-${a.id}`, beforeUnitIds: [], afterUnitIds: [a.id], status: "CREATED", rationale: "В структуре ДО не найдено точное соответствие. Проверьте возможное переименование.", evidence: a.evidence });
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

export function traceFunctions(result: AnalysisResult, parsed: ParsedClauses) {
  const used = new Set<string>();
  const reserved = new Map(result.alignments.filter(a => a.beforeClauseId && a.afterClauseId).map(a => [a.afterClauseId!, a.beforeClauseId!]));
  for (const clauseId of new Set(result.functions.filter(f => f.side === "before").map(f => f.clauseId))) {
    const before = result.functions.filter(f => f.clauseId === clauseId);
    const alignment = result.alignments.find(a => a.beforeClauseId === clauseId);
    const pool = result.functions.filter(f => f.side === "after" && !used.has(f.id) && f.category === before[0].category && (!reserved.has(f.clauseId) || reserved.get(f.clauseId) === clauseId));
    let after = pool.filter(f => f.clauseId === alignment?.afterClauseId);
    let method: AnalysisMethod = methodOfAlignment(alignment);
    const ranked = result.functions.filter(f => f.side === "after" && f.category === before[0].category).map(f => ({ f, score: similarity(before[0].text, f.text) })).sort((a, b) => b.score - a.score || a.f.id.localeCompare(b.f.id));
    const available = ranked.find(({ f }) => pool.some(candidate => candidate.id === f.id));
    if (!after.length && alignment?.method !== "llm" && available && available.score >= 0.72) { after = pool.filter(f => f.clauseId === available.f.clauseId); method = "text_similarity"; }
    // Without a match the decision rests on the similarity ranking above, unless a model already judged the pair.
    if (!after.length && method !== "embedding" && method !== "llm") method = "text_similarity";
    after.forEach(f => used.add(f.id));
    const sameOwners = before.every(b => after.some(a => result.unitChanges.some(u => u.beforeUnitIds.includes(b.unitId) && u.afterUnitIds.includes(a.unitId))));
    const status = !after.length ? "POSSIBLE_LOSS" : !sameOwners ? "TRANSFERRED" : (normalize(before[0].text) === normalize(after[0].text) || alignment?.status === "COSMETIC") ? "UNCHANGED" : "MODIFIED";
    const c = parsed.clauses.find(c => c.id === clauseId)!;
    const ac = after[0] && parsed.clauses.find(c => c.id === after[0].clauseId);
    result.lineage.push({ id: `lineage-${uid(clauseId)}`, beforeFunctionIds: before.map(f => f.id), afterFunctionIds: after.map(f => f.id), status,
      ...(c.number ? { beforeClauseNumber: locatorNumber(c) } : {}), ...(ac?.number ? { afterClauseNumber: locatorNumber(ac) } : {}), method,
      rationale: status === "POSSIBLE_LOSS" ? "В извлечённых функциях ПОСЛЕ соответствие не найдено. Это кандидат: требуется проверка общих обязанностей и других владельцев."
        : status === "TRANSFERRED" ? "Сопоставлено содержание пунктов при изменении владельца. Содержательные отличия и область группового заголовка требуют проверки."
        : status === "UNCHANGED" ? "Содержание сохранено у сопоставленного владельца; номера могут различаться." : "У сопоставленного владельца изменена формулировка. Проверьте область, периодичность и условия.",
      candidatesChecked: ranked.slice(0, 5).map(({ f, score }) => ({ functionId: f.id, reason: `Текстовая похожесть ${score.toFixed(2)}; ${after.some(a => a.id === f.id) ? "выбран кандидат" : (used.has(f.id) || reserved.has(f.clauseId) && reserved.get(f.clauseId) !== clauseId) ? "сопоставлено другому пункту; проверьте общее покрытие" : "не выбран; смысловая эквивалентность требует проверки"}.` })) });
  }
  for (const clauseId of new Set(result.functions.filter(f => f.side === "after" && !used.has(f.id)).map(f => f.clauseId))) {
    const after = result.functions.filter(f => f.clauseId === clauseId && !used.has(f.id));
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
  for (const unit of result.units.filter(u => u.kind === "position")) {
    const reporting = unit.evidence.filter(e => /подчиняются/u.test(e.quote));
    if (reporting.length > 1) addFinding(result, { type: "AMBIGUITY", title: `Несколько связей подчинения: ${unit.name}`, reviewPriority: "MEDIUM", confidence: "medium", unitIds: [unit.id], functionIds: [], evidence: reporting, method: "rule",
      explanation: "Должность упомянута в нескольких отношениях подчинения. Функциональное и административное руководство могут различаться; сам факт не доказывает конфликт.", recommendation: "Уточните вид каждой связи и полномочия руководителей." });
  }
}
export function deriveFindings(result: AnalysisResult, parsed: ParsedClauses) {
  for (const change of result.unitChanges.filter(c => c.status !== "PRESERVED")) {
    const names = [...change.beforeUnitIds, ...change.afterUnitIds].map(id => result.units.find(u => u.id === id)!.name).join(" → ");
    addFinding(result, { type: "REORGANIZATION", title: `${change.status === "CREATED" ? "Появление" : "Удаление из перечня"}: ${names}`, explanation: change.rationale, unitIds: [...change.beforeUnitIds, ...change.afterUnitIds], functionIds: [], evidence: change.evidence, reviewPriority: "LOW", confidence: "medium", method: "rule", recommendation: "Проверьте соответствие должностей и передачу их обязанностей." });
  }
  for (const l of result.lineage.filter(l => l.status !== "UNCHANGED")) {
    const functions = [...l.beforeFunctionIds, ...l.afterFunctionIds].map(id => result.functions.find(f => f.id === id)!);
    const ev = functions.flatMap(f => f.evidence);
    const loss = l.status === "POSSIBLE_LOSS";
    const uncertain = functions.some(f => ambiguous(parsed.sources.get(f.clauseId)!.context));
    addFinding(result, { type: loss ? "LOSS" : l.status === "TRANSFERRED" ? "REORGANIZATION" : "SCOPE_CHANGE", title: `${loss ? "Возможная потеря" : l.status === "TRANSFERRED" ? "Передача ответственности" : "Изменение формулировки"}: ${l.beforeClauseNumber ?? "—"} → ${l.afterClauseNumber ?? "—"}`, explanation: l.rationale + (uncertain ? " Область действия группового заголовка неоднозначна." : ""),
      reviewPriority: loss && functions[0].category === "function" ? "HIGH" : "MEDIUM", confidence: loss || uncertain ? "low" : "medium", unitIds: [...new Set(functions.map(f => f.unitId))], functionIds: functions.map(f => f.id), evidence: [...new Map(ev.map(e => [e.fragmentId, e])).values()],
      // A textual search is not a semantic loss proof. Keep these candidates diagnostic.
      method: l.method, verified: !loss && ev.every(e => e.verified), ...(loss ? { searchTrace: { checkedCount: result.functions.filter(f => f.side === "after" && f.category === functions[0].category).length, topCandidates: l.candidatesChecked } } : {}), recommendation: loss ? "Проверьте общие обязанности, перенос к другому владельцу и непроанализированные документы." : "Проверьте смысл изменения и круг ответственных лиц." });
  }
  const after = result.functions.filter(f => f.side === "after");
  for (let i = 0; i < after.length; i++) for (let j = i + 1; j < after.length; j++) {
    const a = after[i], b = after[j];
    if (a.clauseId === b.clauseId || a.category !== b.category) continue;
    const ua = result.units.find(u => u.id === a.unitId)!, ub = result.units.find(u => u.id === b.unitId)!;
    if (ua.kind === "block" || ub.kind === "block" || ua.parentUnitId === ub.id || ub.parentUnitId === ua.id) continue;
    if (a.unitId !== b.unitId && normalize(a.text) === normalize(b.text)) addFinding(result, { type: "DUPLICATION", title: `Совпадающая формулировка: ${ua.name} / ${ub.name}`, explanation: "Дословное совпадение обязанностей разных владельцев; общая формулировка может быть штатным распределением, поэтому это диагностический кандидат.", unitIds: [a.unitId, b.unitId], functionIds: [a.id, b.id], evidence: [...a.evidence, ...b.evidence], reviewPriority: "MEDIUM", confidence: "low", verified: false, method: "rule", recommendation: "Уточните объекты ответственности и исключите нормальное распределение общей обязанности." });
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
