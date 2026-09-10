# KK Phone Rental — Controlled Scheduler Migration & Cutover Contract v1

Date: 2026-09-10 Asia/Bangkok
Status: S0 IMPLEMENTED / S1 BLOCKED_EXTERNAL_CAPACITY / NO PRODUCTION CANDIDATE ACTIVE
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
- no provider/customer side effects;
- provider/runtime capacity sufficient to activate a shadow candidate without disabling any production scenario;
- candidate clock independent from the current ChatGPT recurring-task control plane.

Exit: implementation-ready shadow design only.

### Current S0 candidate

Make was selected as the first scheduler candidate because it is operationally independent from the current ChatGPT recurring-task control plane and an existing production Make scheduled transport already demonstrates repeated automatic schedule execution.

Two no-write observer candidate scenarios were constructed only for capacity probing:

- `6224679` in team `2671496`
- `6224686` in private space `2671497`

Both candidates contain only execution-scoped `util:SetVariable2` timestamp/`SHADOW_NO_WRITE` markers and have no Google Sheets, Telegram, provider, Machine SOT, lease or production-writer connection.

Both activation attempts were rejected by Make with `Maximum number of active scenarios has been exceeded`. They remain inactive. No active production Make scenario was disabled to manufacture capacity.

S0 design/configuration therefore passes, but S1 runtime shadow has not started.

## Phase S1 — Shadow clock

Candidate scheduler is allowed to compute/emit read-only expected-occurrence evidence only.

Requirements:

- provider/runtime capacity available before activation;
- candidate clock independent from the current recurring-task control plane;
- production writes disabled;
- production Scanner/Verifier lease acquisition disabled;
- same occurrence identity semantics as canonical schedule;
- no task enable/disable mutation;
- no Make provider/customer mutation outside the isolated shadow candidate;
- compare expected occurrence, launch latency and missed occurrence detection against current canonical scheduler;
- minimum six consecutive matching shadow observations per role before cutover can even be considered.

Any mismatch resets the clean shadow streak. Provider capacity failure is a blocking condition, not a reason to disable an existing production scenario merely to free a slot.

## Phase S2 — Cutover readiness

Before an owner can approve cutover:

- shadow requirements pass;
- candidate runtime capacity remains available;
- independent clock semantics proven;
- no active protected writer lock;
- unresolved PREPARED/COMMITTING = 0;
- rollback plan exact and tested in non-production;
- candidate uses the same canonical fencing history and derives `MAX(valid canonical lease)+1`;
- explicit owner approval is present.

Config success is not cutover proof.

## Phase S3 — Atomic control-plane handoff

Required order:

1. Verify candidate runtime capacity and independent-clock status.
2. Verify no active role writer lease.
3. Verify unresolved PREPARED/COMMITTING = 0.
4. Disable old scheduler for that role.
5. Exact-read old scheduler disabled.
6. Enable candidate scheduler for that role.
7. Exact-read candidate scheduler enabled.
8. On first natural occurrence, candidate derives the next canonical lease version from the shared Machine-SOT history.
9. Require full natural runtime evidence: policy exact1, lease/fence, one canonical Manifest, governed work/no-op, exact readback, terminal state, lease release.

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
- S0_CONFIG_PASS: isolated candidate configuration validates and contains no production write path.
- S1_BLOCKED_EXTERNAL_CAPACITY: candidate cannot be activated because provider capacity is unavailable; no runtime claim permitted.
- SHADOW_PASS: minimum clean no-write observations pass.
- CUTOVER_READY: deterministic gates pass; owner approval still required.
- RUNTIME_PASS: natural post-cutover role runs pass.
- SOAK_PASS: consecutive and 24h reliability evidence pass.
- PRODUCTION_STABLE: only after business/runtime/provider gates required by the wider KK release model are also satisfied.

## Baseline before migration — 2026-09-10

Natural runtime itself is currently functional, but recurring-task persistence is not reliable:

- 17:00 Scanner produced canonical Manifest5078, lease v269 released, Candidate↔AI 25=25, then the canonical Scanner task was observed OFF and manually re-enabled.
- 17:30 Verifier produced canonical Manifest5079, lease v258 released, processed=1 / held=1 / remaining=24, then the canonical Verifier task was later observed OFF.
- 18:00 Scanner produced canonical Manifest5080, lease v270 released, Candidate↔AI 24=24, then the canonical Scanner task was later observed OFF.

This is the pre-migration baseline. Root cause remains UNKNOWN. Re-enable remains mitigation only.

Independent Make scheduler liveness is better in the observed comparison window, but it is not yet a KK shadow scheduler proof: scenario `6176241` recorded eight consecutive automatic successful scheduled executions between 16:14 and 17:59 Asia/Bangkok while remaining active. Those executions prove Make clock liveness for that existing scenario only; they do not prove Scanner/Verifier occurrence equivalence, no-write shadow semantics, or cutover readiness.

## Current blocker and decision

Do not deactivate production Make scenarios `5901592` or `6176241` merely to free an active-scenario slot. Doing so would improve the experiment by degrading the live business system and would invalidate the safety objective.

Current strict classification:

`S0_CONFIG_PASS / S1_BLOCKED_EXTERNAL_CAPACITY / CONTROL_PLANE_BASELINE_FAIL / NO_CUTOVER`

Next acceptable paths are:

1. obtain Make active-scenario capacity and activate exactly one isolated no-write shadow candidate; or
2. select another genuinely independent scheduler/runtime that can satisfy the same no-write shadow contract.

Only after at least six clean matching shadow observations per role may S2 be considered.

## Third-party tooling boundary

Sol Advisor, gstack, Claude Canfly skills and Free Claude Code may assist development-plane design/review/testing only. None may become production scheduler authority or bypass this contract. FCC is not a scheduler reliability dependency.
