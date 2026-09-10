# KK Phone Rental — Controlled Scheduler Migration & Cutover Contract v1

Date: 2026-09-10 Asia/Bangkok
Status: DEVELOPMENT-PLANE DESIGN / NO PRODUCTION CANDIDATE SCHEDULER CREATED
Authority: live Machine SOT + exactly one highest Active Policy remain production truth.

## Why this exists

Repeated natural Scanner/Verifier occurrences have shown a control-plane failure class in which the canonical recurring task executes or partially executes and is later observed disabled. Re-enabling the same task is a safe mitigation, but repeated recurrence means re-enable/prompt hardening is not a credible permanent root-cause fix.

This document defines the only permitted path to evaluate and, later, cut over to a different scheduler clock without introducing two production writers.

## Non-goals

- Do not create a replacement production scheduler merely because this contract exists.
- Do not disable the current canonical production scheduler during design or shadow evaluation.
- Do not create a watchdog that silently re-enables tasks.
- Do not move business truth out of Machine SOT.
- Do not create a second fencing counter or second final writer.
- Do not merge or deploy to production without explicit owner approval and evidence gates.

## Core invariant

At any instant, for each role, there may be at most one scheduler authorized to initiate production-writing runtime.

`production_writer_count(role) <= 1`

A shadow scheduler may observe/compute expected occurrences, but it must have production writes disabled and must not acquire the production role lease.

## Phase S0 — Design only

Required artifacts:

- candidate scheduler identity and failure model;
- schedule/occurrence semantics matching Asia/Bangkok canonical cadence;
- credential boundary;
- Machine SOT authority preserved;
- shared canonical lease/fencing source;
- rollback plan;
- no provider/customer side effects.

Exit: implementation-ready shadow design only.

## Phase S1 — Shadow clock

Candidate scheduler is allowed to compute/emit read-only expected-occurrence evidence only.

Requirements:

- production writes disabled;
- production Scanner/Verifier lease acquisition disabled;
- same occurrence identity semantics as canonical schedule;
- no task enable/disable mutation;
- no Make/provider/customer mutation;
- compare expected occurrence, launch latency and missed occurrence detection against current canonical scheduler;
- minimum six consecutive matching shadow observations per role before cutover can even be considered.

Any mismatch resets the clean shadow streak.

## Phase S2 — Cutover readiness

Before an owner can approve cutover:

- shadow requirements pass;
- no active protected writer lock;
- unresolved PREPARED/COMMITTING = 0;
- rollback plan exact and tested in non-production;
- candidate uses the same canonical fencing history and derives `MAX(valid canonical lease)+1`;
- explicit owner approval is present.

Config success is not cutover proof.

## Phase S3 — Atomic control-plane handoff

Required order:

1. Verify no active role writer lease.
2. Verify unresolved PREPARED/COMMITTING = 0.
3. Disable old scheduler for that role.
4. Exact-read old scheduler disabled.
5. Enable candidate scheduler for that role.
6. Exact-read candidate scheduler enabled.
7. On first natural occurrence, candidate derives the next canonical lease version from the shared Machine-SOT history.
8. Require full natural runtime evidence: policy exact1, lease/fence, one canonical Manifest, governed work/no-op, exact readback, terminal state, lease release.

The candidate must never be enabled for production writes before exact proof that the old scheduler is disabled.

## Phase S4 — Post-cutover acceptance

Minimum acceptance:

- six consecutive natural Scanner occurrences clean;
- six consecutive natural Verifier occurrences clean;
- no manual rescue;
- no dual writer;
- no duplicate fence;
- no stale active lease;
- no malformed/duplicate Manifest;
- no unresolved PREPARED/COMMITTING;
- Candidate↔AI consistency preserved;
- no unauthorized outbound;
- soak window passes.

Target after the initial 6+6 gate: at least 24h soak before calling Core production-stable.

## Rollback contract

Rollback must be the inverse single-writer handoff:

1. wait for/resolve active writer boundary safely;
2. disable candidate scheduler;
3. exact-read candidate disabled;
4. only then re-enable old canonical scheduler;
5. exact-read old scheduler enabled;
6. continue the same shared fencing history; never reset counters.

If candidate-disabled proof is missing, rollback re-enable of the old scheduler is denied.

## Evidence ladder

- DESIGN_PASS: contract and threat model exist.
- SHADOW_PASS: minimum clean no-write observations pass.
- CUTOVER_READY: deterministic gates pass; owner approval still required.
- RUNTIME_PASS: natural post-cutover role runs pass.
- SOAK_PASS: consecutive and 24h reliability evidence pass.
- PRODUCTION_STABLE: only after business/runtime/provider gates required by the wider KK release model are also satisfied.

## Current 2026-09-10 trigger evidence

The design is justified by repeated `TASK_DISABLED_AFTER` / control-plane recurrence. Separately, the 16:00 Scanner Manifest field-shift defect was repaired by header-name addressing and a later 17:00 natural Scanner produced a schema-valid canonical Manifest and released lease; that repair does not explain or close the scheduler disable recurrence.

Therefore scheduler migration is now a controlled reliability workstream, not a reactionary replacement task.

## Third-party tooling boundary

Sol Advisor, gstack, Claude Canfly skills and Free Claude Code may assist development-plane design/review/testing only. None may become production scheduler authority or bypass this contract. FCC is not a scheduler reliability dependency.
