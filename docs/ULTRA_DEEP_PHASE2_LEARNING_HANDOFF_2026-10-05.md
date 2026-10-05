# Ultra Deep Phase 2 Learning Handoff — 2026-10-05

Canonical cross-chat handoff for PR #642 / branch fix/ultra-deep-learn-ryo-brand-social-miss.

## Current safety state
- Phase 2 may run read-only only.
- production_writes=0.
- No deploy, storefront mutation, price write, booking write, or Phase 3 auto-start.
- Phase 3 requires Phase 2 acceptance and owner approval.

## Why Phase 2 was repaired
Earlier verification could return VERIFY_REQUIRED and stop, leaving the owner to identify missing official sources or repeated verification gaps manually. This was not a closed learning loop.

## Learning Agent V6
Commit 4744d14d2874f6f4f7eb231e45f7103cc5766956.
New generalized verification miss classes:
- OFFICIAL_SOURCE_GAP
- SECONDARY_ONLY_VERIFICATION_GAP
- FIELD_CONFLICT_GAP
- IDENTITY_AMBIGUITY_GAP
- FRESHNESS_GAP

Recovery strategy escalates to official artist/organizer, official ticketing, official venue and field-level reconciliation. Do not hard-code individual missed event names as the fix.

## Verifier learning feedback contract
Commit 9a31e51580ae2bfefbd917dccabe0b328eaba00c.
Every candidate must end with one of:
- VERIFIED
- VERIFY_REQUIRED
- STATUS_CHANGED
- REJECT_WITH_REASON

VERIFY_REQUIRED is fed to Learning V6 and retried in a bounded recovery loop. Unresolved candidates retain explicit reason and evidence provenance.

## Agent registry
Commit 2d8c46f4e9a0f64604ec3d7e119e6e13b65e9682 introduced verifier learning feedback in the verifier audit path.
Commit 354f09c6fadaea0f7029dc89456d093dbf372b95 registered ULTRA_DEEP_PHASE2_VERIFICATION_LEARNING and Agent Registry V31.

## Phase-2 Controller V1
Commit db2f49fe20a648a153585ceff9f3719abd46f1b3.
File: server/kk-ultra-deep-phase2-controller.js

Contract:
1. Freeze Candidate Master Pool.
2. Require expected candidate count.
3. Require a disposition for every candidate.
4. Convert VERIFY_REQUIRED reasons into generalized learning miss classes.
5. Run Learning V6 recovery strategy.
6. Retry only unresolved verification candidates.
7. Default maximum recovery rounds: 3; hard maximum: 5.
8. Fail closed on incomplete pool, invalid disposition, missing evidence/reason, or nonzero production writes.
9. If clean: PHASE2_ACCEPTED then STOP_AND_REPORT_READY_FOR_OWNER_PHASE3_APPROVAL.
10. If bounded recovery exhausts: PHASE2_HOLD with explicit unresolved list.
11. phase3_started=false always inside this controller.

## Tests
Commit 99457067fba3d3a94d056a2019677d2dc3eac0db added tests/kk-ultra-deep-phase2-controller.test.js covering:
- verification gap -> Learning V6 recovery
- complete pool -> Phase2 accepted, stop before Phase3
- incomplete pool -> fail closed
- bounded recovery -> explicit unresolved list

Tests are written but must not be described as passed until execution evidence exists.

## Current readiness
At the last inspected PR state after commit 354f09c6, PR #642 reported mergeable=true, 26 commits, 13 changed files. This is source readiness, not CI/deployment acceptance.

Next action: run Phase 2 read-only using Verifier + Learning V6 + Phase-2 Controller V1. Report the entire frozen Candidate Master Pool, learning/recovery rounds, final dispositions, unresolved evidence, Phase2 acceptance, and whether Phase3 is ready. Do not auto-start Phase3.


