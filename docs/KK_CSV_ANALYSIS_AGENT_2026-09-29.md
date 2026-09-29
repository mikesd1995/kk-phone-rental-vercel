# KK CSV Analysis Agent — Implementation Report

Date: 2026-09-29  
Branch: `feat/csv-analysis-agent-20260929`  
Draft PR: #310  
Production deployment: **not performed**

## Executive status

A governed CSV analysis subsystem has been implemented inside the existing KK Phone Rental agent architecture rather than as a disconnected demo.

The subsystem now accepts a CSV payload plus a user question, validates the request, routes the task through the existing Agent Gateway and append-only invocation evidence path, executes the preferred OpenAI Agents API analysis path when credentials are available, verifies the report artifact contract, and returns downloadable artifact access metadata.

If the remote Agents API path cannot run and the caller explicitly permits fallback, the subsystem produces a deterministic degraded analysis with real PDF, JSON, and ZIP bytes. The fallback is visibly labeled and never claims that OpenAI-hosted reasoning ran.

All business-write authority remains zero.

## What changed

### 1. Request and artifact contract

Added `server/kk-csv-analysis-contract.js`.

It enforces:

- question required;
- question length capped at 4,000 characters;
- filename must use `.csv`;
- strict/canonical base64 validation;
- empty payload rejection;
- embedded null-byte rejection;
- default decoded payload limit of 50 MiB;
- structured `findings.json` validation;
- required logical artifacts:
  - `report.pdf`
  - `findings.json`
  - `results.zip`
- optional charts must use `chart_XX.png`.

The normalized request retains CSV bytes but never creates a `csv_text` instruction field.

### 2. Governed analysis service

Added `server/kk-csv-analysis-agent.js`.

Responsibilities:

- owns prompt/instruction boundary;
- treats CSV headers, cells, formulas, comments, and embedded text as untrusted data;
- references the CSV by sandbox path instead of injecting raw CSV into instructions;
- validates remote/fallback engine results;
- fails closed on missing/invalid artifacts;
- rejects any engine result that reports non-zero production writes or publishing;
- allows fallback only when `allow_fallback === true`;
- preserves artifact access metadata needed for downloads.

Successful result schema:

`KK_CSV_ANALYSIS_RESULT_V1`

### 3. OpenAI Agents API adapter

Added `server/kk-openai-agents-adapter.js`.

Preferred execution path:

- OpenAI Agents API;
- OpenAI-hosted sandbox;
- network disabled inside the sandbox;
- CSV mounted as `/workspace/input.csv`;
- Python analysis packages requested:
  - pandas
  - numpy
  - matplotlib
  - reportlab;
- final agent outputs restricted to `/workspace/outputs`;
- root session/turn completion required;
- artifacts filtered to the completed root turn;
- empty artifacts rejected;
- `findings.json` downloaded and parsed before READY;
- artifact handles include session ID, turn ID, artifact ID, path, and size.

Default model:

`gpt-6-sol`

Override:

`KK_CSV_ANALYSIS_MODEL`

### 4. Node 20-compatible REST transport

The original implementation direction was to add the current OpenAI Node SDK. That was not used after verification showed that the current OpenAI Node SDK v7.23.0 requires Node >=22, while this repository and CI intentionally use Node >=20.

Instead, the adapter now uses the official Agents REST endpoints through Node 20's native `fetch`:

- `POST /v1/agents/sessions`
- `GET /v1/agents/sessions/{session_id}/artifacts`
- `GET /v1/agents/sessions/{session_id}/artifacts/{artifact_id}/content`
- `POST /v1/files` for large CSV input.

It sends:

`OpenAI-Beta: agents=v1`

This avoided a repository-wide Node runtime upgrade and avoided adding an incompatible dependency.

No `openai` npm package was added.

### 5. Large-file path

CSV files up to 5 MiB use inline base64 sandbox input.

