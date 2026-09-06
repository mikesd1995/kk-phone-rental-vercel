# COMPETITOR_RENTAL_HUNTER

Status: **STAGING_REVIEWED_NOT_INSTALLED**

## Purpose
Collect raw competitor rental evidence and use competitor feeds as one discovery surface without assuming that the event already exists in runtime SOT.

Under the current Active policy (v4.9.7 or a compatible successor), the hunter has two distinct logical modes inside an already-due competitor window:

1. **REVERSE EVENT DISCOVERY** — inspect active competitor feeds/dynamic search for event names, aliases, hashtags, dates and venues that may be absent from Candidate/Lifecycle/monthly/archive.
2. **KNOWN-EVENT PRICE / AVAILABILITY** — for an already verified event, collect exact-event phone/lens/package evidence, then optionally comparable evidence when the router explicitly requests it.

This skill does not create schedules and does not promote raw competitor evidence into canonical event truth.

## Inputs
- current Active `_Policy_Registry`
- mode: `REVERSE_DISCOVERY / KNOWN_EVENT_EXACT / COMPARABLE`
- active competitor account/search source identity
- verified exact event identity when mode requires it
- target product/package when pricing is requested
- upstream social/media evidence where available
- current runtime event identities for unknown-event detection

## Outputs
- source attempt result: `FOUND_NEW_EVENT / NO_NEW_EVENT / PARTIAL / BLOCKED`
- raw unknown-event signal with normalized event-name/hashtag/date/venue candidates
- raw competitor evidence candidates
- candidate label `EXACT / COMPARABLE / UNRESOLVED`
- shop/account/business identity candidate
- product/package candidate
- price candidate + unit/duration when explicit
- source URL/source type when observed
- freshness
- access state `CHECKED / PARTIAL / BLOCKED / NOT_ACCESSIBLE`

## v4.9.7 MAX-RECALL rules
- Discovery breadth is identical across the in-year horizon; event distance changes only re-fetch frequency, not source-family eligibility.
- Competitor reverse discovery is Pass C of the governed multi-pass universe: A official/ticket/venue/organizer/agency/artist/series/brand/mall/cinema, B opportunity keywords/aliases, C reverse competitor, D negative cross-source set-difference audit.
- Two or more independent competitor businesses referencing the same untracked in-area event create a P0 discovery alarm. Linked/sister accounts count once and KK Phone Rental never counts.
- Competitor mentions remain discovery evidence only. Unknown events must be authority-backchecked and become a deterministic Candidate+packet handoff, a duplicate/existing link, out-of-area resolution, or explicit HOLD/SUPPRESS.
- No extracted in-area in-year signal may disappear between parsing and operational accounting. Unaccounted signal count must be zero before normal Scanner FINISHED.
- Root/profile access alone never proves competitor-family coverage when due feed/post/search sections were not attempted. Blocked sections remain PARTIAL.
- Recall precedes business scoring: do not discard a plausible in-area event merely because initial rental fit appears low.

## Reverse-discovery rules
- Reverse discovery is logically separate from the known-event price scan; completion of one never implies completion of the other.
- An unknown event surfaced by a competitor is a **raw discovery signal only**.
- Normalize event name/hashtag/date/venue, deduplicate against Candidate/Lifecycle/monthly/archive, then apply geo classification and official-authority verification.
- Parse visible event signals from a feed already accessed before geo suppression so `seen then filtered` remains distinguishable from `never seen`.
- Confirmed out-of-area events are observability-only and must not enter Candidate/monthly/price/inventory/Decision/Notification.
- Competitor evidence alone never authorizes final event promotion.
- Every active competitor source due under the current policy must retain a same-day attempt result; missing attempts are coverage debt.

## Known-event pricing rules
- Search exact event first.
- Inspect accessible direct posts, replies, quotes, pinned/profile context, media, booking forms/pages and websites when relevant.
- KK Phone Rental own listings are always excluded.
- Never infer a price from availability, generic product offering, old unrelated event, or unverified screenshot.
- `EXACT` requires explicit exact-event identity plus package/model comparability; otherwise use `UNRESOLVED/COMPARABLE` as appropriate.
- Media-only prices go through `POSTER_MEDIA_FACT_EXTRACTOR` and retain attributable source context.
- If exact-event evidence is insufficient, return `INSUFFICIENT_EXACT`; comparable scan may then be requested explicitly.
- Accepted current pricing must follow the current Active policy freshness/source-lineage contract; append-only history is never a silent current-price fallback.

## v4.9.7 price persistence
For every **verified exact-event vivo X300 Pro + Lens** observation in a due scan:

1. preserve exact Event + competitor business + package identity;
2. append the observation to `_Price_Evidence` history;
3. only after the append succeeds, upsert the newest valid identity into `_Competitor_Price_Current`;
4. exact-read back source lineage/current value before run finish;
5. same-price rechecks may refresh observation/check freshness where policy permits;
6. stale/superseded history is never silently promoted to current truth.

Monthly market presentation is derived from `_Competitor_Price_Current`: one independent fresh shop = Reference, two = Range, three or more = Range + Median. No fresh current rows with historical exact-bundle evidence = explicit STALE last-known context with Fresh Shops=0. No exact-bundle history = `NO EXACT BUNDLE YET`.

A visible `PRICE UPDATED` event is valid only for a non-zero price delta on the same normalized event + same competitor business + same package within the governed recent window. A newly discovered shop with a different price is new market evidence, not a price-change event.

## Source learning / persistence
- When reverse discovery resolves a previously unmapped official recurring organizer/agency/venue/ticket source, return a persistence candidate for `_Direct_Source_Map`.
- Persistence requires verified official identity, recurring-source behavior, canonical source name/URL/media route and exact readback by the authorized Scanner path.
- A learned miss is not terminal unless it references a concrete source-map/planner/policy/alias correction with exact readback.

## Boundaries
- Return raw candidates to existing `EVIDENCE_VERIFIER` before accepted protected event/pricing truth is created.
- Do not call/depend on `COMPETITOR_PRICE_EVIDENCE_RANKER`; ranking is downstream.
- Scanner may persist verified price observation/current projection only when the live policy explicitly authorizes that data-plane scope; it still does not finalize KK recommended price.
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
- unknown event in competitor feed => raw unknown-event signal, not final event
- >=2 independent shops mention unknown in-area event => P0 authority-backcheck alarm
- known event in competitor feed => known-event path
- out-of-area signal => observability only
- blocked/not-accessible section => attempted but coverage PARTIAL
- all required competitor sections attempted => family coverage may become full
- verified recurring official source absent from map => persistence candidate
- learned miss without concrete correction/readback => OPEN_REPAIR
- exact-event X300 Pro + Lens observation => append history then current upsert/readback
- same price recheck => no false PRICE UPDATED
- same event/shop/package changed price => recent PRICE UPDATED eligible
- new shop different price => not a price-change event
- generic shop rate only => not exact
- old event price rejected for exact
- KK own listing excluded
