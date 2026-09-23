# Synthetic evaluation set

This deliberately synthetic set provides a reproducible check of the official case's required known events: organizational transformation, possible function loss, possible duplication and correct supporting sources. It is not organizer data and does not describe a real organization.

## Files and isolation

- `inputs/before.docx`: BEFORE regulation with two departments and five functions.
- `inputs/after.docx`: AFTER regulation with three departments and five function assignments.
- `expected/expected-results.md`: the separate evaluation oracle, including clause references and interpretation limits.

During evaluation, the application receives only the two DOCX files under `inputs/`, assigned to their respective BEFORE/AFTER sides. Do not upload this README, the expected directory, the real-document gold baseline or any evaluation annotations. Do not inject them into prompts, retrieval indexes, caches or application context. `Expected result != Actual result`.

The inputs contain ordinary Russian regulations with explicit clause numbers. They intentionally contain no answer labels, function-test IDs or statements about missing/duplicated functions. The synthetic designation and expected interpretations are kept outside the inputs to avoid leaking answers.

## Evaluation procedure

1. Start a new analysis with only `inputs/before.docx` and `inputs/after.docx`.
2. Save the actual application output separately from both inputs and expected data; record the application commit, configuration/model identifiers, input hashes and execution command or UI steps without secrets.
3. Only after obtaining the output, compare it with `expected/expected-results.md`. Check the meaning, owner, action, object, role and scope, plus exact source clauses. Report missed cases, incorrect citations and extra findings separately.
4. For a possible loss, require the BEFORE evidence and a real search of the entire AFTER document. For possible duplication, require both AFTER owners and both source clauses.
5. Record actual results and evidence; do not claim a pass from this expected document or from a mock result. No application evaluation has been performed as part of creating this set.

## Relationship to the real baseline

This set does not replace `eval/gold/manual-baseline.md`. The real edition 8/9 baseline exercises realistic wording, source tracing and difficult ambiguous cases. This synthetic set provides precise checks of deliberately known required events that the real pair cannot establish unambiguously.

No artificial conflict-of-interest case is included. The real regulations provide the documented potential-conflict scenario. Shared risk-control wording in these inputs is an overlap check, not an execute-versus-audit conflict.

The files are standard DOCX packages, with native paragraphs and literal clause numbers. Compatibility checks apply to these two files only; they do not demonstrate application parser support, PDF/XLSX support or detection accuracy.

## Artifact validation

Validated on 2026-09-23 independently of the application:

- Both ZIP containers and all XML/relationship members parsed successfully; `python-docx` reopened both files and extracted their paragraphs.
- Input-package inspection found no answer labels, evaluator IDs, comments, tracked changes or hidden text. All six expected rows' quoted source fragments matched the appropriate input text.
- Microsoft Word opened both files read-only and exported them with `ExportAsFixedFormat(..., 17)`. Bundled Poppler rendered each PDF to PNG; both single-page images were visually inspected with no clipping, overlap or missing text. Word/export and Poppler commands completed with exit code 0.
- The packaged `render_docx.py` attempt exited 1 because LibreOffice was unavailable. Word was the successful compatibility/rendering fallback; original DOCX files were not saved by Word.
- Temporary PDFs/PNGs are QA intermediates outside the repository, not application inputs or committed fixtures.
- Application evaluation, backend tests, lint and typecheck: NOT RUN; this task created document fixtures and documentation only.
