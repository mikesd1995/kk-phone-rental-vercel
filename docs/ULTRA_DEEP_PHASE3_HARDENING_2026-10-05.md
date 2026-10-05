# Ultra Deep Phase 3 Hardening — 2026-10-05

## Scope

This document is the canonical cross-chat handoff for Phase 3 Commercial/Pricing hardening performed after the owner authorized an isolated Phase-3 diagnostic before official Phase 2 acceptance.

No operational Phase 3 was started. All changes remain read-only and preserve:
- `production_writes=0`
- `phase4_started=false`
- no poster/storefront/publish mutation
- no automatic crossing of the Phase 2 → 3 or Phase 3 → 4 boundaries.

## Defects proven during diagnostic

1. Phase 3 accepted a summary-style Phase-2 gate without an immutable exact candidate handoff.
2. Competitor evidence without an event/candidate key could bleed across events.
3. Competitor evidence had no trustworthy freshness gate; `observed_at` could be confused with source publication time.
4. Generic price parsing could interpret model numbers, deposits, lens add-ons or unrelated money as rental price.
5. Booking lock used JS truthiness across `booking_count || date_booking_count`; string `"0"` could mask a real date-level booking.
6. Comparable fallback trusted arbitrary price rows without proving artist/fandom/type/venue-capacity/seat-map similarity.
7. Phase 3 had no dedicated bounded Learning recovery loop.
8. Competitor scanning stopped after 3 shops even though owner policy allows ~20+ shop universe.
9. Downstream Final Pricing could recompute a Phase-3 price and silently change an accepted market/booked target.
10. Phase 3 had no immutable handoff artifact to Phase 4.

## Repairs implemented

### Exact Phase 2 → Phase 3 handoff

`server/kk-ultra-deep-phase2-artifact.js` — `KK_ULTRA_DEEP_PHASE2_ARTIFACT_V1`
- freezes exact Phase-2 result IDs and dispositions;
- derives `pricing_candidate_ids` only from `VERIFIED` rows;
- requires verified evidence;
- rejects `VERIFY_REQUIRED` in an accepted artifact;
- records Phase-1 fingerprint, exact counts and a tamper-evident fingerprint.

`server/kk-ultra-deep-phase2-runtime.js` — V3
- emits the immutable Phase-2 artifact only on a real `PHASE2_ACCEPTED`;
- if artifact freeze fails, Phase 2 falls back to HOLD.

`scripts/kk-ultra-deep-phase2-acceptance.js`
- persists `.artifacts/ultra-deep-phase2-artifact.json` on acceptance.

### Phase 3 controller hardening

`server/kk-ultra-deep-phase3-controller.js` — V2
- official execution requires a valid Phase-2 artifact;
- Phase-3 candidate IDs must exactly equal the artifact's VERIFIED pricing set;
- exact competitor evidence must carry the same event/candidate ID;
- identityless evidence is excluded and becomes a Learning miss;
- fresh exact-event evidence is separated from stale/unknown-timestamp evidence;
- default exact-price TTL is 30 days;
- package medians are independent by competitor and package type;
- broad-sample outliers are excluded and surfaced for Learning;
- explicit package parity inconsistencies are reconstructed safely and learned;
- booked price lock uses numeric `max(booking_count,date_booking_count)`;
- booked event with no canonical current price fails closed;
- hidden/tombstoned events remain skipped;
- comparable fallback requires HTTPS provenance plus a similarity score over artist, fandom, event type, venue capacity/same venue and seat-map class;
- prior-month comparable has the same evidence discipline with a slightly lower match threshold;
- fallback order is locked: fresh exact median → qualified comparable → qualified prior month → 690/890 base → bounded adjustment;
- demand/seat-map adjustment is ignored unless its signal is explicitly verified;
- Phase 3 remains zero-write.

### Semantic/fresh competitor scanner

`server/kk-ultra-deep-competitor-price-scanner.js` — V6
- historical 10 shops remain protected baseline;
- universe target 20, bounded maximum 50;
- default desired independent evidence per event = 5, max 8;
- scanner no longer stops at three shops when credible evidence can be collected;
- learns new rental accounts from credible X evidence;
- parses X status Snowflake timestamp when available;
- preserves explicit source publication timestamps from provider rows;
- extracts semantic rental offer fields:
  - rental price
  - deposit
  - lens add-on
  - phone-only vs phone+Lens
- removes model-number false positives such as `X300`/2026;
- rejects explicit wrong-device evidence;
- keeps event-title overlap and rental-shop identity checks.

### Phase 3 Learning Agent + bounded runtime

`server/kk-ultra-deep-phase3-learning-agent.js` — V1

