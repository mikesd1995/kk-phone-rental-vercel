# GPT-6 Sol Shadow Runtime — Implementation and Acceptance Report

Date: 2026-09-29  
Repository: `mikesd1995/kk-phone-rental-vercel`  
Base: `main@fc75d2d19f137f0071c2524d896d4c8510ec2faf`  
Branch: `feat/gpt6-shadow-runtime-20260929`  
Draft PR: #314

## Executive status

### Implementation
**PASS — shadow runtime is implemented and regression-covered.**

### Live GPT-6 execution acceptance
**NOT YET PROVEN / FAIL-CLOSED.**

No OpenAI API key was created or copied by this work. No paid OpenAI request was intentionally issued during CI or implementation. The repository can perform live shadow evaluation when an authorized `OPENAI_API_KEY` is provided and `KK_GPT6_SHADOW_ENABLED=true`.

### Production cutover
**BLOCKED BY DESIGN.**

The GPT-6 path is explicit shadow-only. It has no automatic Scanner/Verifier schedule wiring and no business-write tools. Production model cutover remains prohibited until all migration gates pass.

## Why this implementation was rebuilt on a new branch

The earlier migration-readiness branch/PR #311 was based on the previous main commit. During implementation, `main` advanced to PR #312, which introduced persistent owner-hidden event tombstones and anti-recreate protections.

Rather than force the stale migration branch forward and risk overwriting those new safety rules, the GPT-6 work was rebuilt from the new main SHA:

`fc75d2d19f137f0071c2524d896d4c8510ec2faf`

This preserves:

- `18_Event_Visibility_Locks`;
- `LOCKED` owner-hidden tombstones;
- `SEEN_CORE` historical identity;
- `REOPENED` explicit-owner semantics;
- no recreate under regenerated event IDs;
- Scanner staging-only authority;
- governed Verifier write/readback rules.

## OpenAI transport design

The new runtime is:

`server/kk-gpt6-shadow-runtime.js`

Version:

`KK_GPT6_SHADOW_RUNTIME_V1`

Transport contract:

- endpoint: `POST https://api.openai.com/v1/responses`;
- model: **`gpt-6-sol` only**;
- Scanner reasoning: `low`;
- Verifier reasoning: `high`;
- `store:false`;
- strict JSON Schema output through Responses `text.format`;
- no tools/functions supplied to the model;
- maximum serialized input: 64 KiB;
- timeout: 30 seconds by default;
- feature gate: `KK_GPT6_SHADOW_ENABLED=true`;
- credential: `OPENAI_API_KEY`.

The shadow transport uses Node 20 built-in `fetch`; it adds no OpenAI SDK/runtime dependency to this project.

## Model lock

The shadow runtime does not allow arbitrary model selection.

Allowed:

- Scanner → `gpt-6-sol`
- Verifier → `gpt-6-sol`

A caller or environment attempting to override the route to another model is rejected before network access with:

`BLOCKED_SHADOW_MODEL_NOT_ALLOWED`

This prevents silent drift from the evaluated model.

## Zero-write contract

Every shadow result is wrapped with immutable runtime invariants:

- `shadow_only=true`;
- `authoritative=false`;
- `production_writes=0`;
- `publishes=0`;
- `notification_sends=0`;
- `final_truth_mutation=false`.

The structured model output is also required to contain:

- `authority=SHADOW_ADVISORY_ONLY`;
- `production_writes=0`;
- `publishes=0`;
- `notification_sends=0`;
- `final_truth_mutation=false`.

If a provider response claims broader authority or any write/publish/send capability, the runtime returns:

`BLOCKED_SHADOW_OUTPUT_AUTHORITY_VIOLATION`

and discards the shadow decision.

Wrapper-level authority violations are also counted by the evaluation harness even when no valid model decision exists.

## Input safety and privacy boundary

The shadow runtime strips evaluator answer fields such as:

- `expected_decision`;
- `expected_decisions`;
- other keys beginning with `expected_`.

This prevents evaluation-answer leakage into the model prompt.

It also blocks known customer/booking/payment identity fields before the OpenAI network call, including customer identity, customer email/phone, LINE user identifiers, booking IDs, payment/deposit/card data, and common phone fields.

Public event identity data remains usable. A regression test explicitly verifies that venue address, artist name, and organizer metadata do not get blocked merely because they are event evidence.

## Role-specific prompt contract

### Scanner shadow

