# Ultra Deep Discovery Coverage Gate — 2026-09-28

## Incident
A scan described as "Ultra Deep" surfaced large concerts but missed three in-window fan/brand activations:
- THE PINK AURA — 2026-09-28
- MINMIN x TeeTeePor — THE FROZEN CANDY LAND — 2026-09-30
- M Lifestore Sport Day After Match — TeeTee/Por — 2026-10-01

The failure mode was structural: the worker accepted whatever source observations were supplied and could return READY_FOR_VERIFIER without proving that brand, social, mall/venue, competitor and public-calendar discovery classes had been covered.

## Change
KK_FULL_DISCOVERY_WORKER_V2 adds an explicit ULTRA_DEEP completeness gate.

Required source classes:
1. OFFICIAL
2. TICKETING
3. VENUE
4. ARTIST_AGENCY
5. BRAND_SPONSOR
6. SOCIAL
7. COMPETITOR
8. PUBLIC_CALENDAR

When scan_mode=ULTRA_DEEP and any class is absent, the worker returns BLOCKED_INCOMPLETE_SOURCE_COVERAGE and the handoff is HOLD_FOR_COVERAGE. It must not claim READY_FOR_VERIFIER.

The source-watch contract now accepts BRAND_SPONSOR, SOCIAL and PUBLIC_CALENDAR as first-class tiers instead of forcing them into SECONDARY.

## Regression protection
The worker test suite now contains the three missed events as regression fixtures. A fully covered Ultra Deep run must preserve all three candidates through normalization and handoff.

## Authority / safety
This change restores discovery recall without restoring unsafe Scanner direct writes:
- Scanner authority remains STAGING_ONLY.
- production_writes = 0.
- final_truth_mutation = false.
- direct_business_write_allowed = false.
- Verifier remains mandatory before any business commit.

## Remaining runtime boundary
This patch makes it impossible for the worker to truthfully label a partial source set as a complete Ultra Deep run. It does not fabricate a live provider binding, competitor-price collector, poster downloader, final Verifier commit worker, scheduler, or storefront publisher. Those remain separate runtime dependencies and must be wired/accepted before claiming autonomous end-to-end production operation.
