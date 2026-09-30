# Ultra Deep FULL 8/8 proof gate — 2026-09-30

FULL is now an evidence-backed state, not a label.

For each mandatory source class (OFFICIAL, TICKETING, VENUE, ARTIST_AGENCY, BRAND_SPONSOR, SOCIAL, COMPETITOR, PUBLIC_CALENDAR), the worker requires:
- a matching source observation;
- a matching execution report;
- status not BLOCKED_* or REJECTED;
- discovery_call_count >= 1.

The result publishes proof_by_source_tier and proof_complete. ULTRA_DEEP may route READY_FOR_VERIFIER only when proof_complete=true. Otherwise it fails closed as BLOCKED_INCOMPLETE_SOURCE_COVERAGE / HOLD_FOR_COVERAGE.

This does not make discovery authoritative. Scanner remains staging-only, Verifier remains mandatory, production_writes=0, final_truth_mutation=false.