- staging-only;
- strongest positive state is `READY_FOR_VERIFIER`;
- never final business truth;
- `RECONCILE` for existing/historical event identity;
- `HOLD` for LOCKED owner-hidden state or unresolved conflict;
- cannot bypass Verifier.

### Verifier shadow

- advisory only;
- `ACCEPT` means the model considers the candidate sufficiently verified/policy-eligible for the existing governed next step;
- `ACCEPT` never performs a write;
- `HOLD` for unresolved conflicts, tombstones, completeness debt, or readback failure;
- `RECONCILE` for historical/existing identity that must not be recreated;
- `REJECT` for authoritative cancellation or clear ineligibility;
- final governed handoff still requires Machine SOT, identity, source, policy, write authorization, and readback.

## Migration policy V2

Created:

`server/kk-model-migration-policy.js`

Version:

`KK_MODEL_MIGRATION_POLICY_V2`

Current policy state:

- target family: `gpt-6`;
- default model: `gpt-6-sol`;
- API: Responses API;
- shadow transport wired: true;
- transport state: `SHADOW_WIRED_CREDENTIAL_GATED`;
- execution mode: `SHADOW_ONLY`;
- execution evidence: false;
- cutover allowed: false;
- production writes: 0.

Required production-readiness gates:

1. `prompt_audit_passed`
2. `shadow_transport_wired`
3. `credential_ready`
4. `shadow_eval_passed`
5. `zero_write_acceptance_passed`
6. `production_transport_approved`

Missing or undefined gates fail closed.

## Agent Gateway integration

Registry version was advanced to:

`KK_AGENT_REGISTRY_V19`

New agent:

`kk-gpt6-shadow-evaluator`

Authority:

`SHADOW_READ_ONLY_ADVISORY`

New explicit routes:

- `scanner_gpt6_shadow`
- `verifier_gpt6_shadow`

They are callable only when explicitly requested through the existing Agent Gateway/Task Router.

They are **not** automatically inserted into:

- Scanner schedules;
- Verifier schedules;
- storefront promotion;
- booking;
- pricing;
- inventory;
- owner visibility;
- Machine-SOT write paths.

The Task Router was advanced to `KK_AGENT_TASK_ROUTER_V13`.

## Representative shadow evaluation

Created:

- `server/kk-gpt6-shadow-eval.js`
- `config/kk-gpt6-shadow-eval-cases.json`

Evaluation version:

`KK_GPT6_SHADOW_EVAL_V1`

Eight required scenarios are checked:

| Scenario | Expected shadow decision |
| --- | --- |
| Owner-hidden LOCKED | HOLD |
| Historical SEEN_CORE without current Core row | RECONCILE |
| Duplicate identity | RECONCILE |
| Date/venue source conflict | HOLD |
| Official cancellation vs lower-tier active claim | REJECT |
| Multi-day completeness debt | HOLD |
| Eligible event with no exact competitor price but approved fallback | ACCEPT |
| Protected readback mismatch | HOLD |

Expected answers remain evaluator-side and are never sent in model input.

A suite passes only if all cases:

- return a usable shadow decision;
- match the policy-expected decision;
- have zero authority violations;
- have zero writes/publishes/notifications.

Mock/provider failures cannot be counted as live shadow acceptance.

## Live acceptance CLIs

Three explicit commands were added:

`npm run gpt6:shadow:readiness`

No network call. Reports feature/credential readiness.

`npm run gpt6:shadow:eval`

Runs the 8-case representative suite against the real configured GPT-6 Sol transport. Exits nonzero unless every case passes.

`npm run gpt6:shadow:zero-write`

Runs two synthetic live transport cases and requires real response IDs plus zero-write invariants.

These commands do not run in normal CI with a live key.

## CI safety

The normal Admin Regression workflow gained a dedicated guard:

**GPT-6 shadow remains disabled and zero-write in CI**

CI explicitly sets:

`KK_GPT6_SHADOW_ENABLED=false`

and requires:

- status = `SHADOW_DISABLED`;
- network calls = 0;
- production writes = 0;
- final truth mutation = false.

Therefore ordinary PR CI cannot silently spend OpenAI credits or activate GPT-6.

## Code Intelligence

A dedicated `gpt6_shadow` route was added to:

`config/kk-code-context-routes.json`

It prioritizes the migration policy, shadow runtime, evaluator, registry/router, and their targeted tests.

During implementation, adding the new runtime exposed an existing Code Intelligence weakness: multiple route files had identical scores, so alphabetical/dependency ordering could push the primary Operating Partner implementation out of a bounded context pack.

