# GPT-6 Shadow Runtime and Evaluation Plan — 2026-09-29

## Goal

Move KK Phone Rental from migration-readiness metadata to a **callable GPT-6 Sol shadow runtime** for Scanner and Verifier, while preserving zero production writes and the latest owner-visibility tombstone rules on `main`.

## Base

- base branch: `main`
- base SHA: `fc75d2d19f137f0071c2524d896d4c8510ec2faf`
- this base includes PR #312 persistent owner-hidden tombstone hardening
- predecessor PR #311 is stale against the new main and must not be used as the implementation base

## OpenAI API contract checked 2026-09-29

- target model: `gpt-6-sol`
- API: Responses API
- Scanner reasoning: `low`
- Verifier reasoning: `high`
- request storage: `store:false`
- structured result: Responses `text.format` with strict JSON Schema
- no model tools/function calls for shadow adjudication
- GPT-6 output remains advisory and cannot mutate KK state

## Safety invariants

- Scanner remains staging-only.
- Verifier shadow output is not a commit decision.
- Canary remains deterministic / zero-write.
- `18_Event_Visibility_Locks` tombstones remain authoritative for anti-recreate behavior.
- A model response cannot reopen `LOCKED`, recreate `SEEN_CORE`, or bypass existing identity.
- Shadow transport has no business-write tools and no notification tools.
- Missing enable flag, credential, valid workload, or valid structured output fails closed before any downstream effect.
- OpenAI response data is not stored by the API request (`store:false`).
- No production schedule or Machine-SOT mutation in this branch.

## Tasks

### 1. Rebase migration policy on current main
- restore model-migration policy as V2 on top of PR #312
- restore prompt hardening without overwriting tombstone rules
- expose shadow transport state through Agent Registry

### 2. Build GPT-6 Sol Responses shadow transport
- create `server/kk-gpt6-shadow-runtime.js`
- credential/feature-gated
- Node 20 built-in `fetch`; no new runtime dependency
- strict structured output
- bounded input size
- block obvious customer/booking PII payloads
- zero-write result contract
- no tools

### 3. Wire explicit gateway routes
- `scanner_gpt6_shadow`
- `verifier_gpt6_shadow`
- add `kk-gpt6-shadow-evaluator` as read-only/shadow agent
- task router calls transport only for these explicit routes
- no automatic invocation from live Scanner/Verifier schedules

### 4. Representative shadow evaluation
- add production-shaped fixture suite covering:
  - owner-hidden LOCKED
  - historical SEEN_CORE
  - exact duplicate identity
  - date/venue conflict
  - official cancellation conflict
  - multi-day completeness debt
  - missing competitor price
  - protected readback failure
- create deterministic evaluator and live CLI
- compare GPT-6 decision to policy-expected decision
- fail acceptance on authority violations, blocked cases, or mismatches

### 5. Zero-write acceptance
- prove disabled/missing-key paths make zero network calls
- prove successful shadow calls report zero production writes / publishes / notifications
- prove invalid model output fails closed
- prove no protected production entrypoint automatically calls the shadow route
- add CI guard with shadow feature disabled

### 6. Record evidence
- document RED→GREEN CI
- document whether live credential/runtime evidence exists
- do not mark `shadow_eval_passed` or `zero_write_acceptance_passed` from mocks alone
- keep production cutover blocked until real GPT-6 Sol execution is observed and accepted
