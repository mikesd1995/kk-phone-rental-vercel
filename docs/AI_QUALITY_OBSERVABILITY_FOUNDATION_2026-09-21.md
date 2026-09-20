# AI Quality + Observability Foundation — 2026-09-21

## Executive result

Status: **IMPLEMENTED ON REVIEW BRANCH / ZERO PRODUCTION ACTIVATION**

Branch: `ai-quality-observability-foundation-20260921`  
Baseline main: `d1912f9f3fa9602fc793976cd530eec479788cd2`

This change adds a safe quality/observability foundation around the existing Discovery Mesh without creating a second Scanner, scheduler, writer, or production AI authority.

## Why this work now

The repository already contains:

- Discovery Source Watch authority contract;
- Exa controlled discovery UAT;
- Crawl4AI zero-write extraction UAT;
- Hugging Face Event Assist guarded work on separate PRs;
- Scanner -> staging -> Verifier authority rules.

The missing layer was repeatable AI behavior evaluation, privacy-safe trace envelopes, and a deterministic shadow dedup baseline.

Because Control Plane natural persistence remains a P0 acceptance gate, this branch does **not** move orchestration to DBOS, LangGraph, Pydantic AI, CrewAI, AutoGen, or another scheduler.

## Changes made

### 1. AI observability contract

Added:

`server/ai-observability-contract.js`

Contract version:

`kk-ai-observability-v1`

Purpose:

- provide a provider-neutral trace envelope that can later feed Langfuse or OpenTelemetry;
- keep observability disabled unless an explicit sender is injected;
- reject PII/raw prompt-style fields instead of silently exporting them;
- allow only bounded metadata such as run ID, component, provider, latency, token counts, model, error code and confidence;
- force every trace envelope to remain:
  - `authoritative=false`;
  - `production_writes=0`;
  - `final_truth_mutation=false`;
  - `notification_sends=0`.

No Langfuse credential, endpoint, SDK, exporter or production telemetry call is added.

### 2. Zero-write event dedup shadow scorer

Added:

`server/event-dedup-shadow.js`

Contract version:

`kk-event-dedup-shadow-v1`

It produces advisory dispositions:

- `LIKELY_DUPLICATE`
- `POSSIBLE_DUPLICATE`
- `DISTINCT`
- `DISTINCT_HARD_DATE`

Hard safety behavior:

- different explicit event dates are treated as a hard distinct boundary;
- name similarity alone cannot merge an event;
- output always remains `authoritative=false`, `verifier_required=true`, `production_writes=0`;
- no Sheet/Event Tracker/Admin write path imports this scorer.

This provides a deterministic baseline before evaluating Splink or another probabilistic entity-resolution service in a separate shadow job.

### 3. Promptfoo staging evaluation harness

Added:

- `promptfooconfig.yaml`
- `evals/event-intelligence-prompt.txt`
- `evals/event-intelligence-tests.yaml`
- `evals/providers/kk-staging-provider.js`
- `evals/README.md`

Provider safety:

- explicit `KK_EVAL_ENDPOINT` required;
- missing endpoint -> fail closed;
- non-HTTPS remote endpoint -> blocked;
- production-looking endpoint -> blocked;
- request carries `EVAL_ONLY` and zero-authority flags;
- no API key is stored in git;
- no scheduled or CI model calls were added.

Promptfoo remains a manual/staging evaluation tool, not a production runtime dependency.

### 4. Versionable event-intelligence gold dataset

Added:

`evals/fixtures/event-intelligence-gold.jsonl`

Initial fixture set covers:

- clear event extraction;
- same-date title variants;
- different-date hard boundary;
- source conflict;
- incomplete social signal;
- missing-date duplicate uncertainty;
- non-event content;
- non-authority safety invariants.

The JSONL format is intentionally compatible with later Hugging Face Datasets ingestion, but no dataset is uploaded externally in this change.

### 5. Gold-fixture safety validator

Added:

`scripts/validate-ai-quality-fixtures.js`

It enforces:

- unique fixture IDs;
- minimum fixture count;
- required input/expected shapes;
- `authoritative=false`;
- `verifier_required=true`;
- `production_writes=0`;
- optional final-truth/notification fields remain zero/false;
- obvious sensitive-key patterns are rejected.

Added npm command:

`npm run validate:ai-quality`

The validator is also chained into `npm run check` so the existing Admin Regression workflow exercises it on PRs.

