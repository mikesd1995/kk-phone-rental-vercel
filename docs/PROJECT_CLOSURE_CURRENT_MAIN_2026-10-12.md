# Closure integration on current main — 2026-10-12

## Source scope

Integrates closure/recall candidate4619a03bc1c8b19792c4332759d95d5c997d84bc with main56714eb709131647babb87c6758b5c0a967fe5fe on separate branch fix/closure-current-main-20261012. Existing PR681/695 changes are consolidated; protected main is unchanged.

Incoming main adds deployment footprint controls (#693), no-deposit booking admission (#699), and Hero V6.32 (#701). Preserve those implementations byte-for-byte. The only new authored functional-test changes align three stale expectations with the merged contracts: new-booking payment select contains only unpaid/receive-at-handover, and two exact CSS cache-marker checks require V6.32. No new UI implementation or pricing/receipt change.

## Verification

Planner forecast clean integration, confirmed by merge. First full local run:1505 passed/3 failed; all failures were obsolete UI/source expectations. Final Windows full regression1508/1508 passed, zero skipped, with existing offline network guard inherited by test subprocesses through NODE_OPTIONS. npm run postinstall and npm run check exit0. Incoming Admin/UI/package/deployment/no-deposit paths compared byte-identical with origin/main. Logs retained outside repo in outputs/closure-current-main-*2026-10-12.*. Independent review is recorded in the final handoff.

These checks establish source integration only; no live rollout, rendered UI acceptance or complete business cycle is certified by them.

## Current live boundary correction

GET /api/kk-scanner-dispatch reports external/machine ingress disabled and runtime-ledger bindings absent. This does NOT establish that the canonical scheduled Scanner/Verifier is disabled. Fresh Tracker highest global Active policy remains v4.9.44; row556 binds Scanner6ab272b36b1881919577ff3367fa8245 and Verifier6ab7e060fa788191b5f17a7028494c3a. Do not activate a competing Vercel ingress to compensate for an unverified canonical task.

Bounded _Run_Manifest A1:H5700 search for ISO2026-10-12 returned0matches (not truncated). This is a bounded absence observation, not proof that all manifests/date formats or actual scheduled executions are absent. Task enabled state/natural execution remain UNKNOWN until exact bound-task state and lock/manifest/output evidence are read together.

Exact old-head PR695 job114702367865 still did not start: GitHub annotation says account payment failed OR spending limit needs increase. This is a capacity/account blocker, not a test failure. New-head CI must be read separately; no billing changes, substitute runner or repeated reruns.

## Closure acceptance sequence

1. Exact integrated-head hosted checks and independent review; obtain owner approval before protected merge/production release.
2. Fresh deployment/source/rollback binding and controlled release readback. Confirm no-deposit admission and existing visibility locks preserved.
3. Canonical Scanner/Verifier natural-slot evidence: task identity/state, exact lock/manifest, per-source executed receipts, Verifier handoff and output readback. Measure held-out recall and per-stage rejected/hidden/missing dispositions; never equate source test count with live recall.
4. Refresh bound Apps Script source/hash; date-helper candidate must apply only if the live helper still reproduces the documented date failure. Editor save affects installed trigger HEAD. No wholesale replacement or speculative cleanup rerun.
5. Booking reconciliation and real lifecycle evidence: exact booking ID, Master/Archive/Stats lineage, actual receipt vs booked price, pickup/return and availability restoration. Earlier450/450/690 readback is historical and must not be re-invented or credited as a write in this turn.
6. Two date holds remain separate from poster work: PaseoOct17 and VVV GO WholesaleOct30 require organizer-date evidence. Six temporary-image events were already live/browser-verified earlier Oct12; original poster upgrades deferred by owner. Do not reopen SIAM HalloweenNov1 owner lock.

Project remains OPEN until those production/business acceptance requirements are satisfied. Source integration is an actionable release candidate, not release authorization.
