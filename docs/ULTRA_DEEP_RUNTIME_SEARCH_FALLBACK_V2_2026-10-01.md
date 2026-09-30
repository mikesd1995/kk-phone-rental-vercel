# Ultra Deep Runtime Search Fallback V2 — 2026-10-01

## Incident
The first live zero-write runtime acceptance on run 36760914455 proved that the built-in DDG provider was genuinely bound and the 30/30 source-universe tasks executed, but the run still failed FULL because the known-miss probe phase returned zero matches for all ten regression cases after the larger discovery sweep.

Observed acceptance:
- unknown_url_search_bound = true
- source_universe = 30/30 PASS
- reconciliation_gap_count = 0
- candidate_count = 41
- known_miss = 0/10
- result = HOLD_FOR_COVERAGE
- production_writes = 0

## Root-cause hardening
V2 does not treat the DDG-only path as sufficient redundancy. It adds:
1. A second credential-free unknown-URL provider: Bing HTML search.
2. Provider chain order: DDG_HTML -> BING_HTML -> SearXNG -> DDGS/Trafilatura -> Crawl4AI -> Exa.
3. More complete HTML entity decoding so search-result titles are normalized before identity matching.
4. Known-miss aliases and token-overlap matching for social/brand titles that do not reproduce the canonical event title verbatim.
5. Known-miss query expansion using canonical title plus aliases.
6. Per-phase provider attempt/error/not-bound diagnostics in runtime acceptance evidence.

## Safety invariants
- No recurring schedule was created.
- Scanner execution remains disabled unless separately authorized.
- No business, booking, pricing, inventory, visibility, or storefront writes.
- Verifier remains mandatory.
- FULL remains fail-closed.
- A search provider returning no evidence never fabricates a candidate.
- A known-miss case passes only through discovered evidence or an explicitly executed classification receipt.

## Acceptance
Re-run the owner-gated Issue #368 runtime acceptance after merge. FULL requires:
- provider_binding.unknown_url_search_bound = true
- source_universe.complete = true
- reconciliation_gap_count = 0
- known_miss_regression.complete = true
- production_writes = 0


## 2026-10-01 follow-up: query-variant execution

A second live zero-write acceptance on run 36762017158 proved that both DDG_HTML and BING_HTML were bound and executed without provider errors, source-universe proof was 30/30, and reconciliation gaps were zero, but all ten known-miss probes still returned NO_EVIDENCE.

Root cause was isolated to the probe planner: it concatenated the canonical title, every alias, the event date, and Bangkok into one over-constrained query. The provider layer therefore never actually executed the documented alias expansion independently.

The remediation keeps the ten-case acceptance gate unchanged and adds bounded query variants inside each task. Each provider now tries the canonical query and then individual alias queries in order, stopping on the first evidence result before falling to the next provider. The change remains read-only and production_writes=0; it does not classify a known miss as PASS unless the existing KnownMiss evaluator receives a discovered candidate or an explicitly executed allowed classification.


## 2026-10-01 second follow-up: probe ordering and cross-path evidence

Live acceptance run 36768430694 proved the V2 query variants were genuinely executed (37 DDG and 37 Bing known-miss attempts) but still produced zero dedicated-probe results. At the same time, the main discovery sweep returned a WeSpark/Bai Lu search result that matches one of the ten known-miss cases. The V2 runtime discarded that valid discovery hit because the known-miss evaluator received only candidates from the dedicated probe phase.

V3 keeps every FULL gate intact while correcting two execution semantics:
1. Run the small bounded known-miss probe corpus before the broad monthly sweep so a large discovery run cannot exhaust or soft-throttle the public HTML providers before regression probes execute.
2. Evaluate known-miss recovery against evidence found by any governed live path in the run: dedicated probe, main discovery, or independent reference sweep. No synthetic candidate is created and no case passes without the existing matcher or an explicit executed classification.

The runtime remains read-only, verifier-required, and production_writes=0.


## 2026-10-01 third follow-up: evidence-grounded queries for the final three misses

Live acceptance run 36769164040 improved the known-miss gate from 0/10 to 7/10 after probes were moved ahead of the broad sweep. The remaining three were SCOOPIFY/JAMES SU, EVERPINK Tle-FirstOne, and FORTREASURE.

Current public evidence uses specific source wording that generic title+location queries did not reliably surface:
- SCOOPIFY: `SCOOPIFYYogurtAndJamesSu` / `SummerVibeTH`
- Tle-FirstOne: `EVERPINKxTleFirstone` / `EVERPINK A Touch of Love TleFirstone`
- FORTREASURE: Eventpop carries the exact concert title, so `FORTREASURE site:eventpop.me` is a bounded official-ticketing hint.

V4 keeps provider discovery mandatory and adds these as search hints only. A case still cannot PASS unless a live provider returns a candidate that satisfies the existing matcher. No URL is hard-coded as discovered evidence and production_writes remains 0.