### 6. Regression tests

Added:

- `tests/ai-observability-contract.test.js`
- `tests/event-dedup-shadow.test.js`
- `tests/kk-staging-provider.test.js`

Coverage includes:

- telemetry disabled -> zero sender calls;
- telemetry enabled -> explicit sender required;
- PII/raw prompt attributes rejected;
- business authority/write attributes rejected;
- duplicate advisory outputs remain zero-write;
- different dates cannot be merged by similarity;
- Promptfoo provider fails closed without endpoint;
- insecure endpoint blocked;
- production-looking endpoint blocked before fetch;
- staging requests carry explicit zero-authority envelope.

## Expected improvement

### Before

Discovery quality depended mainly on provider-specific UAT and repository safety contracts. A prompt/model change could regress extraction or dedup behavior without a reusable gold dataset. Observability integration had no bounded PII-safe envelope. Semantic dedup had no deterministic shadow baseline in the Node runtime.

### After this branch

The project gains:

1. **repeatable AI behavior fixtures**;
2. **CI-enforced fixture safety invariants**;
3. **manual Promptfoo regression harness**;
4. **privacy-minimized trace contract prepared for Langfuse/OpenTelemetry**;
5. **deterministic dedup shadow signal before probabilistic tooling**;
6. **no new production authority or scheduler**.

## External-tool status after this change

| Tool | State | Production authority |
| --- | --- | --- |
| Langfuse | Adapter contract prepared; sink not connected | None |
| OpenTelemetry | Adapter contract prepared; exporter not connected | None |
| Promptfoo | Staging/manual harness added | None |
| Hugging Face Datasets | JSONL gold dataset prepared; not uploaded | None |
| Splink | Not installed; shadow baseline prepared for later comparison | None |
| Exa | Existing controlled/manual discovery path unchanged | None |
| Crawl4AI | Existing zero-write UAT unchanged | None |
| HF Event Assist | Existing production OFF state unchanged | None |
| DBOS/Pydantic AI/LangGraph | Not introduced | None |

## Production surfaces intentionally unchanged

```text
Scanner task state = unchanged
Verifier task state = unchanged
Canary task state = unchanged
Machine SOT = unchanged
Apps Script source/deployment = unchanged
Make scenarios = unchanged
Booking/business rows = 0 writes
Event Tracker rows = 0 writes
Pricing = unchanged
Inventory = unchanged
Customer data = unchanged
Notification sends = 0
HF production activation = OFF
Langfuse production export = OFF
OpenTelemetry production export = OFF
Promptfoo scheduled model calls = OFF
Splink production integration = OFF
Production Vercel promotion = 0
```

## Rollout gates for the next step

### Langfuse / OpenTelemetry sink

Require a separate change that proves:

1. exact endpoint identity;
2. secret storage outside git;
3. retention policy;
4. PII field review;
5. disabled-by-default feature gate;
6. bounded failure behavior (telemetry outage cannot block business runtime);
7. zero business writes;
8. cost/latency measurement;
9. rollback by one feature flag.

### Promptfoo model evaluation

Before counting an eval result as acceptance:

1. use only an approved staging/eval endpoint;
2. pin the provider/model version;
3. capture dataset checksum;
4. record prompt version;
5. record pass/fail by fixture;
6. do not use the production Scanner dispatch or Admin write path;
7. do not convert eval output into final event truth.

### Splink evaluation

Run as an isolated Python/shadow comparison only after:

1. export contains event/candidate data only;
2. no customer/booking PII;
3. same gold fixture set is used;
4. false merge rate is measured;
5. separate-day/show hard boundaries are preserved;
6. Verifier remains the final authority.

## Classification

```text
AI_QUALITY_FOUNDATION = IMPLEMENTED_ON_REVIEW_BRANCH
PROMPTFOO_HARNESS = IMPLEMENTED / STAGING_ONLY
GOLD_DATASET = IMPLEMENTED / LOCAL_REPO_ONLY
OBSERVABILITY_CONTRACT = IMPLEMENTED / EXPORT_DISABLED
DEDUP_SHADOW_BASELINE = IMPLEMENTED / ZERO_WRITE
LANGFUSE_RUNTIME = OFF
OTEL_RUNTIME = OFF
SPLINK_RUNTIME = OFF
PRODUCTION_WRITES = 0
PRODUCTION_DEPLOYMENT = 0
```
