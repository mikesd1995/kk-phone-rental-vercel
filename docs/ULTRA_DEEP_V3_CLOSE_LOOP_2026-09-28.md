# Ultra Deep V3 close-loop — 2026-09-28

## Change
Added a bounded provider-execution layer for Ultra Deep gap tasks. It consumes the V3 gap plan and tries only explicitly bound providers in the plan's free-first order. Unbound providers are recorded as NOT_BOUND, provider failures are isolated, and the executor stops at the first provider returning valid HTTPS evidence.

The executor is staging-only: authoritative=false, verifier_required=true, production_writes=0.

## Why
The V3 planner could identify missing source tiers but previously had no concrete executor contract. This closes the planner-to-provider boundary without granting crawlers/search providers business authority.

## Deliberate remaining boundary
Final storefront mutation remains behind the existing authenticated Admin createEvent guard. The Verifier promotion module prepares and verifies the payload/readback, but this patch does not bypass KK_ADMIN_PIN, duplicate/date checks, Apps Script writer, owner visibility policy, or final price approval.

## Acceptance
Provider execution is considered ready only when each production provider is explicitly bound and an end-to-end real-event acceptance proves: 8/8 coverage -> dedup/HF assist where authorized -> commercial evidence -> final verifier approval -> authenticated createEvent -> exact storefront readback.

No business data or production schedule is changed by this patch.
