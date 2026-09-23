# Synthetic expected results

Synthetic oracle only. This file must never be given to the application pipeline during evaluation. It is not an actual result. Execution status: NOT RUN.

Source aliases: B = `../inputs/before.docx`; A = `../inputs/after.docx`. References are original visible sections/clauses, not generated paragraph IDs or guessed pages. F1–F5 are evaluator labels used only here; they are absent from the inputs.

| ID | Expected finding | BEFORE source | AFTER source | Reason |
| --- | --- | --- | --- | --- |
| S01 | STRUCTURE_TRANSFORMED — Департамент внутреннего контроля → Департамент комплаенс и внутреннего контроля; expected rename/continuity match. | B §2: «Департамент внутреннего контроля»; §2.1: «Осуществляет мониторинг исполнения договорных обязательств.»; §2.3: «Ведёт мониторинг выполнения корректирующих мероприятий.» | A §2: «Департамент комплаенс и внутреннего контроля»; §2.1: «Проводит мониторинг выполнения обязательств по договорам.»; §2.2: «Ведёт мониторинг выполнения корректирующих мероприятий.» | Changed department name with retained F1/F3 supports the designed continuity match. The inputs do not contain a rename order; this is a matching inference, not documentary proof of a legal reorganization date. Do not infer a merger/split. |
| S02 | FUNCTION_UNCHANGED — F1 is semantically preserved under the matched department despite rewording. | B §2.1: «Осуществляет мониторинг исполнения договорных обязательств.» | A §2.1: «Проводит мониторинг выполнения обязательств по договорам.» | Same monitoring action, contractual-obligation object, control role and organization-wide scope (§1.2 on both sides). Synonymous wording alone is not a substantive function modification. |
| S03 | POSSIBLE_FUNCTION_LOSS — F2 has no equivalent allocation in synthetic AFTER. | B §2.2: «Контролирует соблюдение процедур закупок.» | Entire A inspected: §1.1–§1.2; department §2, functions §2.1–§2.2; department §3, functions §3.1–§3.2; department §4, function §4.1. No AFTER quotation is evidence of absence. | Search covered all three AFTER departments: комплаенс и внутреннего контроля, риск-менеджмента, корпоративного управления. None controls compliance with procurement procedures. Contract-obligation monitoring and risk-action monitoring have different objects. Require this scoped absence/search result, not an invented AFTER citation or an assertion that real-world loss is proven. |
| S04 | FUNCTION_UNCHANGED — F3 remains with the matched department. | B §2.3: «Ведёт мониторинг выполнения корректирующих мероприятий.» | A §2.2: «Ведёт мониторинг выполнения корректирующих мероприятий.» | Same action/object/role/scope; renumbering is not loss or substantive change. |
| S05 | FUNCTION_UNCHANGED — F4 remains with Департамент риск-менеджмента. | B §3, §3.1: «Выявляет и оценивает корпоративные риски.» | A §3, §3.1: «Выявляет и оценивает корпоративные риски.» | Same department and identical risk-identification/assessment duty. |
| S06 | POSSIBLE_DUPLICATION — F5 is assigned to two distinct AFTER departments. | B §3.2, Департамент риск-менеджмента: «Контролирует выполнение мероприятий по управлению рисками.» | A §3.2, Департамент риск-менеджмента: «Контролирует выполнение мероприятий по управлению рисками.» AND A §4.1, Департамент корпоративного управления: «Контролирует выполнение мероприятий по управлению рисками.» | Both assignments have the same control action, risk-management-actions object, control role and organization-wide scope under §1.2. Neither clause assigns execution to one owner and independent assurance to the other. Both AFTER clauses and owners are required evidence. F5 also remains with its original owner; do not label it lost. Operational redundancy remains a possible interpretation rather than a claim about actual work. |

## Additional consistent findings

The preserved risk-management department (B/A §3), newly listed corporate-governance department (A §4, absent from B's full list) and preservation of F5 at its original owner are consistent with the inputs. Report these separately from S01–S06 rather than treating them automatically as false positives. F5 overlap is not an artificial conflict-of-interest example. F3 and F5 are not automatically duplicates: corrective measures and risk-management measures are not declared identical sets.

## Scoring boundaries

- These are expected cases, not measured detection/citation results. No accuracy, confidence percentage or pass rate is assigned.
- For S01, require the supported continuity mapping and disclose the lack of an explicit rename order.
- For S02, compare semantic preservation; do not require literal sentence identity.
- For S03, require the BEFORE clause and actual full-AFTER search coverage, including every possible receiving department.
- For S06, one AFTER quotation is insufficient; both department-specific assignments are necessary.
- Keep real application results and evidence outside this expected file. A passing result requires reproducible execution and verified evidence.
