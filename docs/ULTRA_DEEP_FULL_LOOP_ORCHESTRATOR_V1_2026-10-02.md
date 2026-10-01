# Ultra Deep Full Loop Orchestrator V1 — 2026-10-02

## Problem closed
Monthly Ultra Deep discovery was callable, while commercial preparation, pricing, storefront promotion, existing-event maintenance, readback and completion acceptance were separate calls. That allowed a scan to start without one machine-enforced execution path to COMPLETE.

## New execution route
`execute_ultra_deep_full_loop` is registered through Agent Registry/Task Router and runs candidate reconciliation through owner policy, commercial evidence, final pricing, governed promotion/update planning, exact readback evidence and the existing completion gate.

## Owner rules enforced before mutation
- hidden/tombstoned event: skip, never recreate;
- any date with a live booking: skip repeat discovery/mutation;
- booking + remaining stock therefore never triggers automatic repricing;
- existing events without bookings: compare fresh exact-event competitor evidence and plan price alignment;
- verified changed official poster: plan poster refresh;
- no fresh market evidence: no invented repricing;
- create still uses the existing governed storefront executor;
- existing-event price/poster writes must be supplied through the existing Admin writer boundary and count only after exact readback.

## Safety
Scanner remains zero-write. No second business writer is introduced. The orchestrator does not treat a mutation plan or HTTP success as completion. Missing writer/readback leaves the event UPDATE_READY/INCOMPLETE and the completion gate stays closed.

## Regression evidence
`tests/kk-ultra-deep-full-loop-orchestrator.test.js` covers owner-hidden no-resurrection, booking-date skip, market repricing + poster plan, and readback-gated write accounting.

## Remaining runtime boundary
A secret-bearing runtime must provide the existing-event Admin writer and storefront readback functions. If unavailable, the orchestrator intentionally stops before mutation rather than bypassing Admin auth.
