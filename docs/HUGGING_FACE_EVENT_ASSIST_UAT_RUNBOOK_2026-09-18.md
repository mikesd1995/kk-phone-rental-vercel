# KK Phone Rental — Hugging Face Event Assist Controlled UAT Runbook

Date: 2026-09-18  
Scope: HF Event Assist V1.1  
Policy baseline: v4.9.15  
Authority: Hugging Face remains advisory; GPT Verifier remains final-truth authority.

## Purpose

Run one bounded live Hugging Face quality test before any recurring Scanner wiring or production enablement.

This UAT MUST NOT:
- write to Machine SOT;
- mutate Candidate/AI/Lifecycle/monthly/pricing data;
- mutate Scanner/Verifier/Canary recurring tasks;
- send LINE or Telegram;
- create a new Runner, scheduler, queue, watchdog or final writer;
- auto-merge or delete event identities.

## External API requirements

Hugging Face Inference Providers require a bearer access token with Inference Providers permission.

Official references:
- https://huggingface.co/docs/inference-providers/tasks/zero-shot-classification
- https://huggingface.co/docs/inference-providers/tasks/feature-extraction
- https://huggingface.co/intfloat/multilingual-e5-large

The selected zero-shot model is currently listed by Hugging Face as a recommended multilingual zero-shot model:
- `MoritzLaurer/ModernBERT-large-zeroshot-v2.0`

The embedding path uses:
- `intfloat/multilingual-e5-large`

For symmetric semantic similarity, E5 uses the `query: ` prefix.

## Preflight

Before a live UAT:

1. Confirm PR #44 is still DRAFT and unmerged.
2. Confirm production is still on main.
3. Confirm no production Scanner wiring imports/calls `server/hf-event-assist.js`.
4. Confirm Machine SOT highest Active policy remains compatible with v4.9.15 controls.
5. Confirm HF token is stored only in an approved secret/environment surface; never commit it.
6. Confirm the bounded fixture has no customer/booking PII.
7. Confirm benchmark command is the zero-write harness:
   `npm run hf:assist:benchmark`

## Environment

Live UAT requires:

```text
HF_EVENT_ASSIST_ENABLED=true
HF_TOKEN=<secret with Inference Providers permission>
```

Optional overrides:

```text
HF_ZERO_SHOT_MODEL=<owner/model>
HF_EMBED_MODEL=<owner/model>
```

Do not print `HF_TOKEN`. Do not write it to JSON, logs, PR text, Sheet, or benchmark artifacts.

## Execute

Run:

```bash
HF_EVENT_ASSIST_ENABLED=true HF_TOKEN="$HF_TOKEN" npm run hf:assist:benchmark
```

Expected report invariants:

```text
status = LIVE_BENCHMARK_COMPLETE
production_writes = 0
final_truth_mutation = false
notification_sends = 0
```

## Quality gate

Minimum V1.1 promotion-review gate:

- classification accuracy >= 0.80
- duplicate recall >= 0.90
- false-positive ordinary duplicate pairs = 0
- exact-date / Show-ID conflicts remain outside normal duplicate pairs
- no token leakage
- no Machine SOT write
- no provider notification send

Passing the benchmark does NOT authorize production activation. It authorizes only a controlled Scanner-wiring review.

## Fail-closed outcomes

Keep HF disabled if any of the following occurs:

- HTTP/provider/model error;
- malformed model response;
- classification accuracy below gate;
- duplicate recall below gate;
- any false-positive ordinary duplicate pair;
- any different-date or different-Show-ID pair placed in normal duplicate bucket;
- secret/token appears in output;
- any production write;
- any notification send;
- any unexpected task/scheduler mutation.

Do not lower identity safety rules merely to improve duplicate recall.

## Scanner wiring gate after UAT

If the live quality gate passes, a later governed patch may wire HF into the existing Scanner only after the current occurrence has already established:

1. highest Active policy/no-conflict preflight;
2. CORE shared-writer ownership;
3. Scanner role/fencing ownership;
4. exact Manifest freeze/readback;
5. current-occurrence Planner exact1;
6. then external discovery/HF access.

HF output must remain advisory and pass through the existing Candidate/AI -> Verifier path.

## Rollback

Immediate feature rollback:

```text
HF_EVENT_ASSIST_ENABLED=false
```

Because V1.1 introduces no Machine SOT schema, queue or final-write dependency, disabling the feature requires no business-data migration.

Code rollback before merge:
- close PR #44 or revert the HF branch commits.

Code rollback after any future merge:
- revert the HF adapter/wiring commit;
- keep HF disabled throughout rollback;
- verify Scanner/Verifier acceptance and existing zero-HF path.

## Evidence to preserve after live UAT

Record only non-secret evidence:
- exact Git commit SHA;
- benchmark timestamp;
- zero-shot model ID;
- embedding model ID;
- candidate count;
- classification accuracy;
- duplicate recall;
- false-positive count;
- identity-conflict count;
- production_writes=0;
- final_truth_mutation=false;
- notification_sends=0;
- PASS/FAIL decision and reason.

Never persist the HF token or Authorization header.


## V1.3 readiness and execution route

Before any live benchmark, run:

```bash
npm run hf:assist:readiness
```

The readiness command performs zero network calls.

Expected blocked state when no controlled credential is available:

