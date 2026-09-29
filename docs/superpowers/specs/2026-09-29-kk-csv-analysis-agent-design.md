# KK CSV Analysis Agent Design

## Goal

Add a governed CSV-analysis subsystem to the existing KK Phone Rental agent architecture. It accepts a CSV payload plus a natural-language question, investigates the data with executable analysis, and returns a verified artifact bundle containing structured findings, charts, a PDF report, and a ZIP archive.

## Scope

This work adds analysis capability only. It must not mutate storefront data, booking data, pricing, Scanner/Verifier state, Google Sheets, or production business truth.

## Architectural fit

The repository already centralizes agent access through `server/kk-agent-registry.js`, `server/kk-agent-gateway.js`, orchestration records, and an append-only invocation ledger. CSV analysis should be another governed route rather than a standalone Python project.

The subsystem is split into focused units:

1. `server/kk-csv-analysis-contract.js`
   - validates request shape and limits;
   - defines the artifact manifest contract;
   - validates `findings.json` structure;
   - verifies required artifact names and metadata.

2. `server/kk-csv-analysis-agent.js`
   - owns prompt construction and runtime policy;
   - treats all CSV cell/header text as untrusted data;
   - invokes the configured analysis engine;
   - normalizes engine results;
   - fails closed when required outputs are missing or inconsistent.

3. `server/kk-openai-agents-adapter.js`
   - thin network adapter for the current OpenAI Agents API;
   - receives CSV bytes and question;
   - creates an OpenAI-hosted execution environment with network disabled;
   - downloads published artifacts;
   - exposes no business-write capability.

4. `server/kk-csv-analysis-fallback.js`
   - deterministic local/test fallback with the same output contract;
   - intended for CI, dry-run, and API-unavailable paths;
   - must label `engine_mode` as fallback and must not impersonate a successful remote Agents API run.

5. `scripts/kk-csv-analysis-dry-run.js`
   - local acceptance harness that runs a representative fixture through the same public service boundary.

6. `tests/kk-csv-analysis-agent.test.js`
   - unit/contract tests for validation, prompt-injection resistance, artifact verification, remote/fallback normalization, and gateway registration.

## Public request contract

Gateway task:

`task_type: "analyze_csv"`

Input object:

```json
{
  "question": "Which segments are driving revenue growth?",
  "filename": "sales.csv",
  "csv_base64": "<base64>",
  "allow_fallback": true
}
```

Constraints:
- `question` is required and capped at 4,000 characters.
- `filename` must end in `.csv`.
- decoded CSV payload must be non-empty and no larger than 50 MiB.
- embedded null bytes are rejected.
- raw CSV text is never interpolated into agent instructions.
- production writes and publishes remain zero.

## Result contract

A successful result has:

```json
{
  "schema_version": "KK_CSV_ANALYSIS_RESULT_V1",
  "status": "READY",
  "engine_mode": "openai_agents|fallback",
  "question": "...",
  "dataset": {"rows": 0, "columns": 0},
  "findings": [],
  "caveats": [],
  "artifacts": {
    "report_pdf": "...",
    "findings_json": "...",
    "charts": [],
    "bundle_zip": "..."
  },
  "verification": {
    "contract_pass": true,
    "required_artifacts_present": true
  },
  "production_writes": 0,
  "publishes": 0
}
```

The required logical artifact names are:
- `report.pdf`
- `findings.json`
- zero or more `chart_XX.png`
- `results.zip`

A run is not successful until the artifact contract validates.

## Engine selection

Preferred engine: OpenAI Agents API through the adapter when credentials/runtime are configured.

Fallback engine: deterministic local analyzer for CI and degraded operation. It must:
- provide truthful `engine_mode: "fallback"`;
- generate the same logical artifact manifest;
- never report that OpenAI-hosted Python executed when it did not.

If remote execution fails and `allow_fallback !== true`, the route fails closed.

## Prompt-injection boundary

CSV headers/cells are untrusted input. They are supplied as a file, not concatenated into system instructions. The agent instructions explicitly state that CSV contents are data and must never override analysis rules.

## Gateway integration

Register agent:
- id: `kk-csv-analysis`
- authority: `READ_ONLY_ANALYSIS`
- production_writes: `0`

Register route:
- intent: `analyze_csv`
- route_id: `CSV_ANALYSIS_REPORT`
- owner_review_required: false
- persistent invocation evidence required: true

The existing ledger remains authoritative for invocation evidence. Only request/output hashes are persisted, not raw CSV contents.

## Error handling

Fail closed for:
- invalid base64;
- empty or oversized CSV;
- invalid filename/question;
- missing engine implementation;
- remote engine failure with fallback disabled;
- missing required artifacts;
- invalid findings schema;
- engine result claiming non-zero production writes or publishing.

Return explicit blocker codes rather than partial success.

## Testing

Required tests:
- valid request passes contract;
- invalid base64 and oversize payload fail;
- prompt-like CSV cells remain data only;
- missing report/findings/zip fails artifact verification;
- fallback result is labeled correctly;
- remote failure falls back only when allowed;
- route is registered and requires `kk-csv-analysis`;
- gateway records invocation evidence and preserves zero-write authority.

## Operational constraints

- Node.js >=20.
- No new production deployment in this change.
- No changes to Scanner/Verifier/Canary authority.
- No raw CSV persisted in the invocation ledger.
- Existing `npm test` and `npm run check` must remain green before merge.