Above 5 MiB, the Node-native REST transport uploads the CSV through the Files API and supplies the resulting file ID to the hosted environment.

The local contract rejects CSV input above 50 MiB.

### 6. Deterministic degraded fallback

Added `server/kk-csv-analysis-fallback.js`.

Fallback behavior:

- no network calls;
- deterministic CSV parsing;
- basic numeric profiling;
- explicit degraded-mode caveats;
- `engine_mode: "fallback"`;
- never impersonates an OpenAI Agents run;
- creates real artifact payloads:
  - valid PDF bytes;
  - UTF-8 findings JSON;
  - ZIP containing `report.pdf` and `findings.json`;
- exposes them as base64 for a caller to save/download;
- production writes = 0;
- publishes = 0.

Fallback is intentionally descriptive. It is not represented as equivalent to full model-directed investigation.

### 7. Downloadability

Remote mode:

- `artifact_transport: "openai_agents_artifacts"`
- returns `artifact_handles`;
- `downloadOpenAIAgentArtifact()` retrieves immutable artifact bytes.

Fallback mode:

- `artifact_transport: "inline_base64"`
- returns `artifact_payloads_base64`.

This closes the gap between merely returning artifact filenames and actually providing a retrieval path.

### 8. Agent Gateway integration

Updated `server/kk-agent-registry.js`:

New agent:

`kk-csv-analysis`

Authority:

`READ_ONLY_ANALYSIS`

New route:

`analyze_csv`

Route ID:

`CSV_ANALYSIS_REPORT`

Request type:

`CSV_ANALYSIS`

Properties:

- runtime available;
- owner review not required for read-only analysis;
- persistent invocation evidence required;
- no downstream agents;
- production-write authority 0.

Registry version moved from V18 to V19.

Updated `server/kk-agent-task-router.js`:

- task-router version moved from V12 to V13;
- `analyze_csv` dispatches only through `kk-csv-analysis`;
- supports injected remote/fallback implementations for testing;
- reuses the existing generic Agent Gateway and orchestration ledger path.

`server/kk-agent-gateway.js` required no runtime modification. Existing generic policy/ledger behavior already supported the route correctly.

### 9. Invocation evidence and privacy

Gateway integration was explicitly tested to confirm:

- required agent invocation evidence is enforced;
- missing `kk-csv-analysis` invocation is blocked;
- ledger record contains request/output hashes and metadata, not raw CSV payload;
- raw `csv_base64` is not persisted in the invocation ledger;
- result remains zero-write and zero-publish.

### 10. Dry-run acceptance harness

Added:

`scripts/kk-csv-analysis-dry-run.js`

It:

- creates a representative CSV fixture;
- includes prompt-like malicious cell content;
- deliberately disables remote execution;
- exercises the governed fallback path;
- writes:
  - `report.pdf`
  - `findings.json`
  - `results.zip`;
- re-reads artifacts;
- checks PDF/ZIP signatures;
- parses findings JSON;
- records `network_calls: 0`.

Package script:

`npm run csv:analysis:dry-run`

The same dry-run core is executed by the regression tests.

### 11. Syntax-check wiring

`npm run check` now includes:

- `server/kk-csv-analysis-contract.js`
- `server/kk-csv-analysis-agent.js`
- `server/kk-csv-analysis-fallback.js`
- `server/kk-openai-agents-adapter.js`
- `scripts/kk-csv-analysis-dry-run.js`

## Gateway request example

```json
{
  "task_type": "analyze_csv",
  "input": {
    "question": "Which segments are driving revenue growth?",
    "filename": "sales.csv",
    "csv_base64": "<base64>",
    "allow_fallback": true
  }
}
```

## Environment configuration

Required for real remote Agents API execution:

`OPENAI_API_KEY`

Optional:

- `KK_CSV_ANALYSIS_MODEL` — defaults to `gpt-6-sol`;
- `OPENAI_BASE_URL` — defaults to `https://api.openai.com/v1`.

The API key must remain server-side and outside the hosted analysis sandbox.

