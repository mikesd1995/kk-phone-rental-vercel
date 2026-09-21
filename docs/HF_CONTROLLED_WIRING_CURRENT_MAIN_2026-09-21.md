# HF Controlled Wiring — Current-main Port 2026-09-21

Status: **STAGED / PRODUCTION OFF / ZERO BUSINESS AUTHORITY**

## Objective

Port the reviewed Hugging Face Event Assist staging surface from stale PR #62 onto an exact fresh branch created from current main without rebasing or merging the stale branch.

Fresh base at branch creation:

`0753c6d0af246daa6a9b0324fee4ec876b38f157`

Source lineage:
- PR #44 = original HF guarded staging, now stale/superseded as merge source;
- PR #62 = first current-main port, later drifted to 35 commits behind current main;
- this branch = second fresh current-main port.

## Safety posture

This port does not:
- import HF into `api/kk-scanner-dispatch.js`;
- enable `HF_EVENT_ASSIST_ENABLED`;
- enable external Scanner execution;
- enable native Scanner or Verifier;
- mutate Machine SOT;
- mutate Vercel environment variables;
- call HF during ordinary CI;
- write business/final/pricing/booking/inventory data;
- send customer/provider notifications.

HF remains advisory only:
- `authoritative=false`;
- `verifier_required=true`;
- `production_writes=0`;
- `final_truth_mutation=false`;
- `notification_sends=0`.

## Ported components

Implementation:
- `server/hf-event-assist.js`
- `server/hf-scanner-wiring-contract.js`
- `server/hf-scanner-adapter.js`

Tooling:
- `scripts/hf-event-assist-benchmark.js`
- `scripts/hf-event-assist-readiness.js`
- `scripts/hf-event-assist-dry-run.js`

Tests:
- `tests/hf-event-assist.test.js`
- `tests/hf-scanner-wiring-contract.test.js`
- `tests/hf-scanner-adapter.test.js`
- `tests/hf-external-scanner-isolation.test.js`
- `tests/fixtures/hf-event-assist-benchmark.json`

Manual UAT only:
- `.github/workflows/hf-event-assist-uat.yml`

The UAT workflow remains `workflow_dispatch` only. It has no push, pull_request, or schedule trigger.

## Current-main additive integration

`package.json` was updated additively:
- current safety checks inherited from main are preserved;
- HF syntax checks are appended;
- HF benchmark/readiness/dry-run commands are added.

`.github/workflows/admin-regression.yml` was updated additively:
- existing syntax and regression jobs remain unchanged;
- disabled-path HF benchmark must return `PREPARED_NOT_EXECUTED`;
- disabled-path readiness must return `BLOCKED` with `HF_EVENT_ASSIST_DISABLED`;
- both checks require zero network/live HF authority, zero production writes, zero final-truth mutation, and zero notifications.

## Current Control Plane dependency

At port time:
- active Machine SOT policy = `v4.9.19 CANONICAL MINIMAL LAUNCHER`;
- canonical Scanner = OFF;
- canonical Verifier = OFF;
- repeat native re-enable is not authorized;
- #111 persistence auditor = merged;
- #116 witness transition gate = merged;
- #119 readiness/evidence pack = merged;
- current Production = exact current main and READY;
- OIDC production acceptance remains blocked only by owner-authenticated Vercel environment mutation;
- external Scanner = OFF;
- Scanner execution capability = false;
- business writes capability = false;
- runtime-ledger rows = 0/0/0/0.

This branch does not change any of those states.

## Merge gate

This branch may be merged only if:
1. still 0 behind current main;
2. exact-head Admin Regression passes;
3. exact-head Vercel Preview is READY;
4. changed-file scope is limited to HF staging + additive CI/package/doc integration;
5. secret/credential scan is clean;
6. production import-isolation test passes;
7. HF remains disabled by default.

Merge readiness does **not** authorize HF Production activation.

## Production activation gate

HF production remains blocked until Control Plane Gate 1 has accepted an authorized runtime path and a separately controlled first production occurrence is reviewed.

Witness persistence acceptance, even if later 6/6, proves runtime-clock persistence only. It does not by itself authorize:
- Scanner business execution;
- HF final authority;
- direct business writes;
- customer notifications.

Rollback remains:

`HF_EVENT_ASSIST_ENABLED=false`


## Exact-head Preview retry checkpoint

A later Vercel inventory read showed Preview capacity had resumed for another HF staging branch commit, while this PR head still carried the earlier account build-rate-limit status.

This documentation-only commit intentionally creates a new exact branch head so Vercel can re-evaluate the canonical latest-main HF staging PR.

No runtime code, package behavior, CI policy, HF gate, Production environment, Machine SOT, Scanner/Verifier task state, provider access, or business data is changed by this checkpoint.

Merge still requires:
- branch 0 behind current main;
- Admin Regression PASS;
- exact-new-head Vercel Preview READY;
- unchanged zero-write / HF-disabled safety posture.