```text
status = BLOCKED
network_calls = 0
production_writes = 0
final_truth_mutation = false
notification_sends = 0
```

Expected ready state only when all local preconditions are satisfied:

```text
status = READY_FOR_LIVE_UAT
network_calls = 0
```

A READY status means only that the bounded benchmark may be executed.

### Call budget

Default maximum:

```text
HF_UAT_MAX_CALLS=20
```

The current 14-candidate fixture plans 15 calls:
- 14 zero-shot classification requests;
- 1 batch embedding request.

If planned calls exceed the configured maximum, the benchmark must stop before external access with:

```text
status = BLOCKED_CALL_BUDGET
live_hf_calls = 0
```

### Credential handling

The credential must exist only in an approved secret/environment surface.

Never:
- put `HF_TOKEN` in source;
- commit it to GitHub;
- paste it into PR/documentation;
- emit it to logs;
- store it in Machine SOT;
- attach it to benchmark JSON.

The adapter redacts an exact configured token and bearer credential text from remote provider errors. The benchmark also checks the final serialized report for an exact-token leak.

### Hugging Face Jobs limitation observed

The connected Hugging Face account is authenticated, but a bounded Jobs probe returned:

```text
402 Payment Required
```

Therefore Jobs is not an approved execution route for this UAT in the current account state.

Do not route the benchmark through arbitrary public/community Spaces merely to bypass the Jobs/payment boundary.

Use a controlled environment that can securely provide the inference credential to the existing benchmark script.

### Structured failure

If any live provider/model call fails, preserve a non-secret report with:

```text
status = LIVE_BENCHMARK_FAILED
quality_gate_pass = false
activation_recommendation = KEEP_DISABLED_AND_INVESTIGATE
```

The report may include the redacted error and number of attempted calls, but never the token.


## V1.4 manual GitHub controlled-UAT execution surface

A dedicated manual-only workflow now exists:

- `.github/workflows/hf-event-assist-uat.yml`
- workflow name: `HF Event Assist Controlled UAT`

This workflow is intentionally not triggered by push, pull request, cron, Scanner cadence, or production runtime.

### Authorization gate

The operator must manually dispatch the workflow and type exactly:

```text
RUN_HF_ZERO_WRITE_UAT
```

The operator must also set the maximum allowed live calls. The default is 20.

### Credential surface

The workflow reads only the repository Actions secret:

```text
secrets.HF_TOKEN
```

The secret is injected only into:
1. the zero-network readiness step; and
2. the bounded live benchmark step.

It is not written into source, PR text, artifacts, Machine SOT, or Vercel environment variables by this workflow.

If the secret is absent, readiness must remain BLOCKED and the workflow fails before the benchmark performs external inference.

### Execution order

1. Checkout exact requested ref.
2. Node 20 setup.
3. Full syntax/regression checks.
4. Zero-network readiness gate.
5. Bounded live benchmark.
6. Upload non-secret JSON evidence for 30 days.

The benchmark result is rejected if:
- status is not `LIVE_BENCHMARK_COMPLETE`;
- production writes are nonzero;
- final truth mutation is not false;
- notification sends are nonzero;
- actual live calls exceed the configured maximum.

### Important authority boundary

A successful workflow run is empirical model/UAT evidence only.

It does not:
- merge PR #44;
- enable recurring HF use;
- mutate Scanner/Verifier/Canary;
- mutate Machine SOT;
- promote a Vercel production deployment;
- authorize final business truth.

Scanner integration still requires a separate controlled wiring review under the live highest Active Machine SOT policy.


## V1.6 preferred keyless OIDC setup

The preferred credential path is now a Hugging Face account CI/CD identity rather than a long-lived repository secret.

### Hugging Face account configuration

In Hugging Face account settings:

1. Open Authentication.
2. Open CI/CD Access.
3. Add a GitHub Actions identity.
4. Pin claims to:
   - repository: `mikesd1995/kk-phone-rental-vercel`
   - branch: `hf-event-assist-v1-20260918`
   - workflow: `hf-event-assist-uat.yml`
5. Enable `Allow Inference Providers calls`.

The resulting exchanged token is short-lived (60 minutes) and carries `inference-api` only when the option above is enabled.

### Permanent workflow credential resolution

The manual workflow resolves credentials in this order:

1. repository Actions secret `HF_TOKEN`, if explicitly configured;
2. otherwise GitHub OIDC → Hugging Face account CI/CD identity token exchange.

The OIDC route is preferred because it avoids a long-lived secret.

### Proven current state

A one-shot OIDC probe on 2026-09-18 produced:

```text
HTTP 400
invalid_grant
No trusted publisher configured for user 'Mikesd1995' matching this OIDC token
```

This means GitHub OIDC issuance worked, but the Hugging Face account-side identity is not yet configured for the tested claims.

No benchmark inference call was made.

### Re-run after account configuration

After adding the CI/CD identity, run the permanent GitHub Actions workflow:

```text
HF Event Assist Controlled UAT
```

Input:

```text
confirm_zero_write_uat = RUN_HF_ZERO_WRITE_UAT
max_live_calls = 20
```

The workflow must still pass:
- full regression;
- credential exchange;
- zero-network readiness;
- bounded live benchmark;
- quality gate.

A credential-exchange success alone is not production approval.