Generalized miss classes:
- `STALE_PRICE_GAP`
- `PRICE_FRESHNESS_UNKNOWN`
- `COMPETITOR_IDENTITY_GAP`
- `PACKAGE_AMBIGUITY`
- `PACKAGE_PARITY_GAP`
- `OUTLIER_PRICE_GAP`
- `COMPETITOR_COVERAGE_THIN`
- `NO_EXACT_PRICE_GAP`
- `COMPARABLE_GAP`

Learned expansions include:
- fresh-price timestamp recovery
- package-semantic reconciliation
- competitor-universe expansion
- more-shop outlier cross-check
- comparable graph expansion.

`server/kk-ultra-deep-phase3-runtime.js` — V1
- bounded recovery, default 3 rounds;
- rescans only candidates with remaining pricing miss classes after round 1;
- merges evidence deterministically;
- accepts governed fallback after bounded recovery when no current exact/comparable evidence exists;
- never writes production and never starts Phase 4.

### Exact Phase 3 → Phase 4 handoff

`server/kk-ultra-deep-phase3-artifact.js` — V1
- freezes every accepted pricing decision, exact target prices, source/confidence, booking lock and market evidence;
- stores exact candidate/actionable sets and Phase-2 fingerprint;
- rejects HOLD rows, missing target prices, duplicate IDs or tampering.

`server/kk-final-pricing-policy.js` — V5
- accepts `phase3_price_decision` as `PHASE3_LOCKED_TARGET`;
- downstream raw competitor/baseline evidence cannot silently replace an accepted Phase-3 price.

`server/kk-verifier-storefront-promotion.js` — V7
- recognizes `PHASE3_LOCKED_TARGET` as an approved downstream pricing source.

`server/kk-ultra-deep-phase-handoff-gate.js` — V2
- Phase 2 and Phase 3 cannot hand off without frozen artifact + fingerprint;
- `auto_start_next_phase=false` remains locked.

### Agent runtime

`server/kk-agent-task-router.js` — V23
- `phase3_commercial_pricing` invokes the bounded Phase-3 runtime when a Phase-2 artifact or runtime execution is supplied.

`server/kk-agent-registry.js` — V34
- records the exact Phase-3 artifact/evidence/Learning runtime contract.

## Competitor policy

Canonical policy remains `docs/COMPETITOR_UNIVERSE_POLICY_V1_2026-10-05.md`.

Current interpretation:
- baseline = 10 protected shops;
- operational universe target ≈20;
- >20 allowed;
- safety cap = 50;
- per-event target = 5 independent credible shops when available;
- 20 prices are not required for one event;
- current exact evidence wins; otherwise the governed fallback ladder applies.

## Verification performed during this hardening

Repository-source syntax compilation was executed against the current branch for all touched Phase-2/Phase-3 modules and tests. All checked files compiled successfully.

Isolated behavior execution against the actual branch source proved:
- Phase-2 artifact freezes/validates;
- string `"0"` booking count cannot mask a date-level booking;
- identityless competitor evidence is excluded;
- stale price evidence is excluded from current median;
- fresh exact phone-price median resolves correctly after fixing ISO-run-time freshness handling;
- semantic parser separates `deposit 500 / rental 790 / Lens +200`;
- adaptive competitor scan continues to 5 distinct shops in the diagnostic harness;
- comparable mismatch is excluded;
- bounded Phase-3 recovery may safely terminate on 690/890 fallback;
- accepted Phase 3 emits a frozen Phase-3 artifact;
- downstream Final Pricing preserves `PHASE3_LOCKED_TARGET`.

Two real defects were found by the behavior harness and fixed during the same work:
1. semantic parser initially read `X300` as 300 and did not allow a 200 Lens add-on;
2. ISO string `now` values initially evaluated as stale because freshness calculation attempted `Number(isoString)`.

Both are repaired in current source.

## Reliability memory

Persistent failure fingerprints added:
- `PHASE3_PRICING_EVIDENCE_INTEGRITY_GAP`
- `PHASE3_DOWNSTREAM_PRICE_RECOMPUTE`

These prevent future agents from reintroducing evidence bleed, stale-price medianing, deposit-as-price parsing, booking repricing, arbitrary comparables, hard 10-shop ceilings or downstream price recomputation.

## Acceptance state

Phase-3 **source/runtime hardening is ready for an official run**, but official Phase 3 remains locked until a real immutable Phase-2 artifact returns:
- `PHASE2_ACCEPTED`
- `ready_for_phase3=true`
- `production_writes=0`
- `phase3_started=false`.

Do not call operational Phase 3 accepted from this diagnostic alone.
