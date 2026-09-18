# HF Controlled Scanner Wiring — Current-main staging

Date: 2026-09-18
Status: STAGED ON NON-PRODUCTION BRANCH / BLOCKED_SAFE
Branch: `hf-controlled-wiring-main-20260918`
Base: `f0e205fc5ed230c71d426d3786a4ce011ae9573b` (current main at branch creation)

## Objective

Port the already-reviewed Hugging Face Event Assist safety contracts from PR #44 onto a fresh branch derived from current `main`, while preserving the newer Scanner witness and Apps Script safety work already merged through PRs #59-#61.

This record does not authorize merge, production activation, Machine SOT changes, recurring-task changes, provider sends, or business writes.

## Preserved current-main safety work

Because this branch was created directly from current `main`, it includes the newer controls that PR #44 did not contain:

- PR #59 external Scanner runtime witness / HMAC trigger / fail-closed runtime ledger staging;
- PR #60 zero-write Apps Script recovery verifier;
- PR #61 fail-closed Apps Script backend identity verification;
- all earlier current-main safety work inherited by those commits.

No rebase of PR #44 was used.

## HF components staged

- `server/hf-event-assist.js`
- `server/hf-scanner-wiring-contract.js`
- `server/hf-scanner-adapter.js`
- bounded benchmark/readiness/dry-run scripts
- HF regression tests and synthetic benchmark fixture
- current-main CI syntax and fail-closed benchmark/readiness checks

## Additional current-main isolation hardening

Added `tests/hf-external-scanner-isolation.test.js`.

The test requires:

1. `/api/kk-scanner-dispatch` remains witness-only;
2. the external Scanner ingress does not import `hf-scanner-adapter` or `hf-event-assist`;
3. witness responses continue to state `scanner_execution_started:false` and `business_writes:0`;
4. production API/Admin entrypoints do not import the staged HF adapter;
5. the HF feature gate is disabled unless explicitly enabled.

This intentionally keeps the external Scanner witness and HF advisory staging separate until a later controlled integration review.

## HF call authorization contract

The staged Scanner HF contract permits at most one advisory call only after normalized `SCANNER_HF_GATE_SNAPSHOT_V1` evidence proves:

- exactly one Active policy;
- Candidate→Run binding;
- fresh CORE_SHARED_WRITER lease;
- fresh Scanner role/fencing lease;
- post-acquire writer recheck;
- zero conflicting writers;
- exactly one frozen Scanner Manifest bound to policy/fence/run;
- exactly one authorized Scanner Planner work item;
- temporally valid evidence.

HF output remains:

- `authoritative=false`;
- `verifier_required=true`;
- `production_writes=0`;
- `final_truth_mutation=false`;
- `notification_sends=0`.

## Runtime blocker intentionally not modified

Issue #47 natural-runtime persistence acceptance remains failed/pending.

Latest recorded state before this branch work:

- Scanner governed runtime occurred but canonical Scanner task transitioned OFF afterward;
- Verifier governed runtime later showed its own task-disable recurrence;
- consecutive acceptance remains Scanner 0/6 and Verifier 0/6;
- exact disabling actor/mechanism remains UNKNOWN.

This branch does not re-enable, edit, clone, replace, reschedule, or otherwise mutate those tasks.

## Required next gates

Before any production Scanner→HF integration:

1. resolve/accept the runtime persistence or approved external-runtime replacement path under the then-current Machine SOT policy;
2. keep external Scanner witness-only until its own controlled acceptance is proven;
3. re-read current main and Active policy immediately before integration work;
4. require exact-head CI and Preview success;
5. review changed-file, credential, production-import and zero-write boundaries;
6. perform one separately authorized controlled occurrence before any recurring activation.

Until those gates are met:

```
HF production activation = OFF
external Scanner HF production import = NONE
classification = BLOCKED_SAFE
```