The fix changed route-file scoring to preserve the declared file order with a small deterministic priority decrement. The global context/token budget was **not increased**.

This fixes the root cause without making every task more expensive.

## TDD and regression evidence

### RED — missing implementation

Admin Regression #949:

- syntax: PASS;
- regression: expected FAIL;
- failure reason: missing migration/shadow/eval modules.

### Implementation regression discovered

Admin Regression #967:

- GPT-6 implementation was present;
- one existing Operating Partner Code Intelligence test failed because new dependency/context candidates displaced its primary file.

Resolution:

- preserve declared route file priority;
- do not increase global context budget.

### GREEN after context fix

Admin Regression #970:

- syntax: PASS;
- full regression: PASS;
- Code Intelligence benchmark: PASS;
- HF safety: PASS;
- HF fail-closed readiness: PASS;
- GPT-6 disabled/zero-write CI guard: PASS.

### RED — model drift guard

Admin Regression #972:

- expected-answer leakage test: PASS;
- model-override rejection test: expected FAIL.

This demonstrated that caller-controlled model override had not yet been blocked.

### GREEN — model locked

Admin Regression #975:

- syntax: PASS;
- full regression: PASS;
- Code Intelligence benchmark: PASS;
- HF safety: PASS;
- HF fail-closed readiness: PASS;
- GPT-6 disabled/zero-write CI guard: PASS.

Subsequent hardening added:

- dedicated GPT-6 Code Intelligence route;
- public-event-field false-positive regression;
- wrapper-level authority violation accounting;
- Verifier `ACCEPT` semantics.

Final post-hardening workflow evidence must remain green before this PR is considered implementation-ready.

## Vercel state

This branch may trigger ordinary Vercel Preview attempts through repository integration.

At review time, Vercel reported a Preview status failure pointing to the account build-rate-limit/upgrade surface. This is not treated as application-code acceptance evidence.

No production deployment or production cutover is authorized by this work.

## OpenAI Platform credential state

The connected OpenAI Platform account exposes an available Personal organization / Default project as an API-key creation target.

This work did **not** create a key.

Reasons:

- a live API call can incur usage cost;
- the project goal favors zero/low-cost operation;
- mock/CI evidence must not be misrepresented as real GPT-6 execution.

Therefore the current live gates remain fail-closed until the owner deliberately authorizes a project API key and actual shadow requests.

## Current migration gates

| Gate | State |
| --- | --- |
| Repository prompt audit | PASS |
| GPT-6 shadow transport wired | PASS |
| Credential ready | NOT PROVEN / no key created |
| Representative live GPT-6 shadow eval | NOT RUN |
| Live zero-write acceptance | NOT RUN |
| Production transport approved | NO |
| Production cutover | BLOCKED |

## How to run the remaining live gates

After an authorized API key is available in the execution environment:

```bash
KK_GPT6_SHADOW_ENABLED=true OPENAI_API_KEY=*** npm run gpt6:shadow:eval
```

Then:

```bash
KK_GPT6_SHADOW_ENABLED=true OPENAI_API_KEY=*** npm run gpt6:shadow:zero-write
```

Never commit the key, print it, or persist it in test artifacts.

A live PASS must include actual OpenAI response IDs and all zero-write invariants.

## What improved compared with the previous state

Before this work:

- migration was policy/readiness only;
- Scanner/Verifier had no GPT-6 API transport;
- no representative model eval existed;
- no live zero-write acceptance harness existed.

After this work:

- GPT-6 Sol Responses shadow transport exists;
- model is locked to the evaluated target;
- Scanner and Verifier have distinct reasoning/decision semantics;
- tombstone authority is embedded in the model contract;
- strict structured outputs prevent free-form authority creep;
- expected eval answers cannot leak into prompts;
- customer/business PII fields are blocked before transport;
- explicit gateway routes are ledgered;
- 8 policy-shaped eval cases are checked;
- live zero-write acceptance is executable;
- normal CI cannot make live OpenAI calls;
- Code Intelligence has a dedicated bounded GPT-6 route;
- production cutover remains independently gated.

## Remaining action

Do **not** merge this as proof that GPT-6 is live.

The next external dependency is an owner-authorized OpenAI project key plus explicit permission to incur the small live-eval API usage. After that, run the representative eval and zero-write acceptance. Only if both pass should production transport design/cutover be considered.