## Phase boundary hardening after owner review
Commits 8b2ea7e1168fce19970872fe0cd0a74ee371b57e and 8ea0b7af534f6cc10fb9b6034b853c7c3a519bc1 add a canonical phase-handoff gate and regression tests.

The gate encodes the six owner-facing phases:
1. PHASE1 discovery
2. PHASE2 verification/dedup
3. PHASE3 commercial pricing
4. PHASE4 poster/storefront reconciliation
5. PHASE5 governed publish
6. PHASE6 production readback

No phase may claim readiness for the next phase until its report is complete. Phases 1-4 additionally require learning recovery completion where applicable. Phases 1-3 fail closed on any production write. The gate never auto-starts the next phase.

This prevents the prior failure mode where work was described as started/ready without a complete phase artifact and ensures Learning/Recovery is a first-class handoff requirement rather than an optional side process.


## Runtime wiring defect found and repaired
A follow-up runtime audit found that Agent Registry V31 declared phase2_verification_learning as runtime_available, but server/kk-agent-task-router.js had no matching execution case. That meant the route would reach the gateway and then fail as AGENT_TASK_NOT_SUPPORTED instead of running the Phase-2 Controller. This was a real orchestration defect and explains why repeated readiness statements did not produce a complete Phase-2 run.

Commit 88c9998595a35f1dc0a36d30bc8ffd2a1e850037:
- Task Router V19 -> V20
- imports kk-ultra-deep-phase2-controller.js
- wires phase2_verification_learning
- invokes both kk-event-verifier and kk-reliability-learning
- executes UltraDeepPhase2.next(input)

Commit 76f411eaa53bf383af08ac294255de8bd4efc5fb adds a routing regression test proving the task route returns PHASE2_ACCEPTED for a complete verified pool and never starts Phase 3.

Important: tests are committed but must not be described as executed/passed until runtime/CI evidence exists.


## 2026-10-05 — Phase 2 execution closure / recurring-failure repair

A deeper audit found three remaining architectural causes of repeated owner prompts:

1. **Phase-1 handoff was verbal instead of immutable.**
   Phase 2 was being asked to run without a durable exact Candidate Master Pool count/ID/fingerprint. A chat list is not acceptance evidence.
2. **The Phase-2 critical path was incorrectly moved to an unprovisioned self-hosted runner.**
   The `kk-ultra-deep` label had no proven online runner, so the job could sit queued forever. This is now a learned reliability failure and must never be used again without positive runner-availability proof.
3. **Agent route execution stopped at controller evaluation instead of always owning the live verifier/recovery runtime.**
   The Agent Gateway route now executes the canonical Phase-2 runtime when a frozen Phase-1 artifact is supplied, while controller-only evaluation is retained only for pre-materialized result fixtures.

### Repairs now in source

- `KK_ULTRA_DEEP_PHASE_ARTIFACT_V2`
  - derives deterministic Phase-1 candidate IDs;
  - preserves source provenance;
  - stores exact count, IDs and fingerprint;
  - rejects missing provenance, duplicate IDs and tampering.
- `KK_ULTRA_DEEP_PHASE1_CONTROLLER_V6`
  - cannot report owner handoff readiness unless a frozen Phase-1 artifact can be produced.
- `KK_ULTRA_DEEP_PHASE2_RUNTIME_V2`
  - consumes the exact frozen Phase-1 artifact and preserves its candidate IDs/fingerprint;
  - rejects a tampered/invalid artifact before any verification.
- `scripts/kk-ultra-deep-phase2-acceptance.js`
  - materializes and readbacks `.artifacts/ultra-deep-phase1-artifact.json` before Phase 2;
  - emits Phase-2 acceptance V2.
- `KK_ULTRA_DEEP_DIRECT_ZERO_COST_V27`
  - adds a dedicated `PHASE2_READ_ONLY` execution mode;
  - runs before storefront/SOT preflight and never enters pricing/publish;
  - permanently rejects `executeWrites=true`;
  - can reconstruct+freeze a currently accepted Phase-1 pool when no artifact was supplied.
