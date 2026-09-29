# CSV Analysis Agent — Implementation Report — 2026-09-29

## Status

Branch implementation is complete and regression-verified on `feature/csv-analysis-agent-20260929`.

The change is intentionally **not merged or production-released**. The repository engineering gate requires an independent reviewer and release readback for `ENGINEERING_ACCEPTED`. Those phases are not satisfied in this work session, so the PR remains draft and fail-closed.

No Scanner, Verifier, Canary, pricing, booking, inventory, storefront, Admin, Supabase, Apps Script, scheduler, or production write path was modified.

## Goal

Add a reusable analysis layer that accepts:

1. one CSV file; and
2. one natural-language analysis question;

then uses the OpenAI Agents API with an OpenAI-hosted isolated environment to investigate the data with Python and return verified downloadable artifacts:

- `report.pdf`
- `findings.json`
- optional `chart_*.png`
- `results.zip`

## Architecture

```text
Local Node CLI
  -> validate CSV + question
  -> <= 5 MiB: inline base64
     > 5 MiB and <= 50 MiB: OpenAI Files API
  -> Agents API session
  -> OpenAI-hosted sandbox
       network access: disabled
       Python: pandas / numpy / matplotlib / reportlab
       input: /workspace/input.csv
       outputs: /workspace/outputs/*
  -> require root-turn completion
  -> list same-turn artifacts only
  -> stage downloads in a temporary directory
  -> validate required files and payload signatures/schema
  -> copy verified outputs to the requested local directory
  -> best-effort remote session/input cleanup
```

The repo does not add the OpenAI npm SDK. Node 20 built-ins (`fetch`, `FormData`, `Blob`, filesystem APIs) are used to preserve the repository's dependency-minimization rule.

## Files changed

### `server/kk-csv-analysis-agent.js`

New analysis runtime.

Key behavior:

- validates Buffer input, non-empty CSV, max file size, question presence and question length before any network request;
- uses inline upload for CSV files up to 5 MiB;
- uses the OpenAI Files API for CSV files above 5 MiB and up to 50 MiB;
- creates an Agents API session with an OpenAI-hosted sandbox;
- disables sandbox network access;
- installs only the analysis packages requested in the session;
- treats all CSV cells/headers/text as untrusted data, never instructions;
- requires a completed **root** turn rather than assuming an idle/partial state is success;
- propagates session/environment/root-turn failures with explicit error codes;
- selects only artifacts from the completed root turn and only from `/workspace/outputs/`;
- rejects zero-byte and duplicate output artifacts;
- requires `report.pdf`, `findings.json`, and `results.zip`;
- validates the PDF signature;
- validates ZIP signature variants;
- parses and validates the `findings.json` contract;
- downloads to a temporary staging directory first;
- copies files to the requested output directory only after the whole required artifact set passes validation;
- returns explicit zero values for production/Scanner/Verifier/Canary writes;
- performs best-effort remote session and uploaded-input cleanup.

### `scripts/kk-csv-analysis-agent.js`

New dependency-free CLI.

Usage:

```bash
export OPENAI_API_KEY="<project-api-key>"

npm run csv:analyze -- \
  --csv ./sales.csv \
  --question "Which customer segments are driving revenue growth?" \
  --output ./analysis-output
```

Optional:

```text
--model <model>
--keep-session
--help
```

The CLI prints a JSON execution summary and artifact names. It does not print the API key.

### `tests/kk-csv-analysis-agent.test.js`

Adds regression coverage for:

- local validation before network access;
- oversize file rejection;
- inline-file session construction;
- sandbox network isolation;
- CSV prompt-injection boundary;
- Files API path for larger inputs;
- root-turn completion semantics;
- same-turn-only artifact selection;
- required artifact enforcement;
- fail-closed root-turn failure handling;
- `findings.json` schema validation;
- PDF and ZIP signature validation;
- no publication of invalid staged results;
- deterministic CLI argument parsing;
- package CLI wiring;
- explicit isolation from production `api/**`, `admin/**`, and `script.js` entrypoints.

### `package.json`

Additive changes only:

- adds `csv:analyze`;
- adds syntax checks for the new runtime, CLI, and regression test;
- adds no runtime dependency.

## Security / authority boundaries

### CSV prompt injection

The agent instructions explicitly state that CSV headers, cells, formula-like text, commands, links, and embedded prompts are data and must never be treated as instructions.

The hosted analysis environment has network access disabled, reducing exfiltration and arbitrary external-action risk.

### KK production authority

This component is deliberately not registered as a storefront/Admin/Scanner/Verifier/Canary route.

Regression coverage checks that production JavaScript entrypoints do not import `kk-csv-analysis-agent`.

The runtime result explicitly reports:

```json
{
  "production_writes": 0,
  "scanner_writes": 0,
  "verifier_writes": 0,
  "canary_writes": 0
}
```

The analysis agent therefore remains an analysis/advisory layer and does not gain Machine-SOT or business-write authority.

## Fail-closed artifact flow

A successful model turn alone is insufficient.

The local run is successful only after all of the following hold:

1. the root turn completed;
2. required same-turn artifacts exist;
3. required artifacts are non-empty;
4. `report.pdf` has a PDF signature;
5. `results.zip` has a ZIP signature;
6. `findings.json` parses and satisfies the required shape;
7. every selected artifact downloads successfully.

Downloads are staged first. Invalid staged outputs are not copied into the requested destination.

## TDD and regression evidence

### Contract RED

