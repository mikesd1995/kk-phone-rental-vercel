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