- Authenticated Admin action `ultraDeepPhase2ReadOnly`
  - reuses the existing signed Admin/PIN boundary;
  - invokes the direct Phase-2 runtime with `executeWrites=false`;
  - enforces `production_writes=0` and `phase3_started=false`.
- Agent Task Router V21 + Agent Registry V32
  - `phase2_verification_learning` now invokes the actual Phase-2 verifier + Learning recovery runtime when given the frozen artifact.
- The duplicate unprovisioned self-hosted Phase-2 workflow was removed.
  GitHub Actions is audit/fallback only; it is no longer the operational critical path.
- Reliability memory now contains `ULTRA_DEEP_SELF_HOSTED_RUNNER_ASSUMED` so future repair logic must not repeat that infrastructure mistake.

### Current acceptance rule

Do not call Phase 2 complete from code readiness, preview READY, GitHub workflow status, or partial official-source checks.

Only the runtime result may unlock Phase 3:
`PHASE2_ACCEPTED && ready_for_phase3=true && production_writes=0 && phase3_started=false`.

Otherwise report `PHASE2_HOLD` with the exact unresolved list after bounded Learning recovery.


## 2026-10-05 — Isolated Phase 3 diagnostic preflight

Owner explicitly authorized a Phase-3 test run to find defects before the official phase boundary opens. This was executed as `diagnostic_only`; it did **not** start operational Phase 3 and did not require or fabricate `PHASE2_ACCEPTED`.

Defects found and repaired:
- competitor scanner watchlist had only 9/10 locked accounts; `faleem_rent2` was missing. Scanner V3 restores the complete 10-account universe.
- commercial prep mixed Phase-3 pricing with Phase-4 poster evidence. Prep V4 now supports `phase_scope=PHASE3_PRICING`, where missing poster cannot block pricing. Full-commercial mode still requires poster evidence.
- no explicit phase-3 boundary/controller existed. `KK_ULTRA_DEEP_PHASE3_CONTROLLER_V1` now enforces:
  - official Phase 3 requires `PHASE2_ACCEPTED && ready_for_phase3=true`;
  - diagnostic-only preflight may exercise pricing logic without opening Phase 4;
  - booked candidates are price-locked and cannot be repriced;
  - hidden/tombstoned candidates are skipped and never re-added;
  - exact-event competitor price uses package-specific median;
  - no-exact-evidence fallback order is comparable event -> prior-month comparable -> base 690/890 -> bounded demand/seat-map adjustment;
  - competitor evidence is keyed by candidate ID so prices cannot bleed between events;
  - `production_writes=0` and `phase4_started=false`.
- Agent Task Router V22 / Agent Registry V33 expose `phase3_commercial_pricing` for the isolated diagnostic and later official gated run.

Local isolated Node execution evidence:
- syntax check passed;
- 9/9 Phase-3 controller regression tests passed;
- synthetic diagnostic covered exact-market median, booked-price lock and no-market 690/890 fallback;
- diagnostic result kept `ready_for_phase4=false`, `production_writes=0`, `phase4_started=false`.

This diagnostic is not evidence that operational Phase 3 is accepted. Official Phase 3 must still wait for a real `PHASE2_ACCEPTED` artifact.


## Owner policy update — competitor universe (2026-10-05)

The competitor universe is no longer capped at 10. The existing 10 X rental accounts are protected seed coverage only. Target roughly 20 shops/accounts when credible rental evidence is discoverable; >20 is allowed, with the current scanner bounded at 50 for runtime/query control. Expanded accounts must pass rental-shop evidence checks and are read-only. Exact-event pricing uses the valid independent evidence actually found; 20 prices are not required per event.

Canonical policy: `docs/COMPETITOR_UNIVERSE_POLICY_V1_2026-10-05.md`.
