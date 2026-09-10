# KK Phone Rental — Runner Reliability Specification v1

Status: DEVELOPMENT CONTRACT
Scope: canonical Scanner, Verifier, and Canary runtime acceptance
Mutation scope: none; this specification does not create, enable, disable, reschedule, or repair production runners

## 1. Problem statement

A scheduled task being configured or enabled is not sufficient evidence that a KK production runner executed correctly. KK has observed incidents where scheduled occurrences were missing, tasks later appeared disabled, manual rescue obscured the original missed occurrence, and runtime artifacts could disagree across locks, manifests, transactions, Candidate, AI, and monthly projections.

The reliability contract therefore measures **expected runtime vs observed governed runtime**, not merely task metadata.

## 2. Natural-run proof

A natural scheduled occurrence is accepted only when all required boundaries are proven for the same runner/run identity:

`Expected boundary -> scheduled trigger -> canonical lease -> strictly monotonic fence -> exactly one manifest -> manifest frozen before mutation -> actual work or justified governed no-op -> exact readback -> terminal manifest -> lease released`

For Verifier, transaction and Candidate/AI closure must also be consistent where applicable.

Manual/owner-triggered runs may be useful for recovery but never backfill or convert a missed scheduled occurrence into natural-run proof.

## 3. Required runtime fields

A runtime observation should provide, where applicable:

- `runner_type`
- `runner_id`
- `run_id`
- `expected_occurrence`
- `manual_trigger`
- `task_enabled_before`
- `task_enabled_after`
- `scheduled_trigger_observed`
- `lease_acquired`
- `lease_version`
- `previous_lease_version`
- `duplicate_fence_observed`
- `manifest_count`
- `manifest_frozen_before_mutation`
- `actual_runtime_evidence_count`
- `legitimate_noop`
- `terminal_manifest`
- `lease_released`
- `unresolved_prepared_committing`
- `candidate_orphans`
- `ai_orphans`
- `unauthorized_outbound_claim`

Missing evidence is not assumed true.

## 4. Failure taxonomy

The first pack uses these exact incident codes:

- `SCHEDULER_NOT_FIRED` — expected natural occurrence has no scheduled trigger/runtime chain;
- `TASK_DISABLED_BEFORE` — canonical task is disabled before the expected boundary;
- `TASK_DISABLED_AFTER` — task becomes disabled after an otherwise attempted run;
- `MANUAL_RUN_NOT_NATURAL_PROOF` — manual recovery is being presented as scheduled proof;
- `LEASE_NOT_ACQUIRED` — no canonical writer lease for an expected run;
- `NON_MONOTONIC_FENCE` — current lease/fence version is not strictly greater than the previous version;
- `DUPLICATE_FENCE` — competing same-scope writer/fence identity observed;
- `MANIFEST_COUNT_NOT_ONE` — zero or multiple manifests for a protected occurrence;
- `MANIFEST_NOT_FROZEN_PRE_MUTATION` — manifest was not frozen before governed mutation;
- `NO_RUNTIME_EVIDENCE` — no actual work and no legitimate governed no-op evidence;
- `MANIFEST_NOT_TERMINAL` — run did not close to an honest terminal state;
- `LEASE_NOT_RELEASED` — writer lease remained active after terminal work;
- `UNRESOLVED_TRANSACTION` — PREPARED/COMMITTING transaction debt remains;
- `CANDIDATE_ORPHAN` — Candidate operational state lacks required matching AI lineage;
- `AI_ORPHAN` — AI operational state lacks required matching Candidate lineage;
- `UNAUTHORIZED_OUTBOUND_CLAIM` — runtime claims/sends outbound action without authorized provider evidence.

Severity defaults:

- P0: scheduler/task/lease/fence/manifest integrity, unauthorized outbound;
- P1: transaction or Candidate/AI closure defects;
- P2: non-critical reporting/metadata defects that do not alter business truth.

The severity mapping can be raised by live policy; it must not be silently lowered by this document.

## 5. Runtime acceptance algorithm

A natural occurrence is `PASS` only when:

1. the occurrence is expected and not manual;
2. the canonical task is enabled before the boundary;
3. the scheduled trigger is observed;
4. canonical lease is acquired;
5. fence is strictly monotonic and unique;
6. exactly one manifest exists;
7. the manifest is frozen before mutation;
8. actual runtime evidence exists, or an explicitly governed legitimate no-op exists;
9. manifest is terminal;
10. lease is released;
11. unresolved PREPARED/COMMITTING count is zero;
12. Candidate and AI orphan counts are zero for the run’s closure scope;
13. no unauthorized outbound claim exists;
14. the canonical task remains enabled after the run unless current policy explicitly requires otherwise.

