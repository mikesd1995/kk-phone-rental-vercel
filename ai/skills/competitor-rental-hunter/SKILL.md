# COMPETITOR_RENTAL_HUNTER

Status: **STAGING_REVIEWED_NOT_INSTALLED**

## Purpose
Collect raw competitor rental evidence and use competitor feeds as one discovery surface without assuming that the event already exists in runtime SOT.

The hunter has two distinct logical modes inside an already-due competitor window:
1. **REVERSE EVENT DISCOVERY** — inspect active competitor feeds/dynamic search for event names, aliases, hashtags, dates and venues that may be absent from runtime SOT.
2. **KNOWN-EVENT PRICE / AVAILABILITY** — for an already verified event, collect exact-event phone/lens/package evidence, then comparable evidence only when explicitly requested.

## Inputs
- current Active `_Policy_Registry`
- mode: `REVERSE_DISCOVERY / KNOWN_EVENT_EXACT / COMPARABLE`
- active competitor source identity
- verified exact event identity when mode requires it
- target product/package
- current runtime event identities

## Outputs
- source attempt result: `FOUND_NEW_EVENT / NO_NEW_EVENT / PARTIAL / BLOCKED`
- raw unknown-event signal
- raw competitor evidence candidate
- `EXACT / COMPARABLE / UNRESOLVED`
- shop/business identity, package, explicit price/unit/duration, source URL/type, freshness/access state

## MAX-RECALL rules
- Discovery breadth remains identical across the in-year horizon; distance changes re-fetch cadence only.
- Reverse competitor discovery is Pass C of A/B/C/D and never substitutes for official-universe/keyword/negative passes.
- >=2 independent competitor businesses referencing the same unknown in-area event create a P0 authority-backcheck gap; sister accounts count once and KK never counts.
- Unknown competitor events remain raw discovery evidence until authority verification.
- Every extracted in-area signal requires a governed disposition before Scanner normal FINISHED.
- Root/profile access does not count full competitor-family coverage when due feed/post/search routes were not attempted.

## v4.9.8 overnight targeting
- The 01:00 Ultra-Deep uses competitor feeds primarily for recall, not indiscriminate full-year overnight price crawling.
- If a newly found/materially changed event is P0/P1, <=14 days away, and exact vivo X300 Pro + Lens market evidence is missing or stale, request a targeted exact-event price refresh before morning.
- P2/far-horizon signals do not trigger this special overnight price path unless a later Active policy explicitly changes it.
- Any required competitor route blocked during nightly coverage remains explicit Coverage Debt for the existing 03:00/06:00 retry ladder; never convert failure to unchanged/full.
- The 15:00 broad competitor-price deep remains the authoritative daily market refresh window.

## Reverse-discovery rules
- Reverse discovery is separate from known-event pricing; completion of one never implies the other.
- Normalize event name/hashtag/date/venue, deduplicate, then geo-classify and authority-route.
- Parse visible signals before geo suppression so seen-then-filtered differs from never-seen.
- Out-of-area events are observability-only.
- Every active due competitor source retains an explicit attempt result; missing attempts are coverage debt.

## Known-event pricing rules
- Search exact event first.
- Inspect accessible direct posts/replies/quotes/pinned/profile/media/forms/websites when relevant.
- KK own listings are excluded.
- Never infer price from availability, generic offering, old unrelated event or unattributed media.
- `EXACT` requires exact-event identity plus package/model comparability.
- Media-only prices route through `POSTER_MEDIA_FACT_EXTRACTOR`.
- If exact evidence is insufficient, return `INSUFFICIENT_EXACT`; comparable is separate.

## Price persistence / freshness
For verified exact-event vivo X300 Pro + Lens observations:
1. preserve exact Event + competitor business + package identity;
2. append `_Price_Evidence`;
3. only after append, upsert newest valid identity to `_Competitor_Price_Current`;
4. exact-readback source lineage/current value;
5. stale/superseded/expired/conflict-held observations never become current merely because a stored label says `FRESH`.

Consumers determine current eligibility from current time versus `last_checked`/`fresh_until`, source lineage, queue status and freshness state. One fresh shop=Reference, two=Range, >=3=Range+Median; no fresh + history=STALE/Fresh Shops=0; no exact history=`NO EXACT BUNDLE YET`.

`PRICE UPDATED` requires non-zero delta on same event+business+package in the governed window. A new competitor at another price is new market evidence, not a price-change event.

## Source learning / persistence
- A newly verified recurring official source absent from `_Direct_Source_Map` becomes a persistence candidate for authorized Scanner write/readback.
- A learned miss is not terminal without a concrete source-map/planner/policy/alias repair and exact readback.

## Boundaries
- Return raw candidates to existing `EVIDENCE_VERIFIER` before protected truth.
- Scanner price persistence is allowed only when current policy authorizes it and never finalizes KK recommended price.
- No task create/delete/disable/pause/reschedule.
- No final event/monthly/business/Notification/provider/owner/customer write.

## Dependencies
- current Active policy
- POSTER_MEDIA_FACT_EXTRACTOR
- existing EVIDENCE_VERIFIER
- `lib/kk-competitor-discovery-contract.js`
- `lib/kk-discovery-closure-contract.js`
- `lib/kk-market-presentation-contract.js`

## Replay / regression tests
- unknown competitor event => raw signal, not final event
- >=2 independent businesses => P0 authority backcheck
- blocked due route => PARTIAL/debt
- verified recurring official source absent from map => persistence candidate
- exact X300 Pro + Lens => append history then current readback
- same-price recheck => no false PRICE UPDATED
- new shop different price => not PRICE UPDATED
- new/material <=14d P0/P1 + missing/stale exact bundle => targeted overnight price refresh
- far/P2 event => no special overnight price trigger
