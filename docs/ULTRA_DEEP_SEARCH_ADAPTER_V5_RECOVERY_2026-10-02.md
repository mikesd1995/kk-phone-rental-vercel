# Ultra Deep Search Adapter V5 Recovery — 2026-10-02

Run 36914009322 proved the October one-shot execution path but returned zero candidates. Evidence: discovery 48/48 executed yet unresolved; DDG/Bing returned NO_EVIDENCE and optional providers were NOT_BOUND.

Changes:
- harden DDG parsing for result__a/result-link and redirect links independent of attribute order;
- harden Bing parsing for li/div b_algo and encoded Bing redirect targets;
- add live provider preflight to runtime runner; a bound function is no longer considered usable until it returns real HTTPS evidence;
- fail fast with UNKNOWN_URL_SEARCH_PREFLIGHT_FAILED instead of spending the complete monthly sweep on dead providers;
- preserve FULL, reconciliation, known-miss and production-write gates unchanged.

No completion criterion was weakened. Scanner remains zero-write.
