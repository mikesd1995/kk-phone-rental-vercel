# Canary Safety Acceptance Hardening — 2026-09-19

## Status

**STRUCTURAL / ZERO-WRITE EVIDENCE = PASS**

**SCENARIO-SPECIFIC ASSERTION ACCEPTANCE = FAIL-CLOSED**

**NATURAL SCHEDULER ATTRIBUTION = NOT PROVEN**

**CANARY TASK = OFF / NOT MUTATED BY THIS WORK**

## Fresh evidence

Canonical Canary task:
- ID: `6a992bbe16d081918553ca3eb7f81058`
- title: `KK Canary Safety — Enabled Suite`
- cadence: daily 08:15 Asia/Bangkok
- current state: OFF
- task registry last run remains 2026-09-14

Current `_Canary_Suite` records 68 enabled definitions whose latest run metadata points to:

`CANARY|20260918|0817|AUTO4915`

A bounded exact comparison against `_Canary_Workspace` found:
- enabled definitions: 68
- workspace rows for the run: 68
- Test IDs: nonblank and unique
- Isolation Namespaces: nonblank and unique
- enabled Test ID set == workspace Test ID set
- suite Production Writes: 0 for every definition
- workspace Actual Write Count: 0 for every row
- workspace Result: PASS for every row

These facts prove structural completeness and zero production writes for the recorded snapshot.

## Why the current 68/68 PASS cannot be accepted as strict synthetic proof

The current workspace rows use generic assertion content rather than the scenario-specific decision contract from each enabled definition.

Observed pattern:
- Input State: generic `isolated current-run scenario branch for CANARY-XX`
- Synthetic Evidence: generic `independent synthetic assertion executed from frozen ... definition`
- Expected Decision: `FROZEN_DEFINITION_BOUNDARY`
- Actual Decision: `CANARY_XX_SAFE_BRANCH_ASSERTED`

This is materially weaker than historical scenario-specific evidence such as:
- duplicate event -> `DEDUP_NO_SECOND_SHOW`
- stale fencing token -> `STALE_WRITER_REJECT`
- partial transaction -> `COMPENSATION_REQUIRED`

The canonical Canary launcher explicitly requires Actual to be derived independently and forbids mirroring Expected into PASS. Count equality plus zero-write evidence is necessary but not sufficient.

Therefore the 2026-09-18 snapshot is reclassified for audit purposes as:

`STRUCTURAL_PASS / ZERO_WRITE_PASS / ASSERTION_EVIDENCE_REJECTED / NATURAL_RUNTIME_UNATTRIBUTED`

Historical Sheet rows are not rewritten.

## Natural-run provenance gap

The task registry does not report a Sep18 natural Canary run. Searches found:
- no exact `AUTO4915` reconciliation record;
- task registry `last_run_time` still points to Sep14;
- no task-registry evidence binding the Sep18 rows to the canonical daily 08:15 launcher.

A historical cross-check strengthens the separation between workspace rows and canonical scheduler proof: Sep16 contains 68 scenario-specific Canary workspace rows at 08:15, while the later control-plane maintenance record at 08:20 explicitly records that the canonical Canary 08:15 task was OFF and that the natural runtime boundary was not proven. Therefore workspace timestamp/cardinality alone cannot establish scheduled-task provenance.

`_Run_Lock` is useful forensic evidence for control-plane maintenance, but the canonical Canary launcher does not define a Canary runtime lock as a mandatory execution gate. The acceptance auditor therefore does **not** invent a mandatory Canary `_Run_Lock` requirement.

Accordingly, the Sep18 workspace evidence must not be called a proven natural scheduled run.

This does not prove who or what produced the rows. Actor/mechanism remains UNKNOWN.

## Executable acceptance contract added

`server/canary-acceptance.js` separates four gates:

1. **Structural completeness**
   - enabled Test IDs exact/nonblank/unique
   - Isolation Namespaces exact/nonblank/unique
   - enabled count == workspace count
   - exact Test ID set equality
   - one run identity

2. **Scenario-specific assertion evidence**
   - workspace Expected Decision must bind to the definition Expected Result
   - generic `FROZEN_DEFINITION_BOUNDARY` is rejected
   - generic `CANARY_XX_SAFE_BRANCH_ASSERTED` is rejected
   - Input State and Synthetic Evidence must be scenario-specific
   - Actual cannot simply copy Expected text
   - synthetic entity must bind to the definition isolation namespace

3. **Zero production writes**
   - suite Production Writes exact 0
   - workspace Actual Write Count exact 0
   - explicit `PRODUCTION=0` boundary

4. **Natural runtime attribution**
   - exact canonical task ID and title
   - task proven ON immediately before and after the natural occurrence
   - scheduled occurrence timestamp bound to the recorded run window
   - task registry `last_run_time` bound to that same run window
   - run ID bound to the audited snapshot
   - optional lock/reconciliation evidence may be recorded for forensics but is not a Canary execution requirement unless a later active policy explicitly makes it one

Synthetic proof and natural-scheduler proof are deliberately separate.

The auditor always keeps:
- `production_or_provider_proof=false`
- `production_cutover_authorized=false`

## CLI

`npm run audit:canary -- <snapshot.json>`

The JSON snapshot is intentionally external to the repository so private Machine-SOT rows and credentials are not committed.

## Safety boundary

This hardening:
- does not enable Canary;
- does not edit historical Canary Suite/Workspace results;
- does not create a synthetic run;
- does not mutate Scanner/Verifier;
- does not write booking/event/pricing/customer/provider state;
- does not send LINE/Telegram/X;
- does not enable HF/Make/Cloudflare;
- does not turn synthetic PASS into production/provider proof.

A future Canary run must produce scenario-specific assertion evidence before receiving synthetic acceptance. Natural scheduler credit additionally requires canonical task identity/state and scheduled-window attribution; a workspace timestamp by itself is insufficient.
