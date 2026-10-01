# Ultra Deep Search Parser Repair — 2026-10-01

## Incident
Ultra Deep Runtime Acceptance run 36833877629 on main (88e56a3703d6d5eb189111a9bf5540b5b802431f) executed the bounded zero-write scan but returned full=false with:
- DISCOVERY_EVIDENCE_EMPTY
- REFERENCE_SWEEP_INCOMPLETE

The run preserved production_writes=0 and verifier_required=true.

## Diagnosis
The public HTML search adapters used DOM-shape-sensitive regular expressions:
- DuckDuckGo required class=result__a to appear before href in the anchor tag.
- Bing required the result anchor to be the immediate first child of h2.

Those assumptions can reject valid search-result anchors when providers reorder attributes or insert harmless wrapper markup.

## TDD evidence
1. RED commit c3d913a6f8bd030afe4b8d4c9918feb171e3ec87 added two regression cases only.
2. Admin Regression run 36841416651 reached Regression tests and failed, confirming the old parser did not satisfy the new fixtures.
3. Implementation commits d8ed2f261176faedf2834856d4c94d8790ed1ae9 and dfe08a253ad98be1e0a8be70add649adfae67a16 made the smallest parser-only change.
4. Admin Regression run 36841536305 passed Regression tests and Continuous invariant gate after the repair.

## Change
- Bumped public web adapter contract marker V4 -> V5.
- Added htmlAttr() to read quoted HTML attributes independent of attribute order.
- DuckDuckGo parser now selects anchors by result__a class without requiring class-before-href ordering.
- Bing parser now selects b_algo result blocks and searches the h2 subtree for the result anchor, allowing wrapper elements.
- Existing HTTPS-only URL normalization, result caps, provider ordering, timeout behavior and fail-closed semantics remain unchanged.

## Locked safety invariants
- production_writes=0
- verifier_required=true
- final-truth mutation remains disabled
- no business/booking/pricing/inventory/storefront data writes
- no weakening of FULL, discovery, reference, reconciliation or known-miss gates
- no Ultra Deep runtime acceptance rerun was triggered during this repair

## Scope boundary
This patch repairs a concrete parser brittleness that can explain false zero-candidate results. It does not claim that live providers will necessarily return October evidence on a future run; provider-side empty results, throttling, challenge pages, or query quality remain independently possible and must continue to fail closed.
