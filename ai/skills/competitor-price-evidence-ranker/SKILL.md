# COMPETITOR_PRICE_EVIDENCE_RANKER

Status: **STAGING_REVIEWED_NOT_INSTALLED**

## Purpose
Rank only verifier-promoted competitor evidence so KK pricing context uses the **current fresh exact-event market** while preserving append-only historical lineage.

## Inputs
- current Active `_Policy_Registry`
- current fresh projection when the Active policy defines one (currently `_Competitor_Price_Current`)
- append-only competitor evidence/history (currently `_Price_Evidence`) for lineage/trend only
- exact event identity
- target product/package
- business identity/dedup result
- timestamps/freshness/TTL
- source-evidence lineage/readback state

## Outputs
- accepted current exact evidence
- accepted comparable evidence kept separate
- rejected evidence with reason
- independent-shop count
- exact range eligibility
- exact median eligibility
- explicit refresh/HOLD requirement when current evidence is absent, stale, conflicted or insufficient

## Rules
- Read current Active policy first; never hard-code an older pricing policy over live Machine SOT.
- Never accept raw unverified hunter output directly.
- When current Active policy defines a current-price projection, pricing consumers must read that projection first and require exact source lineage + valid freshness/readback.
- Append-only historical price evidence is lineage/trend evidence, not a silent fallback for current pricing.
- Highest rank: exact-event + exact product/package + current direct/authorized evidence.
- `STALE`, superseded, expired or conflict-held observations never count in the current exact range/median/recommendation.
- Duplicate accounts/posts of the same business count once.
- KK Phone Rental own listings never count as competitor evidence.
- Exact-event range requires >=2 independent current fresh shops.
- Exact-event median requires >=3 independent current fresh shops.
- Comparable evidence must remain labeled and must never be mixed silently into exact statistics.
- Queue/full/sold-out status must be respected under the current Active policy; do not treat a non-bookable offer as an ordinary available current offer.
- Reject stale, wrong-event, package-mismatched, self-listing, ambiguous-price, lineage-missing, conflict-held or unverifiable evidence.
- If the current projection is empty/stale/insufficient, require refresh or HOLD; never silently reuse a first-seen historical price.
- Do not automatically choose/undercut the cheapest competitor.
- No dependency back to `COMPETITOR_RENTAL_HUNTER`; consume verifier-promoted/current evidence supplied by the router.
- No schedule/Core/Production mutation.

## Dependencies
- existing EVIDENCE_VERIFIER
- current Active policy / TTL rules
- current-price projection defined by Machine SOT

## Replay / regression tests
- 2 independent current fresh shops => range yes / median no
- 3 independent current fresh shops => median eligible
- same business via duplicate accounts counts once
- package mismatch rejected
- comparable fallback kept separate
- stale/expired/conflict-held row rejected
- raw unverified hunter row rejected
- historical-only price cannot silently become current
- current row without exact source lineage/readback rejected
