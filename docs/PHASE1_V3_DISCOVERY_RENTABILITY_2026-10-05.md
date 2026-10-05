# Phase 1 V3 — Discovery Coverage + Rentability Prioritization

Canonical implementation state: 2026-10-05.

## Purpose
Phase 1 maximizes external discovery coverage. It must never drop an event because an AI/model thinks it is not rentable. Rentability is an additive Phase-2 queue signal only.

## Discovery order
External sources only: ticketing, organizer/promoter, venue, artist schedule, brand/social, festival, broad live/event. Storefront/SOT/backoffice is prohibited as a discovery seed and may be used only after external discovery as a known-positive regression oracle.

## V3 invariants
- Preserve every discovered candidate through scoring.
- Deterministic dedup before handoff.
- Bounded graph expansion (max 3 hops): artist/brand/venue/organizer -> schedules/events/official sources.
- Coverage matrix must show every required discovery family executed; a missing family blocks Phase 1 completion.
- Rentability and discovery confidence are separate values.
- Rentability tiers: S >=80, A >=65, B >=45, C >=25, D <25.
- S/A/B prioritize Phase 2; C/D remain visible and auditable.
- Known booking, owner requested, known storefront, or known historical demand overrides score and must proceed to Phase 2.
- Lucky Fan, Top Spender, Fansign, Fan Benefit, Hi-touch, selected-fan/photo opportunity, birthday, fanmeeting, premiere, artist appearance, Brand x Artist and Meet & Greet are direct rental-intent signals.
- No competitor evidence is never a reason by itself to delete or reject a candidate.
- production_writes=0 in Phase 1.
- Verifier, booking lock, tombstone policy, governed writer and exact readback remain protected.

## Acceptance
V3 is an improvement only when compared with V2 using evidence: unique candidates, known-positive recall, novel discovery yield, source-family coverage and false-positive/noise rate. A cleaner list with lower recall is a regression.

## October 2026 learning
Expanded known-miss regression now includes representative brand/social, international concert, festival, Thai live, ticketing and other source-universe misses. This corpus is regression evidence only; it must not seed external discovery.

## Safety
No deploy or production/business mutation is required for this change. Phase 2 does not start automatically.
