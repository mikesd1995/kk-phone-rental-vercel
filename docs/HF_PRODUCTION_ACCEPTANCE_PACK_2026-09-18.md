# HF Production Acceptance Pack — 2026-09-18

PR: #44
Runtime integration tracking: #46
Task-persistence dependency: #47
Current live policy baseline: `v4.9.15 AUTONOMOUS CLOSURE & OWNER NOTIFICATION HARDENING`

## Purpose

Define the exact evidence and rollback gates required before Hugging Face Event Assist may participate in a live KK Discovery Scanner occurrence.

This pack is preparation only. It does not enable HF in production.

## Current proven state

- bounded live HF UAT: PASS;
- zero-shot model: `MoritzLaurer/bge-m3-zeroshot-v2.0`;
- embedding model: `intfloat/multilingual-e5-large`;
- benchmark classification: 14/14 on the bounded fixture;
- duplicate recall: 3/3;
- false-positive duplicate pairs: 0;
- hard identity conflicts protected: 2;
- HF remains nonauthoritative / Verifier-required;
- repository Scanner adapter is staged but not imported by production entrypoints;
- canonical Scanner and Verifier were restored ON under same-ID control-plane remediation;
- Issue #47 natural-runtime persistence acceptance remains pending.

## Gate A — task persistence must be proven first

Do not begin production HF integration unless Issue #47 proves the natural Verifier :30 and Scanner :00 boundaries under live Machine SOT.

Minimum evidence for both roles:

1. exact canonical task ID ON before the occurrence;
2. exactly one highest Active policy;
3. governed Machine-SOT runtime boundary, not timer metadata alone;
4. exact CORE shared-writer evidence;
5. exact role lock / fencing evidence;
6. exactly one role Manifest bound to the run;
7. terminal / release evidence;
8. unresolved PREPARED / COMMITTING transactions = 0 where applicable;
9. same canonical task remains ON after its own runtime;
10. no unattributed task OFF transition.

Any missing natural runtime proof keeps production HF OFF.

## Gate B — repository merge readiness

Before PR #44 can be considered for merge:

- current head Admin Regression = SUCCESS;
- current head Vercel Preview = READY;
- PR mergeable against current `main`;
- no unexpected base advancement / conflict;
- automatic PR-triggered HF live-UAT workflow absent;
- manual `hf-event-assist-uat.yml` remains `workflow_dispatch` only;
- production-import isolation guard PASS;
- no token-like credential committed;
- current model / benchmark / identity guards remain PASS;
- stale-evidence hardening tests remain PASS.

Merge and production activation are separate decisions. A merge must not imply HF production enablement.

## Gate C — normalized Scanner evidence snapshot

The staged Scanner adapter accepts only:

```text
evidence_schema = SCANNER_HF_GATE_SNAPSHOT_V1
```

The caller must normalize live Machine-SOT evidence before calling the adapter. Raw Sheet rows are not accepted as authority.

The snapshot must contain evidence bound to one current Scanner run:
- Run ID;
- Candidate ID;
- explicit Candidate→Run binding;
- evidence snapshot timestamp;
- exactly one Active policy;
- CORE lock with acquisition/expiry/fence;
- Scanner lock with acquisition/expiry/fence;
- post-acquire writer recheck timestamp;
- zero post-acquire writer conflicts;
- exactly one Scanner Manifest;
- Manifest Created/Frozen timestamps;
- Manifest policy / fence consistency;
- one policy-authorized normalized Planner work item with Planned At.

An expired lease, future-dated evidence, stale recheck or run-binding mismatch blocks the external call.

## Gate D — production integration surface

The current repository intentionally contains no production API/admin import of `server/hf-scanner-adapter.js`.

Before changing this:
1. identify the existing runtime surface that the canonical Scanner can legitimately reuse;
2. do not create a new queue, runner, scheduler or watchdog merely to host HF;
3. if no existing compatible integration surface exists, remain blocked rather than invent a parallel architecture;
4. integration must preserve the current Scanner→existing handoff→Verifier authority chain;
5. final business writes must remain outside HF authority.

The production-import isolation test must be removed or narrowed only in the same reviewed change that creates the approved integration surface.

## Gate E — first controlled live occurrence

First live production integration must be a controlled occurrence, not broad recurring enablement.

Required sequence:

1. fresh-read one highest Active policy;
2. prove Issue #47 task-persistence acceptance still holds;
3. fresh no-writer preflight;
4. acquire exact CORE shared writer;
5. acquire exact Scanner role lock/fence;
6. post-acquire writer recheck;
7. freeze exact Manifest;
8. materialize / normalize exact authorized Planner work;
9. build `SCANNER_HF_GATE_SNAPSHOT_V1`;
10. call HF at most once for the selected advisory action;
11. stage only nonauthoritative output into the existing Verifier handoff;
12. exact-read governed runtime records;
13. release locks;
14. confirm Scanner task remains ON.

## Required observability for every live HF assist

Persist or expose bounded, non-secret audit metadata sufficient to reconstruct the decision path:

- Scanner Run ID;
- Candidate ID;
- policy version;
- evidence snapshot timestamp;
- assist task;
- model ID;
- call attempted / call count;
- provider latency;
- top label / score / confidence band for classification;
- dedup pair/conflict counts where applicable;
- advisory status;
- blocker codes;
- `authoritative=false`;
- `verifier_required=true`;
- `production_writes=0`;
- `final_truth_mutation=false`;
- `notification_sends=0`.

Do not persist:
- HF token;
- bearer credential;
- raw embedding vectors in the business handoff;
- provider secrets;
- unsupported final business conclusions.

## Immediate abort conditions

The controlled occurrence must fail closed before or after the HF call when any of these occur:

- Active policy count != 1;
- stale/expired CORE or Scanner lease;
- missing or mismatched fencing;
- Candidate not bound to current run;
- post-acquire recheck missing / stale / before acquisition;
- writer appears after acquisition;
- Manifest missing, duplicate, unfrozen, future-dated or policy/fence mismatched;
- Planner evidence missing, duplicate, unauthorized or future-dated;
- evidence schema is not the normalized contract;
- HF result attempts authority escalation;
- provider timeout/error/malformed result;
- task turns OFF;
- transaction or runtime terminality becomes ambiguous.

No failure path may manufacture a classification or business decision.

## Rollback

Primary rollback remains:

```text
HF_EVENT_ASSIST_ENABLED=false
```

Rollback must not:
- clone Scanner/Verifier;
- create a watchdog;
- rewrite historical manifests;
- fabricate a successful handoff;
- change final business truth merely to compensate for HF failure.

If the integration surface itself is defective, remove/disable only the HF call path and retain the canonical Scanner/Verifier architecture.

## Acceptance classification

### READY_FOR_CONTROLLED_PRODUCTION_OCCURRENCE
Allowed only when:
- Issue #47 natural persistence is accepted;
- PR/current integration head CI + Preview are green;
- approved existing integration surface is identified;
- all gate contracts are preserved;
- HF is still advisory.

### BLOCKED_SAFE
Use when any prerequisite is missing or ambiguous.

### PRODUCTION_ACCEPTED
Do not use after one successful HF call alone.

Production acceptance requires a later explicit review of controlled live evidence, task persistence after the run, handoff integrity and zero unauthorized writes.

## Current classification

```text
HF quality evidence = PASS
Repository staging = PASS
Stale-evidence hardening = IN REVIEW / CI REQUIRED
Issue #47 natural persistence = PENDING
Production integration surface = NOT YET APPROVED
HF production activation = OFF
```