## Fail-closed blockers

Representative blocker codes:

- `CSV_BASE64_INVALID`
- `CSV_FILENAME_INVALID`
- `CSV_QUESTION_REQUIRED`
- `CSV_QUESTION_TOO_LONG`
- `CSV_PAYLOAD_EMPTY`
- `CSV_PAYLOAD_NULL_BYTE`
- `CSV_PAYLOAD_TOO_LARGE`
- `FINDINGS_SCHEMA_INVALID`
- `ANALYSIS_ARTIFACTS_INCOMPLETE`
- `ANALYSIS_ARTIFACT_EMPTY`
- `ANALYSIS_ENGINE_NONZERO_SIDE_EFFECT`
- `OPENAI_API_KEY_MISSING`
- `OPENAI_AGENT_TURN_FAILED`
- `OPENAI_AGENT_ROOT_TURN_INCOMPLETE`
- `OPENAI_ARTIFACT_HANDLE_INVALID`.

## TDD / CI evidence

Implementation followed test-first RED → GREEN gates through the repository's `Admin Regression` GitHub Action.

### Contract

- RED: run #915 — contract functions intentionally absent.
- GREEN: run #916 — contract implementation passed all regression gates.

### Service and fallback

- RED: run #918 — service/fallback functions intentionally absent.
- GREEN: run #921 — orchestration/fallback policy passed.

### OpenAI adapter

- RED: run #923 — adapter function intentionally absent.
- GREEN: run #925 — hosted-session/artifact adapter behavior passed using injected fake client; no paid API call.

### Gateway integration

- RED: run #928 — registry/task route intentionally absent.
- First GREEN attempt exposed two unrelated-but-real regression assumptions:
  - tests still pinned registry V18;
  - Code Intelligence context budget crossed its 12,000-token ceiling by about eight estimated tokens after registry growth, causing the Operating Partner primary file to be evicted.
- Root fix:
  - update intentional registry-version expectations to V19;
  - shorten only the newly added CSV agent metadata note so Code Intelligence stays inside its existing budget without changing runtime logic.
- GREEN: run #933 — gateway, regression suite, Code Intelligence benchmark, and HF safety/readiness gates all passed.

### Downloadability

- RED: run #934 — logical artifact names existed but fallback bytes/service access metadata/download helper did not.
- GREEN: run #936 — real fallback artifacts and remote artifact access path passed.

### Node 20 REST transport and dry run

- RED: run #938 — default path still expected SDK, dry-run/package wiring absent.
- Implemented native REST/SSE transport and dry-run wiring.
- A Vercel preview then exposed a malformed `package.json` trailing literal `\\n` introduced by the repository write operation. The exact Vercel error was:
  - `Unexpected non-whitespace character after JSON at position 6726`.
- Corrected the file to use an actual newline.
- Latest GitHub acceptance: run #945 — **all steps passed**:
  - syntax checks;
  - full regression tests;
  - Code Intelligence retrieval benchmark;
  - HF benchmark harness safety check;
  - HF fail-closed readiness check.

## Vercel status

No production deployment was performed.

The initial preview for the package-wiring commit correctly surfaced the malformed JSON and was used as diagnostic evidence.

After the package JSON fix, Vercel did not create a usable fresh preview because the account hit its build-rate limit. Current Vercel status points to:

`upgradeToPro=build-rate-limit`

Therefore preview deployment is **blocked by platform quota**, not treated as a successful application acceptance.

GitHub CI and the zero-network dry-run remain the verified acceptance surfaces for this branch.

## Test coverage added

`tests/kk-csv-analysis-agent.test.js` covers:

