# KK Phone Rental — Runtime Observer Live Application Report

Date: 2026-09-10 Asia/Bangkok
Branch: `integration/ai-engineering-model-v1`
Scope: read-only application to live runtime evidence + development-plane contract hardening
Production business writes by this work: 0
Current development evidence gate: `KK-G3 CI_PASS`
Current live-system classification from Machine SOT: `SAFE_DEGRADED_NOT_FULLY_CERTIFIED`

## Objective

Apply the new KK-native `kk-runtime-observer` and `kk-investigate` contracts to real natural Scanner/Verifier evidence, preserve strict evidence-layer semantics, fix any defect exposed by the application, add regression coverage, and persist the result without auto-repairing production business state.

## Fresh authority snapshot

Fresh live reads before code mutation confirmed:

- Machine SOT timezone: `Asia/Bangkok`.
- Highest Active `_Policy_Registry`: `v4.9.14 RUNTIME RECALL & MULTI-ROUTE HARDENING`, exact current authority.
- Canonical recurring task IDs remained the existing Scanner, Verifier and Canary IDs; no replacement runner/watchdog was created.
- Latest live reconciliation classified the system as safe but degraded, with transaction/lock/Canary/Make health distinct from scheduler/runtime reliability debt.

## Real occurrences evaluated

### Scanner 14:00

- Run: `SCV414-20260910T140222-SCHEDULED-1400`
- Manifest: row 5073
- Lease/fence: v266 / `SC-414-20260910T140222-266`
- Machine-SOT runtime boundary: PROVEN
- Terminal: `FINISHED_PARTIAL`
- Lease: RELEASED
- Actual source coverage: 8
- Work included missed-pack catch-forward, K-LIVE new Candidate+AI staging and Mr Fanboy material enrichment.
- After the run, the exact canonical Scanner task was observed OFF and was re-enabled unchanged.
- Strict occurrence result: `INCIDENT / TASK_DISABLED_AFTER`.

### Verifier 14:30

- Run: `GPTV414-20260910T143000-SCHEDULED-1430`
- Manifest: row 5074
- Lease/fence: v256 / `VF-414-20260910T143000-256`
- Machine-SOT runtime boundary: PROVEN
- Terminal: `FINISHED_PARTIAL`
- Processed: 1; held: 0; remaining READY: 25
- The K-LIVE packet was committed with exact readback.
- After the run, the exact canonical Verifier task was observed OFF and was re-enabled unchanged.
- Strict occurrence result: `INCIDENT / TASK_DISABLED_AFTER`.

### Scanner 15:00

- Run: `SCV414-20260910T150156-SCHEDULED-1500`
- Manifest: row 5075
- Lease/fence: v267 / `SC-414-20260910T150156-267`
- Machine-SOT runtime boundary: PROVEN
- Terminal: `FINISHED_PARTIAL`
- Actual source coverage: 9
- Work included Fino material time update, JAN JINGJING ticket-sale update and bounded competitor signals.
- After the run, the exact canonical Scanner task was again observed OFF and was re-enabled unchanged.
- Strict occurrence result: `INCIDENT / TASK_DISABLED_AFTER`.

### Verifier 15:30

- Task-control metadata advanced to approximately 15:33:35 Asia/Bangkok and the task was enabled after controlled re-arm.
- No canonical 15:30 Verifier `_Run_Lock` or `_Run_Manifest` boundary was visible through the 15:46 system-closure read.
- Latest Machine-SOT Verifier runtime proof therefore remained the 14:30 occurrence.
- Strict occurrence result: `INCIDENT / LAUNCHER_FIRED_RUNTIME_BOUNDARY_MISSING`.
- No fake backfill or manual business mutation was used to manufacture runtime proof.

## Contract defect discovered by live application

The original `kk-runtime-observer` treated any expected occurrence with no Machine-SOT runtime after grace as `SCHEDULER_NOT_FIRED`.

That taxonomy was too coarse for the real 15:30 Verifier evidence: task-control metadata showed the launcher fired, but the governed Machine-SOT runtime boundary was absent. Calling this `SCHEDULER_NOT_FIRED` would collapse two distinct evidence layers and misdirect root-cause investigation.

### Repair

The observer now separates:

1. `launcher_trigger_observed` — control-plane task/launcher evidence;
2. `runtime_observed_at_ms` — governed Machine-SOT runtime-boundary evidence.

New P0 classification:

`LAUNCHER_FIRED_RUNTIME_BOUNDARY_MISSING`

This means:

- no launcher evidence + no runtime after grace => `SCHEDULER_NOT_FIRED`;
- launcher evidence exists + no Machine-SOT runtime after grace => `LAUNCHER_FIRED_RUNTIME_BOUNDARY_MISSING`;
- Machine-SOT runtime exists => evaluate full runtime acceptance and post-run task state independently.

The observer also now emits:

- `control_plane_trigger_observed`;
- `machine_sot_runtime_observed`;
- `evidenceLayerSummary()` with launcher count, Machine-SOT runtime count, launcher-only gap count and runtime-boundary ratio.

Backward compatibility for legacy `observed_at_ms` inputs is preserved.

## Persistent regression added from real evidence