Commit: `f09bc1cad86e727a74f6c435edf3d89301d05184`

GitHub Actions run `36552022008`:

- syntax checks: PASS;
- regression suite: expected FAIL;
- 858 passed / 1 failed;
- failure: missing `server/kk-csv-analysis-agent.js`.

This proved the initial contract test could detect the absent feature.

### Core implementation first GREEN attempt

Commit: `ecbf7883158dce1524bacf2392519f32754672d2`

Run `36552378625` identified one test-harness error: a synchronous validator was asserted with `assert.rejects`.

The production behavior was correct. The test was corrected to `assert.throws`.

### Core GREEN

Commit: `8f71bf58ea85ae252c1b4590b68cfc6011cba1a9`

Run `36552605245`: PASS.

### Artifact-hardening RED

After fixing a fixture syntax mistake, run `36552943957` produced the intended RED:

- invalid findings schema: missing expected rejection;
- invalid PDF/ZIP signature: missing expected rejection.

This proved the new hardening tests detected missing validation.

### Artifact-hardening implementation

Commit: `dc76a0a4ce398fad436d8f33f6d9dc8df7369cdf`.

The validator worked, and its two new tests passed. One older large-file fixture then exposed an over-broad mocked `/artifacts` route that shadowed `/artifacts/{id}/content`. The fixture was corrected without changing production logic.

### Artifact-hardening GREEN

Commit: `d724349efacea328aaafdc384a4a7bd1f2f62dc7`

Run `36553246602`: PASS.

### CLI RED

Commit: `95ce3d62885fa30633634384a75f35468eb1c58d`

Run `36553371604`:

- exactly one regression failure;
- expected reason: `Cannot find module '../scripts/kk-csv-analysis-agent.js'`.

### Final CLI GREEN

CLI commit: `21482748b7b108964b5f887662a340d0acfd0fe8`

Package wiring commit: `4e419e3b55061e942769c479f75abffe7531a6fc`

GitHub Actions run `36553528502` / job `109357276607`:

- syntax checks: PASS;
- regression tests: PASS;
- Code Intelligence retrieval benchmark: PASS;
- HF benchmark harness safety check: PASS;
- HF fail-closed readiness check: PASS;
- total tests: **868**;
- passed: **868**;
- failed: **0**.

## Fallbacks used during implementation

The preferred Work-mode/local-repo execution path was not used after the handoff was declined.

The implementation therefore switched to the connected GitHub repository:

- isolated feature branch;
- draft pull request;
- GitHub Actions as the executable verification environment;
- TDD RED/GREEN evidence from workflow logs.

Two intermediate failures were investigated rather than papered over:

1. synchronous `assert.throws` vs `assert.rejects` test mismatch;
2. mocked artifact-list route shadowing the artifact-content route.

Neither was hidden as a successful run.

## Current limitations

### No live OpenAI paid-call acceptance in CI

The regression suite exercises the complete client state machine and fail-closed behavior with deterministic mocked HTTP/SSE responses.

A real OpenAI API call has **not** been made in this implementation session because no project API key was injected into the repository/CI, and no new paid credential or billing action was created implicitly.

Therefore the verified status is:

```text
LOCAL/CLIENT CONTRACT: VERIFIED
REPOSITORY REGRESSION: VERIFIED
LIVE OPENAI API ACCEPTANCE: NOT RUN
PRODUCTION RELEASE: NOT RUN
```

A live acceptance run requires an authorized `OPENAI_API_KEY` in the operator environment and a real CSV/question.

### Independent reviewer gate

The repository engineering gate requires:

```text
CONTEXT_PACK
PLANNER
IMPLEMENTER
INDEPENDENT_REVIEWER
TARGETED_TESTS
RISK_REGRESSION
RELEASE_READBACK
```

An independent Vercel Agent code review was considered, but it is a paid action and was not enabled implicitly.

The current branch must therefore **not** be labeled `ENGINEERING_ACCEPTED` and must **not** be merged solely on the implementer's self-review.

### Release readback

No production release was requested or performed, so release readback is intentionally absent.

## Improvement over the previous state

Before this change, the repository had no reusable CSV-question analysis path that could autonomously execute Python and publish a structured report bundle.

After this change, the branch has:

- a deterministic input contract;
- isolated Python execution through Agents API;
- automatic charts/report artifact contract;
- structured machine-readable findings;
- file-size-aware upload handling;
- prompt-injection boundary;
- network-disabled analysis sandbox;
- root-turn lifecycle handling;
- staged artifact validation;
- CLI invocation;
- full regression coverage;
- no added npm dependency;
- no expansion of KK production write authority.

## Pull request

Draft PR: #313 — `Add OpenAI CSV analysis agent`.

Keep it draft until the independent-review gate is satisfied. Do not merge as a substitute for live API acceptance or release readback.


## Final branch verification and preview state

After this report was first added, the branch HEAD was re-verified.

GitHub Actions run `36553910856` completed successfully on the documented branch state:

- syntax checks: PASS;
- regression tests: PASS;
- Code Intelligence retrieval benchmark: PASS;
- HF benchmark harness safety check: PASS;
- HF fail-closed readiness check: PASS.

The GitHub combined status also reports the Vercel check as **failure**, with the target resolving to the account's build-rate-limit / upgrade page. This is treated as a deployment-capacity blocker, not as evidence that the Node implementation or regression suite failed.

No workaround was used to bypass the Vercel account limit, and no production deployment was attempted. The PR remains draft.
