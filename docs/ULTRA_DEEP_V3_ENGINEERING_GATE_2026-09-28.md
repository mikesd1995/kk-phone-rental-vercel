# Ultra Deep Scan V3 + Engineering Execution Gate — 2026-09-28

## Objective
Close the repeated discovery/deployment loop with two explicit controls: recall-first Ultra Deep coverage and mandatory independent engineering review.

## Ultra Deep V3
Required source classes remain Official, Ticketing, Venue, Artist/Agency, Brand/Sponsor, Social, Competitor and Public Calendar. A scan is incomplete while any class is empty.

Free-first provider order is: direct official/feed sources -> self-hosted SearXNG -> DDGS/Trafilatura -> Crawl4AI -> Exa fallback. SearchOS was evaluated as an architectural reference for coverage-map/gap-search/evidence-graph behavior; it is not granted production authority and is not added as a runtime dependency in this patch.

HF remains advisory only and is used where enabled for event classification, semantic duplicate assistance and relevance assistance. It never supplies final event truth, price, booking/inventory mutation or publication authority.

## Engineering gate
Material engineering work must show: Code Intelligence context pack -> Planner -> Implementer -> independent Reviewer -> targeted tests -> risk-appropriate regression -> release/runtime readback.

The independent reviewer is intentionally a separate phase. A failed implementation must be re-diagnosed from the failing boundary/log rather than repeatedly patching the same hypothesis.

The repository-local deterministic Code Intelligence remains the zero-cost baseline. External coding-agent tooling may be used as a reviewer/debugger when connected, but it does not receive merge/deploy/business-write authority.

## Production incident evidence
The 2026-09-28 prebuilt recovery failure was not an application build failure. Exact-main source gates, tests, Vercel token check, Production settings pull and local Production build passed. Vercel rejected candidate creation with code `api-deployments-free-per-day` and message `Resource is limited - try again in 24 hours (more than 100)`.

The same recovery log resolved the currently serving Production SHA as `dfa5c2673e59e984b1e8092d6917c0073976d868`, so the accepted main was already serving while the redundant candidate attempt was rate-limited.

## Safety
No business data, pricing, booking, inventory, event visibility, Machine SOT or Scanner/Verifier schedule is changed by this patch. Production writes remain zero.
