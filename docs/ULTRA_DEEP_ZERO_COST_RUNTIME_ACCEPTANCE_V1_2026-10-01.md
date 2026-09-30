# Ultra Deep Zero-Cost Runtime Acceptance V1 — 2026-10-01

## Purpose
Remove the external SearXNG endpoint as the only unknown-URL discovery prerequisite while preserving the V5 fail-closed evidence gates.

## Changes
- Added built-in credential-free DuckDuckGo HTML search provider `DDG_HTML`.
- Added canonical DuckDuckGo redirect decoding and bounded HTTPS result extraction.
- Added request spacing to reduce burst traffic.
- Added `DDG_HTML` to the provider executor, source-universe plans, reference sweep and known-miss probes.
- Named source-universe queries now include `site:<domain>` when a canonical domain is known.
- Scanner readiness now recognizes built-in unknown-URL discovery; SearXNG remains optional.
- Added owner-gated, non-recurring GitHub Actions runtime acceptance on Issue #368.
- Added zero-write acceptance artifact and summary generation.

## Safety
This does not create a recurring schedule and does not enable Scanner production execution.
The acceptance workflow is owner-triggered only.
Business writes remain zero.
Verifier remains mandatory.
FULL still requires source-universe proof, zero reconciliation gaps, and known-miss PASS.

## Acceptance
The runtime acceptance command must prove:
- unknown_url_search_bound=true
- source_universe.complete=true
- reconciliation_gap_count=0
- known_miss_regression.complete=true
- verifier_required=true
- production_writes=0

Any failure exits non-zero and remains HOLD_FOR_COVERAGE.


## Acceptance V2 separation

Historical matcher regression and live search health are now separate acceptance dimensions:
- deterministic `known_miss_regression.complete=true` proves the historical recall matcher on stable TEST_ONLY fixtures;
- `live_provider_health.complete=true` proves unknown-URL search returns evidence both before and after the broad sweep;
- `known_miss_live_probe` remains visible as diagnostic-only telemetry and may be incomplete without turning volatile search indexing into test truth;
- source-universe and reconciliation gates remain unchanged.

This does not weaken runtime safety: a bound provider that returns no evidence fails `LIVE_UNKNOWN_URL_PROVIDER_HEALTH_FAILED`. Business writes remain zero and Verifier remains mandatory.
