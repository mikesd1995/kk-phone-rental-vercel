# GPT-6 Migration Readiness — 2026-09-29

## Status

**Implementation readiness: PASS (shadow-only).**  
**Production GPT-6 cutover: BLOCKED BY DESIGN / NOT YET AUTHORIZED.**

This work prepares KK Phone Rental for a controlled migration to the GPT-6 family without claiming that GPT-6 is already executing in production.

Base branch at start:

- repository: `mikesd1995/kk-phone-rental-vercel`
- base: `main`
- base SHA: `d12da3aee5cd9f6905aa102f0804b3d56cfb4717`
- migration branch: `feat/gpt6-migration-readiness-20260929`
- draft PR: #311

## Runtime inventory findings

### Repository

The repository was searched for:

- `OpenAI`
- `api.openai.com`
- `responses.create`
- `chat.completions`
- `OPENAI`
- OpenAI model IDs / model environment variables

No OpenAI SDK/API invocation or OpenAI dependency was found on `main` at the audited base SHA.

`package.json` has no OpenAI client dependency. The KK Agent Gateway and orchestration layers are deterministic governance/evidence components; they do not currently invoke an OpenAI model directly.

Consequences:

1. There is no existing OpenAI API transport to safely switch from GPT-5.6 to GPT-6 by changing a model string.
2. Adding a new Responses API transport during a model migration would be an architecture change, not a simple model migration.
3. The safe migration path is therefore prompt/runtime readiness + representative shadow evaluation first.
4. A Responses API transport should be introduced only deliberately, with its own authentication, telemetry, evaluation, rollback, and zero-write acceptance gates.

### Vercel

At the audit snapshot, Vercel Agent Runs for the KK project in production over the previous 7 days returned zero runs.

This supports the repository finding that Vercel Agent Runs are not the active model-execution surface for the current Scanner/Verifier control plane.

### ChatGPT scheduled control plane

The current Scanner/Verifier workflow is primarily driven by ChatGPT scheduled-task prompts plus Machine-SOT governance outside this repository.

The available task-control interface does not expose a per-task model ID. Therefore:

- the model used by scheduled Scanner/Verifier occurrences is **not proven** by repository configuration;
- this migration does not claim a scheduled-task model cutover;
- no Scanner/Verifier/Canary schedule or task state was changed by this branch.

## Target model policy

Based on the current KK workload shape and current OpenAI GPT-6 model family:

| Workload | Primary | Reasoning | Escalation |
| --- | --- | --- | --- |
| Scanner | `gpt-6-sol` | low | none |
| Verifier | `gpt-6-sol` | high | `gpt-6-astra` / xhigh |
| High-volume bounded classification | `gpt-6-luna` | low | `gpt-6-sol` / medium |
| Content | `gpt-6-sol` | medium | none |
| Code repair | `gpt-6-sol` | high | `gpt-6-astra` / xhigh |
| Canary | deterministic / no LLM | n/a | none |

Default migration target: **GPT-6 Sol**.

Rationale:

- preserves the current Sol workload role instead of silently escalating every task to the highest-cost model;
- keeps Luna available for high-volume bounded work;
- reserves Astra for hard evidence conflicts, complex debugging, and exceptional escalation;
- preserves deterministic Canary behavior instead of creating unnecessary model dependence.

If/when an OpenAI API transport is intentionally added, the declared API preference is Responses API. This field is migration intent only; it is not execution evidence.

## New migration policy

Created:

- `server/kk-model-migration-policy.js`

Policy version:

- `KK_MODEL_MIGRATION_POLICY_V1`

The module exposes:

- `routingForWorkload(name)`
- `migrationReadiness(evidence)`
- `publicPolicy()`

Current public state is deliberately fail-closed:

- `target_family = gpt-6`
- `default_model = gpt-6-sol`
- `transport_state = NOT_WIRED`
- `execution_mode = SHADOW_ONLY`
- `execution_evidence = false`
- `cutover_allowed = false`
- `production_writes = 0`

Required cutover gates:

1. `transport_wired`
2. `prompt_audit_passed`
3. `shadow_eval_passed`
4. `zero_write_acceptance_passed`

Every gate must be explicitly true. Missing or undefined evidence fails closed.

## Agent Registry integration

`server/kk-agent-registry.js` now exposes:

`publicRegistry().model_migration`

This is metadata only.

The change does **not** alter:

- `REGISTRY_VERSION`;
- route identities;
- `runtime_available`;
- Scanner/Verifier/Canary authority;
- agent production-write permissions;
- downstream agents;
- owner-review requirements.

This makes migration state inspectable without pretending the target model is already running.

## Prompt / instruction hardening

Updated:

- `AGENTS.md`
- `.agents/skills/kk-discovery-scanner/SKILL.md`
- `.agents/skills/kk-event-verifier/SKILL.md`
- `.agents/skills/kk-canary-safety/SKILL.md`

New common rules:

1. **Model capability never expands project authority.**
2. Keep `observed fact`, `source claim`, `inference`, and `recommendation` distinct.
3. Model confidence is not source authority.
4. A configured/recommended model target is not runtime execution evidence.
5. Ambiguous protected-write policy, identity, fencing, evidence, or readback fails closed.
6. Tool/API success alone is not Definition of Done.
7. Scanner remains staging-only.
8. Verifier retains the existing governed final-handoff requirements.
9. Canary remains zero-write and should remain deterministic where possible.
10. A new model family is not, by itself, rollout acceptance evidence.

## CI / TDD evidence

The migration contract was implemented test-first.

### RED 1 — policy module absent

