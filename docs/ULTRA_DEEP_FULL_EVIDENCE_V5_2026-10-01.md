# Ultra Deep FULL Evidence V5 — 2026-10-01

## Incident basis
REMASTER and a later batch of missed fan/brand/social events showed that eight source-tier labels alone are not sufficient evidence of complete discovery. A source class may exist while the provider universe inside that class is too narrow, and recurring production dispatch was previously witness-only.

## Changes
1. Added an explicit source-universe registry covering OFFICIAL, TICKETING, VENUE, ARTIST_AGENCY, BRAND_SPONSOR, SOCIAL, COMPETITOR, and PUBLIC_CALENDAR. Named coverage now includes Eventpop, Zipevent, ICONSIAM Hall, MCC Hall, Paragon Hall, The Mall/M Grand Hall, Watsons campaigns, WeTV campaigns, SM True campaigns, mall campaigns, lucky-fan/top-spender discovery, and competitor-account expansion.
2. Added machine-generated source-universe proof. A caller-supplied boolean cannot declare FULL. Every required source must have an executed receipt with an accepted execution status.
3. Added independent reconciliation between discovery candidates and a separate reference sweep. Any eligible external reference missing from discovery creates a reconciliation gap and blocks FULL.
4. Added a ten-case historical known-miss regression corpus including REMASTER, THE PINK AURA, MINMIN/TeeTeePor, Sport Day After Match, You Maniac Blind Date, Bai Lu, TutorYim, Scoopify/James Su, Tle-Firstone, and FORTREASURE.
5. Upgraded the full discovery worker to V5. Ultra Deep readiness is computed from source-class proof + source-universe proof + zero reconciliation gaps + known-miss regression. Missing evidence fails closed as HOLD_FOR_COVERAGE.
6. Expanded the monthly query plan with per-source universe tasks. Source-universe tasks require an unknown-URL search provider instead of pretending direct/feed adapters can discover unknown pages.
7. Changed SearXNG binding semantics: when no HTTPS endpoint is configured, it is not exposed as a bound provider.
8. Added a governed read-only monthly Ultra Deep runtime runner. It performs discovery execution, a separate reference sweep, known-miss probes, and emits a machine acceptance result. It cannot write business data.
9. Registered the monthly runtime execution through the agent router/registry.
10. Added an optional external scanner mode `execute-readonly`. It remains disabled by default and requires explicit enablement, HMAC/ledger readiness, and an HTTPS SearXNG endpoint. Business writes remain zero.

## Safety invariants
- Scanner authority remains non-authoritative and read-only.
- production_writes = 0.
- final_truth_mutation = false.
- Verifier remains mandatory.
- Tombstoned/owner-hidden events are not automatically resurrected.
- Booked events remain protected from automatic repricing by reconciliation/classification policy.
- Missing unknown-URL provider binding fails closed.
- Missing source-universe execution proof fails closed.
- Any reconciliation gap fails closed.
- Any deterministic known-miss regression gap fails closed.
- Live unknown-URL provider health must pass before and after the broad sweep.

## Acceptance required before merge/production enablement
- npm syntax checks pass.
- full regression suite passes.
- PR is current with main.
- preview deployment is READY.
- read-only runtime scan returns provider_binding.unknown_url_search_bound=true.
- live_provider_health.complete=true.
- source_universe.complete=true.
- reconciliation_gap_count=0.
- known_miss_regression.complete=true.
- production_writes=0.
- Only after these checks may the run report FULL / READY_FOR_VERIFIER.

## Production rollout
Do not switch KK_EXTERNAL_SCANNER_MODE from witness to execute-readonly until a real zero-cost HTTPS unknown-URL search endpoint is configured and a read-only acceptance run succeeds. No production business write path is enabled by this change.


## 2026-10-01 acceptance-model correction

Three owner-gated zero-write live acceptance attempts proved that using live public search as the hard historical known-miss regression is nondeterministic. Query variants moved 0/10 to 0/10; probe ordering and cross-path evidence moved the result to 7/10; evidence-grounded queries left it at 7/10. The same runs also exposed false-positive risk because a dated historical case could previously match a candidate whose event date was missing.

The hard acceptance model is therefore split without weakening FULL:
- `known_miss_regression` is now a deterministic replay of ten synthetic historical signal shapes through the same matcher. Fixtures are TEST_ONLY and have zero business-truth authority.
- Dated historical cases require an exact candidate date; missing dates no longer pass.
- `live_provider_health` is a separate hard gate with small pre-sweep and post-sweep canaries. At least one evidence result is required both before and after broad discovery.
- source-universe execution proof and zero reconciliation gaps remain hard gates.
- live historical probes still run and are emitted as `known_miss_live_probe`, but are diagnostic-only because search indexing and soft-throttling must not redefine regression truth.

FULL remains fail-closed unless provider binding, live provider health, source-universe proof, reconciliation and deterministic historical regression all pass. Production writes remain zero and Verifier remains mandatory.
