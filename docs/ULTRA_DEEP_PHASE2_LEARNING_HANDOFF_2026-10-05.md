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