Added:

`scripts/kk-runtime-live-evidence-regression.test.js`

The fixture explicitly records the Sep 10 evidence snapshot as immutable historical regression data, not a live connector. It asserts:

- Scanner 14:00 => Machine-SOT runtime proven, but strict acceptance fails only on `TASK_DISABLED_AFTER`;
- Verifier 14:30 => same separation;
- Scanner 15:00 => same separation;
- Verifier 15:30 => launcher observed but runtime boundary absent, classified as `LAUNCHER_FIRED_RUNTIME_BOUNDARY_MISSING`;
- transaction/lock/handoff closure may be healthy while scheduler reliability remains degraded;
- `kk-investigate` keeps the 15:30 incident at `MITIGATED_ROOT_CAUSE_OPEN`;
- actor remains `UNKNOWN` without actor evidence;
- permanent/root-cause fix is denied until mechanism proof exists.

## Captured-window metrics

For the four evaluated expected occurrences:

- control-plane trigger evidence: 4/4;
- governed Machine-SOT runtime boundary: 3/4 = 75%;
- launcher-only runtime gaps: 1;
- strict full-occurrence acceptance: 0/4 because all four contain a P0 reliability defect (three post-run task-disable recurrences plus one launcher/runtime-boundary gap).

The strict 0% result does **not** mean the Scanner/Verifier data plane failed in all four cases. Three occurrences produced real governed runtime and safe terminalization. The strict metric intentionally includes post-run control-plane persistence because an hourly production runner is not reliable if it runs once and silently disables afterward.

## Other live-system health observed

At the latest live system-closure checkpoint:

- unresolved `PREPARED`: 0;
- unresolved `COMMITTING`: 0;
- active orphan Scanner/Verifier locks: 0;
- Candidate READY and operational AI READY were reconciled at 26 after the 15:00 Scanner staging;
- Canary current enabled suite: 39 tests PASS, Production Writes=0;
- Make `6176241` current resource-pause blocker was re-tested and is currently recovered: active scenario, healthy Google/Telegram connections, successful automatic executions and successful zero-queue manual smoke; no outbound message was sent because eligible Ledger queue was empty.

This separates current scheduler/runtime reliability debt from transaction, safety and Make transport health.

## Remaining live debt

The work intentionally did not auto-repair or erase these facts:

- Scanner original 06:00 / 09:00 / 12:00 dedicated occurrences remain historical misses; later catch-forward does not rewrite them as PASS.
- Direct social/media/cardinality/Critical-source redundancy and some due-source debt remain explicit under v4.9.14.
- Post-run task-off recurrence root cause remains `UNKNOWN`.
- Verifier 15:30 launcher/runtime-boundary gap remains open.
- A clean Scanner+Verifier soak has not begun from a proven stable scheduler baseline.

## Development-plane changes

Commits in this hardening sequence:

- `ff8862b8bb484e4479c8465d10a532ffe1ad366c` — add P0 severity for launcher-fired/runtime-boundary-missing;
- `1184a38ef65abf632c71585326e68c37cc4781d6` — separate launcher and Machine-SOT runtime evidence layers;
- `a13fe80c9f075b6d7fc63f41231df9daa84aa1d5` — extend observer regression coverage;
- `6c0cf5fdc9bb96cd067922825343550d1830206a` — add real Sep 10 runtime-evidence regression;
- `b7589781d5e6896a2a863c3a829b5d6d414e9c7c` — wire real-evidence regression into governed checks.

No production scheduler/task mutation was performed by these GitHub changes.

## CI evidence

`KK Governed Checks` run `34457875130` / run #109 completed `SUCCESS` on the code-bearing head.

Affected/current suites include:

- `kk-runtime-acceptance-contract: 41/41 PASS`
- `kk-third-party-agent-guard: 27/27 PASS`
- `kk-investigate-contract: 22/22 PASS`
- `kk-runtime-observer-contract: 34/34 PASS`
- `kk-invariant-review-contract: 25/25 PASS`
- `kk-runtime-live-evidence-regression: 27/27 PASS`

All pre-existing governed suites in the same chain also passed.

The initial report-only head `93d1ba5d10822f5ffeee9e78b78fbfbe26017671` was then rechecked by `KK Governed Checks` run `34458088224` / run #110 and also completed `SUCCESS` before this evidence note was appended.

Classification: `KK-G3 CI_PASS` for the development-plane observer hardening. This is not a claim that the live scheduler is `RUNTIME_PASS` or `PRODUCTION_STABLE`.

## Operational conclusion

The new workflow is now useful against real incidents and exposed a taxonomy defect that synthetic-only testing had not caught. That defect has been repaired and permanently regression-covered.

The evidence also crosses the previously defined escalation threshold: after launcher hardening/re-enablement, multiple natural Scanner/Verifier runs produced governed runtime and then the same canonical task was observed OFF again. More prompt hardening or a watchdog is therefore not a credible permanent solution.

The next engineering step should be a **controlled scheduler migration design and cutover contract**, while keeping the current canonical tasks as the only production writers until a staged, single-authority handoff is explicitly proven safe. Do not create a competing production scheduler before that cutover contract exists.
