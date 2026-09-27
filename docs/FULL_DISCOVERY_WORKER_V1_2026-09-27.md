# Full Discovery Worker v1 — 2026-09-27

## Change
Implemented the missing governed Scanner worker core between source observations and the existing Verifier handoff.

Pipeline:
source observations -> source-watch validation -> one bounded discovery result per changed/new source -> candidate normalization -> deterministic hard-identity dedup -> READY_FOR_VERIFIER.

## Safety
- Scanner remains STAGING_ONLY.
- production_writes = 0.
- final_truth_mutation = false.
- notification_sends = 0.
- no pricing/booking/inventory/customer/Sheet writes.
- no new scheduler or competing runner.
- Verifier remains required.
- malformed/stale observations and authority-violating provider results fail closed.
- maximum 50 observations and 100 staged candidates per worker execution.

## Provider boundary
The worker supports either a runtime provider executor injected by the caller or bounded provider_results supplied by a controlled discovery surface. No provider secret is committed. Exa/Crawl4AI production credentials are still not present in the repository.

This means the worker core is now executable and testable, but recurring autonomous public-web discovery must not be claimed until an approved provider executor is bound to the existing Scanner runner.

## Why this is better
Previously the repository had source-watch contracts and provider UAT but no component that joined validated discovery results, normalized/deduplicated candidates, and produced one Verifier-ready batch. This worker closes that software gap without weakening authority boundaries.