- request contract exports;
- valid request normalization;
- invalid base64;
- wrong extension;
- missing/oversized question;
- empty CSV;
- null byte;
- max byte limit;
- findings schema;
- artifact manifest;
- prompt-injection boundary;
- fallback labeling;
- remote failure/fallback policy;
- zero-write enforcement;
- partial output fail-closed behavior;
- hosted sandbox configuration;
- root-turn binding;
- missing artifacts;
- turn failure;
- registry route;
- task-router invocation;
- gateway ledger privacy;
- required-agent enforcement;
- real fallback PDF/JSON/ZIP payloads;
- remote artifact-handle preservation;
- fallback payload preservation;
- artifact download helper;
- Node20 native REST/SSE transport;
- dry-run artifact materialization;
- package/check wiring.

## Files added

- `server/kk-csv-analysis-contract.js`
- `server/kk-csv-analysis-agent.js`
- `server/kk-csv-analysis-fallback.js`
- `server/kk-openai-agents-adapter.js`
- `scripts/kk-csv-analysis-dry-run.js`
- `tests/kk-csv-analysis-agent.test.js`
- `docs/superpowers/specs/2026-09-29-kk-csv-analysis-agent-design.md`
- `docs/superpowers/plans/2026-09-29-kk-csv-analysis-agent.md`
- `docs/KK_CSV_ANALYSIS_AGENT_2026-09-29.md` (this report)

## Files modified

- `server/kk-agent-registry.js`
- `server/kk-agent-task-router.js`
- `package.json`
- `tests/kk-agent-gateway.test.js`
- `tests/kk-operating-partner.test.js`
- `tests/kk-ultra-deep-v3.test.js`

No production business-data writer was modified.

## How this is better than before

Before this change, KK had agent governance, Scanner/Verifier workflows, reliability tooling, and analytical code, but did not have one governed route that could accept an arbitrary CSV + question and return a verified downloadable analysis package.

After this change:

1. CSV analysis is a first-class governed agent route.
2. The model is given the file as data instead of interpolated cell text as instructions.
3. Numerical work can execute in a hosted Python sandbox.
4. Required outputs are contract-checked before READY.
5. Partial/empty artifacts fail closed.
6. Download access survives normalization.
7. The invocation is auditable through the existing ledger.
8. Raw CSV is not persisted in that ledger.
9. Remote failure can degrade deliberately instead of silently failing.
10. Fallback still produces real downloadable artifacts.
11. No Scanner/Verifier/Canary authority was expanded.
12. No new npm dependency or Node runtime migration was introduced.

## Remaining limitations / next gates

### 1. Live OpenAI API acceptance has not been executed

CI uses an injected/fake HTTP transport to verify the exact REST/session/artifact behavior without consuming API credits or requiring a repository secret.

A true remote acceptance requires a server-side `OPENAI_API_KEY` with:

- `api.agents.read`
- `api.agents.write`
- `api.responses.write`.

Until that credential is deliberately configured, the full hosted Python path is implemented and contract-tested but not live-credential accepted.

### 2. Fallback is deliberately limited

Fallback is deterministic descriptive analysis. It does not claim to answer complex causal/statistical questions at the same level as the remote agent.

### 3. Fallback charts

Fallback currently produces no chart PNGs. Charts remain optional by contract and are expected from the full hosted-agent path when useful.

### 4. Fallback PDF character set

The dependency-free fallback PDF uses a basic built-in PDF font and transliterates unsupported non-ASCII glyphs to `?` in the PDF body. The UTF-8 `findings.json` remains intact.

This can be upgraded later if Thai/multilingual PDF rendering in degraded mode becomes a requirement.

### 5. Frontend/API download surface

The service now returns either immutable OpenAI artifact handles or inline fallback payloads, which is sufficient for an API/UI layer to expose downloads. A dedicated storefront/admin UI for uploading CSVs and clicking Download was intentionally not added in this branch.

## Production safety conclusion

This branch remains read-only with respect to KK business truth:

- production writes: 0
- publishes: 0
- storefront mutations: 0
- booking mutations: 0
- pricing mutations: 0
- Scanner/Verifier state mutations: 0

The implementation is kept in Draft PR #310 and is not merged or promoted to production.
