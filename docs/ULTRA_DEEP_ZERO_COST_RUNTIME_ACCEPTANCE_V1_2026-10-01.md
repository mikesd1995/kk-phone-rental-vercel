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
