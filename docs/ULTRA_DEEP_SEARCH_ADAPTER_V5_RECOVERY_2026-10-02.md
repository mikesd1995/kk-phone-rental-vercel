# Ultra Deep Search Adapter V5 Recovery — 2026-10-02

Run 36914009322 proved the October one-shot execution path but returned zero candidates. Evidence: discovery 48/48 executed yet unresolved; DDG/Bing returned NO_EVIDENCE and optional providers were NOT_BOUND.

Changes:
- harden DDG parsing for result__a/result-link and redirect links independent of attribute order;
- harden Bing parsing for li/div b_algo and encoded Bing redirect targets;
- add live provider preflight to runtime runner; a bound function is no longer considered usable until it returns real HTTPS evidence;
- fail fast with UNKNOWN_URL_SEARCH_PREFLIGHT_FAILED instead of spending the complete monthly sweep on dead providers;
- preserve FULL, reconciliation, known-miss and production-write gates unchanged.

No completion criterion was weakened. Scanner remains zero-write.

## CI recovery follow-up
- Restored duckDuckGoHtml after the parser refactor accidentally removed the live adapter while exports still referenced it.
- Added provider-factory regression coverage so DDG/Bing adapters must remain callable.
- Kept provider preflight as a completion diagnostic, but moved it after the established known-miss -> discovery -> reference -> reconciliation evidence sequence. This preserves historical execution-order and blocker contracts while still preventing FULL when live search has no evidence.
- Fixed the preflight test module reference typo (Runner, not R).

- Final CI semantic fix: preflight is no longer a single-query veto. Governed HTTPS evidence from discovery, reference sweep, or known-miss probes also proves live search. If all live evidence paths are empty, UNKNOWN_URL_SEARCH_PREFLIGHT_FAILED still blocks FULL. This removes a false negative without weakening the zero-evidence fail-closed gate.

## Runtime proof and Discovery V6 follow-up
- October one-shot run 36958272387 still failed discovery acceptance after V5: targeted full-loop regressions passed, but monthly discovery and reference evidence remained empty.
- The contrast with live known-miss recall showed that search transport was partially healthy while long generic monthly queries had poor recall.
- Discovery V6 adds bounded broad fallbacks after precise month/location queries for both generic tiers and named source-universe tasks.
- Broad results remain non-authoritative and verifier/date-window gated. Production writes remain zero in discovery acceptance; FULL/reconciliation gates are not weakened.

## Reference Sweep V7 follow-up
- October Full Loop run 37000102362 improved monthly discovery from 0 to 29 candidates and completed the 30-source universe, but remained HOLD_FOR_COVERAGE because all four independent reference tasks returned no evidence.
- Root cause scope: the reference plan still used the older long month/location-only query strategy while Discovery V6 had already moved to bounded exact-to-broad fallbacks.
- V7 preserves independent reference execution and the REFERENCE_SWEEP_INCOMPLETE fail-closed gate, while adding bounded broad reference intents for concert, fanmeeting/fancon, lucky-fan/brand event, and public calendar coverage.
- No production-write path or verifier/reconciliation rule is weakened.