Any failed invariant returns `FAIL` with exact reason codes. There is no optimistic default.

## 6. SLI and SLO

### Runner execution SLI

`valid natural occurrences / expected natural occurrences`

Initial target for both Scanner and Verifier:

- rolling target: `>= 99%`;
- incident threshold: any P0 failure opens an incident immediately even if the rolling SLI remains above target.

Canary has a lower execution frequency, so a single missed required occurrence is material and should be investigated directly rather than hidden inside a long rolling ratio.

### Closure SLI

For Verifier:

`eligible packets terminalized within governed SLA / eligible packets due within SLA`

This is separate from execution SLI. A runner can launch successfully and still fail business closure.

## 7. Soak acceptance

One successful run is evidence of a successful run, not long-term stability.

Minimum pre-stability soak for Scanner and Verifier:

- at least 6 consecutive natural accepted occurrences per runner;
- zero manual rescue inside the measured sequence;
- zero P0 incidents;
- zero stale ACTIVE leases;
- zero unresolved PREPARED/COMMITTING transactions after closure;
- zero Candidate/AI orphans attributable to the measured runs;
- zero false `FULL`, `FINISHED`, `PASS`, `SENT`, or provider claims.

Preferred production-stability evidence is 24 hours of natural operation without manual rescue. Longer 72-hour evidence may be used before widening third-party automation authority.

## 8. Incident response flow

`Detect -> classify -> preserve evidence -> contain/mitigate -> root-cause investigation -> bounded repair -> deterministic regression -> natural retest -> soak -> close -> retro`

Mitigation must be labeled separately from root-cause closure. Re-enabling a task after it disabled itself is mitigation unless the transition mechanism has been identified and corrected.

## 9. Expected observer behavior

The observer/acceptance logic must be read-only against production truth. It may compute pass/fail/SLI/incident classification from live evidence, but it must not:

- fabricate missing manifests;
- backfill missed runs as PASS;
- auto-enable/disable/reschedule tasks;
- acquire production writer locks;
- mutate Candidate/AI/monthly/lifecycle/pricing;
- send owner/customer/provider messages solely to create proof;
- create duplicate canonical runners or watchdogs.

Repair is a separate explicitly authorized action.

## 10. Failure-mode matrix

| Boundary | Failure mode | Detection | Recovery owner | Retry rule |
|---|---|---|---|---|
| Scheduler -> Runner | task disabled / trigger absent | expected occurrence has no natural proof | control-plane repair lane | no retroactive PASS |
| Runner -> Lock | lease not acquired | missing canonical lease | runner/control-plane lane | retry only under policy and no active writer |
| Lock -> Fence | duplicate/non-monotonic fence | version/readback invariant | protected-writer recovery lane | fail closed |
| Fence -> Manifest | manifest zero/multiple | exact-count check | runner recovery lane | no mutation until exact1 |
| Manifest -> Work | no governed runtime evidence | coverage/work readback | runner lane | legitimate no-op must be evidenced |
| Work -> Transaction | PREPARED/COMMITTING leak | transaction scan | verifier/writer recovery | idempotent recovery only |
| Verifier -> Candidate/AI | orphan/mirror drift | lineage reconciliation | verifier recovery | repair exact keyed lineage only |
| Terminal -> Lease | lease stays active | terminal + lease readback | control-plane recovery | release only exact owned lease |
| Provider boundary | claimed send without ACK | Ledger/provider readback | transport lane | retry via canonical retry state only |

## 11. Release decision

Runner subsystem may claim:

- `IMPLEMENTATION_PASS` when this deterministic contract and tests pass;
- `CI_PASS` when governed CI passes on the exact relevant head;
- `RUNTIME_PASS` only for individually accepted natural occurrences;
- `PRODUCTION_STABLE` only after the required soak criteria are met.

No repository test can manufacture `RUNTIME_PASS` or `PRODUCTION_STABLE`.

## 12. First deployment rule

This specification and its contract/tests are development-plane only. Production scheduler changes require a separate live-authority read, exact canonical task identity, writer/lock conflict check, and explicit operational action. The first implementation slice intentionally does not modify the scheduler.
