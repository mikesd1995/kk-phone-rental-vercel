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


## V2.1 owner requirements — implemented 2026-10-04
PR #603 merged as `af4e2a0a45055b6017833d81e3f168455266d846`.

### Booking behavior corrected
Booking no longer freezes the whole event. Any booking locks PRICE only. Verified official date, venue and poster changes remain eligible for update. Hidden/tombstone still overrides everything.

### Poster fallback clarified
Competitor storefront/poster URLs may be collected as poster discovery leads when an exact-event competitor listing exists, but they do not satisfy verification by themselves. A new event remains HOLD until the poster is independently verified as artwork for the exact event. No random/near-match image publish.

### Long-tail coverage expanded
Monthly query plan V4 defaults to Bangkok Metropolitan Region and explicitly covers: concerts, fanmeet/fancon, showcase/mini concert/festival, organizer/promoter feeds, malls/community venues, fan gatherings/birthday projects, blessing ceremonies/openings, award/red-carpet events, press/brand appearances, sports/entertainment, social signals, competitor listings and public calendars. Geographic variants include Bangkok, Nonthaburi, Pathum Thani and Samut Prakan. Search stop condition now requires exhausting bounded variants and recording receipts rather than stopping after the first HTTPS source.

### Adaptive learning agent added
`server/kk-ultra-deep-v2-learning-agent.js` learns from missed events, false positives, HOLD reasons, source successes and manual corrections. It may automatically adapt query terms, source priority and matching heuristics and emits a change log/recommendations. Protected policy cannot be self-modified: BOOKING_PRICE_LOCK, TOMBSTONE_NO_RESURRECTION, GOVERNED_ADMIN_WRITER_ONLY, EXACT_READBACK_REQUIRED, VERIFIED_EVENT_REQUIRED. Learning agent production writes = 0.

### Regression coverage
Tests now lock: booked price immutability with metadata updates; tombstone precedence; median repricing for unbooked events; competitor poster lead cannot bypass verification; verified create pricing; exact-readback COMPLETE gate; learning boundary; long-tail Bangkok-metro query tiers.

### Production status
PR #603 changes planning/discovery/learning code only. Production business writes = 0. Live V2 discovery-to-writer wiring and production acceptance remain pending; do not call V2 production COMPLETE yet.


## V2.2 commercial qualification — implemented 2026-10-04
PR #604 merged as `2440b360c5441e892385bf79536fc714c3160d11`.

### Rentability gate
Discovery remains broad, but an event is not automatically storefront-worthy. New `server/kk-ultra-deep-rentability-score.js` scores 0-100 with baseline weights: Fandom Strength 30, Social Demand 25, Rental Intent 20, Commercial Evidence 15, Event Quality 10. Bounded boosts: sold-out/added round +5, high engagement velocity +5, multiple competitor rental listings +5, strong fan-project signal +3. Baseline tiers: HIGH >=70, MEDIUM 50-69.9, LOW <50.

Qualification decisions: HIGH => FULL_LOOP; MEDIUM => VERIFY_MORE; LOW => WATCH. Verified competitor-rental/strong commercial evidence may promote into FULL_LOOP. This is a commercial candidate gate, not a verification bypass.

### Revenue + capacity
Revenue potential tracks demand score, booking probability, expected rental price and available inventory. available_inventory=0 => NO_CAPACITY before commercial execution. This prevents broad discovery from turning the storefront into a generic event calendar and prioritizes work that can plausibly create rental revenue.

### Adaptive scoring
Learning agent now consumes booking/revenue outcomes and may recalibrate RENTABILITY_WEIGHTS and HIGH_MEDIUM_THRESHOLDS in addition to source/query/matching strategy. Every scoring change must be versioned, record before/after, retain evidence, and be rollback-capable. Protected policy remains immutable to the learner.

### Intended V2 pipeline
DISCOVER_BROAD -> RENTABILITY_SCORE -> REVENUE_POTENTIAL -> CAPACITY_CHECK -> VERIFY -> CANONICAL/BOOKING/TOMBSTONE -> PRICE/POSTER -> PLAN -> GOVERNED_WRITE -> EXACT_READBACK -> STOREFRONT_QA -> BOOKING/REVENUE_OUTCOME -> LEARN.

### Acceptance status
Implementation and regression cases are committed/merged, but connector-side editing does not itself prove Node tests or live production execution. Production business writes from this change = 0. Do not call Full Loop production COMPLETE until live wiring + acceptance evidence exists.
