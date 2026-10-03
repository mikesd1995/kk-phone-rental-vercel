# Ultra Deep Full Loop V2 — Canonical Handoff (2026-10-04)

## Decision
Legacy Ultra Deep orchestration is frozen for feature expansion. Do not create V28/V29 or add more control-plane layers. V2 is the forward path: a small single-pipeline planner that reuses proven discovery/verifier/evidence/writer capabilities but keeps planning independent from CI/Make orchestration.

## Implemented
PR #602 merged to main as `dba74b5f4ea38d02fc07815902cbb799d27b2c56`.

Files:
- `server/kk-ultra-deep-full-loop-v2-policy.js`
- `server/kk-ultra-deep-full-loop-v2.js`
- `tests/kk-ultra-deep-full-loop-v2.test.js`

## Locked V2 policy
1. Hidden/tombstoned event => `SKIP_HIDDEN`; no create/update.
2. ANY booking_count > 0 => `SKIP_BOOKED`; no repricing. This intentionally fixes the legacy owner-policy gap that only locked price when booking_count > 0 AND stock_remaining > 0.
3. Existing unbooked event with fresh exact-event competitor prices => target exact median.
4. Verified official date change => explicit `UPDATE_DATE`.
5. Verified official venue change => explicit `UPDATE_VENUE`.
6. Verified official artwork change => explicit `UPDATE_POSTER`.
7. New event requires exact-event verification + verified HTTPS official poster + safe price.
8. New-event price uses fresh exact-event competitor median first; governed fallback only when no market median exists.
9. Planner performs zero production writes. Writer authority remains `GOVERNED_ADMIN_ONLY`.
10. COMPLETE requires plan READY + writer COMPLETE + production_writes == planned_mutation_count + exact readback.

## Regression tests added
- booking locks price even when stock_remaining = 0
- tombstone beats create
- unbooked event reprices to median
- new event without verified poster HOLDs
- verified new event creates at median
- COMPLETE impossible without exact readback

## Why V2
The previous system accumulated execution dependencies (Actions scheduling/quota, command bridge, deployment promotion, Make/TinyFish alternatives) that obscured the actual business loop. V2 separates business planning from execution infrastructure and produces deterministic mutation intents. It does not weaken production governance.

## Current limitations / next implementation
V2 currently owns policy + deterministic mutation plan + acceptance contract. It is NOT yet wired to live monthly discovery/verifier/competitor evidence nor to the governed Admin writer. Do not call it production complete.

Next:
1. Adapter: Runtime.runMonthlyUltraDeep -> verified normalized V2 candidates.
2. Join candidates against fresh canonical snapshot: exists/hidden/tombstone/booking_count/current price/date/venue/poster.
3. Attach exact competitor evidence + verified poster/date/venue evidence.
4. Build V2 plan.
5. READ_ONLY report first; require zero writes and no HOLD for commit set.
6. Map V2 mutations to existing governed Admin writer only.
7. Fresh canonical/storefront readback.
8. V2.acceptance must return COMPLETE.
9. Record exact event decisions and write/readback evidence in Issue #368.

## Safety
No production business data was changed by PR #602. Production writes from this V2 implementation step = 0.
