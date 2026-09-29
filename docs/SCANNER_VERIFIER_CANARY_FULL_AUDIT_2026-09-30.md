# Scanner / Verifier / Canary Full Contract Audit — 2026-09-30

## Scope
This audit is limited to the governed Scanner / Verifier / Canary control plane. It does not execute an October ultra-deep scan, change pricing, modify Private Reader, or mutate storefront/business data.

## Invariants reviewed
- one governed runner path; no replacement scheduler introduced
- shared + role lock fencing and exact runtime identity
- strict monotonic fence contract
- Scanner Manifest terminal/readback evidence
- Scanner `_Run_Coverage >= 1` owned by the same runtime
- Scanner staging-only / authoritative=false / verifier_required=true
- READY_FOR_VERIFIER operational queue anchored in `_AI_Inbox`
- deterministic Candidate join and no-drop reconciliation
- persistent owner-hidden tombstone / anti-recreate contract
- Verifier immutable Manifest readback
- Canary isolated scenario evidence and production writes = 0
- fail-closed acceptance; no synthetic evidence promoted to production proof

## Findings and hardening

### 1. Canonical GLOBAL lock aliases were not accepted by the generic control-plane auditor
The generic runtime auditor filtered exact legacy scope names `CORE`, `SCANNER`, and `VERIFIER`. Current policy and adjacent Scanner contracts also use `CORE_SHARED_WRITER`, `SCANNER_GLOBAL`, and `VERIFIER_GLOBAL`.

Risk: a valid live runtime using canonical GLOBAL scope names could be misclassified as missing/ambiguous by the acceptance auditor.

Fix: add explicit role-scoped aliases:
- CORE -> `CORE` or `CORE_SHARED_WRITER`
- SCANNER -> `SCANNER` or `SCANNER_GLOBAL`
- VERIFIER -> `VERIFIER` or `VERIFIER_GLOBAL`

No cross-role aliasing is allowed.

### 2. Scanner persistence credit did not require owned _Run_Coverage evidence
The Scanner occurrence gate already required due-work and exact Planner readback, but did not independently require at least one `_Run_Coverage` row owned by the same runtime.

Risk: persistence acceptance could be awarded while the required coverage evidence was absent.

Fix: Scanner role-specific acceptance now fails closed when:
- `scanner_run_coverage` evidence is missing; or
- no coverage row belongs to the exact runtime run ID.

This enforces the pinned `_Run_Coverage >= 1` invariant at the same acceptance boundary that grants persistence credit.

## Existing controls confirmed
- strict fence uses max+1
- unresolved PREPARED/COMMITTING transactions block acceptance
- lock release exact-read is required
- Verifier READY queue requires nonblank Work Packet ID + READY_FOR_VERIFIER
- Candidate rows are joined by exact Show ID first, then exact family+date
- tombstone/SEEN_CORE history prohibits automatic recreate/reopen
- Canary requires frozen definitions, unique isolation namespaces, scenario-specific independent evidence, trusted evidence surface, and zero production writes
- Canary synthetic acceptance never authorizes production cutover

## Safety
- production writes: 0
- business-data mutations: 0
- scheduler/task mutations: 0
- no backfill
- no manual runtime fabrication
- no October scan execution
