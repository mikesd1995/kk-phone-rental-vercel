# Ultra Deep source-proof hardening — 2026-09-30

## Incident
October Ultra Deep missed REMASTER CONCERT (2026-10-10, PARAGON HALL) even though the event was discoverable from official/promoter, venue, and ticketing surfaces.

## Root cause
KK_FULL_DISCOVERY_WORKER_V2 treated the mere presence of an observation labelled with a required source tier as coverage. A blocked or rejected provider execution could therefore still contribute to a nominal 100% source-class coverage result.

## Fix
KK_FULL_DISCOVERY_WORKER_V3 awards source-tier coverage only when that observation has a matching execution report and the report is not BLOCKED_* or REJECTED. Missing execution proof remains coverage debt and Ultra Deep fails closed as BLOCKED_INCOMPLETE_SOURCE_COVERAGE / HOLD_FOR_COVERAGE.

Added regression tests for:
- blocked OFFICIAL source cannot count as covered;
- REMASTER CONCERT on 2026-10-10 must survive OFFICIAL + TICKETING + VENUE discovery into the Verifier handoff.

Existing eight source classes remain mandatory: OFFICIAL, TICKETING, VENUE, ARTIST_AGENCY, BRAND_SPONSOR, SOCIAL, COMPETITOR, PUBLIC_CALENDAR.

## Safety
Scanner remains staging-only. production_writes=0, final_truth_mutation=false, verifier_required=true. No scheduler, pricing, booking, inventory, customer, or storefront authority was added.

## Remaining acceptance
This code hardening prevents false completeness. Live provider bindings still need runtime evidence. A live Ultra Deep run must not be called FULL unless each required source class has successful execution/readback evidence and unresolved coverage debt is zero.