- Workflow: Admin Regression #917
- Syntax checks: PASS
- Regression: FAIL as expected
- Exact cause: `MODULE_NOT_FOUND: ../server/kk-model-migration-policy.js`

This proved the test was exercising a missing production capability rather than passing accidentally.

### GREEN policy / RED prompt

- Workflow: Admin Regression #920
- Syntax: PASS
- Migration policy test: PASS
- Routing test: PASS
- Readiness fail-closed test: PASS
- Prompt-hardening test: FAIL as expected because the new authority language had not yet been added.

### GREEN prompt

- Workflow: Admin Regression #922
- Syntax checks: PASS
- Full regression: PASS
- Code Intelligence retrieval benchmark: PASS
- HF benchmark safety: PASS
- HF readiness fail-closed: PASS

### RED 2 — Registry metadata absent

A new regression assertion was added before modifying the Registry.

- Workflow: Admin Regression #924
- Existing migration policy tests: PASS
- Prompt hardening test: PASS
- Registry migration-metadata test: FAIL as expected
- Exact cause: `model_migration` was undefined.

### GREEN Registry

- Workflow: Admin Regression #926
- Syntax checks: PASS
- Full regression: PASS
- Code Intelligence retrieval benchmark: PASS
- HF benchmark safety: PASS
- HF readiness fail-closed: PASS

This confirms the new Registry metadata did not break existing agent, admin, scanner, verifier, HF, or repository regression contracts covered by the suite.

## Test coverage added

Created:

- `tests/kk-model-migration-policy.test.js`

It verifies:

- target family and default model;
- shadow-only / transport-not-wired state;
- zero production writes;
- workload routing;
- deterministic Canary route;
- fail-closed readiness gates;
- prompt authority boundaries;
- Registry metadata exposure without cutover.

`package.json` was also updated so `npm run check` explicitly syntax-checks `server/kk-model-migration-policy.js`.

## What improved

### 1. Model migration is now explicit instead of implicit

Before this change, there was no canonical repository object describing:

- target family;
- model routing;
- reasoning roles;
- migration state;
- required cutover gates.

Now the intended migration is machine-readable and test-covered.

### 2. False cutover claims are harder

The repository now distinguishes:

- **target model configuration** from
- **runtime execution evidence**.

A caller cannot truthfully infer that GPT-6 is live merely because `gpt-6-sol` appears in configuration.

### 3. Better protection against stronger-model overreach

The prompt contracts now explicitly say that a stronger model/provider/tool surface does not expand authority.

This is especially important for:

- Scanner staging-only behavior;
- Verifier governed writes/readback;
- Canary zero-write acceptance;
- owner-hidden event preservation.

### 4. Cost-aware routing is documented

The policy avoids using Astra for routine work and preserves Luna as a bounded high-volume option.

### 5. Cutover now has a deterministic gate

A future implementation can call `migrationReadiness()` and receives a complete list of missing gates rather than relying on prose or operator memory.

## What was intentionally NOT changed

This branch does not:

- install the OpenAI SDK;
- create an OpenAI API key;
- add Responses API calls;
- change any ChatGPT scheduled-task model;
- enable/disable/reschedule Scanner or Verifier;
- mutate Machine SOT;
- mutate pricing;
- mutate booking/inventory;
- change storefront event visibility;
- deploy or merge to production;
- grant production-write authority to any AI component.

## Remaining blockers before a real GPT-6 cutover

Current state:

| Gate | State |
| --- | --- |
| Prompt audit | PASS for repository contracts covered by regression |
| Transport wired | **NO** |
| GPT-6 shadow eval on representative KK cases | **NO** |
| GPT-6 zero-write runtime acceptance | **NO** |
| Production cutover allowed | **NO** |

The next real migration phase should not be a merge-and-hope deployment.

It should be a representative **GPT-6 Sol shadow evaluation** against production-shaped KK cases, including:

- duplicate events;
- owner-hidden events;
- date/venue conflicts;
- cancelled/postponed events;
- multi-day family completeness;
- missing competitor-price evidence;
- provisional pricing semantics;
- stale/ambiguous source evidence;
- poster/image evidence;
- Scanner staging-only output;
- Verifier HOLD vs COMMIT decisions;
- protected write/readback failure cases.

Only after the actual runtime surface can prove which model executed should `transport_wired`, `shadow_eval_passed`, or `zero_write_acceptance_passed` become true.

## Parallel-branch reconciliation found during final review

Final Vercel/GitHub verification surfaced a separate, concurrent branch:

- `feat/csv-analysis-agent-20260929`

That branch is not part of `main` and is not part of PR #311. It adds `server/kk-openai-agents-adapter.js` for a bounded CSV-analysis feature.

Observed properties of that adapter at review time:

- it dynamically imports the OpenAI SDK;
- it accepts `OPENAI_API_KEY`;
- its model can be overridden through `KK_CSV_ANALYSIS_MODEL`;
- its current fallback model is already `gpt-6-sol`;
- its returned result declares `production_writes: 0` and `publishes: 0`.

This does **not** make the Scanner/Verifier migration transport-ready. It is a feature-scoped CSV-analysis transport on an unmerged branch.

If that branch is later merged, the integration follow-up should reuse this migration policy as the canonical model-routing/readiness contract rather than creating a second independent model-policy source.

## Decision

Keep PR #311 **draft / shadow-only** until a real model-execution surface is deliberately selected and evaluated.

Do not merge this work as evidence that GPT-6 is already live. Merge, when approved, means only that the repository is migration-ready and fail-closed around the future cutover.
