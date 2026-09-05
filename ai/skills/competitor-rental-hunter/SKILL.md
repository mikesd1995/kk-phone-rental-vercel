# COMPETITOR_RENTAL_HUNTER

Status: **STAGING_REVIEWED_NOT_INSTALLED**

## Purpose
Collect raw competitor rental evidence without assuming that the event already exists in runtime SOT.

Under Active policy v4.9.4 or a compatible successor, the hunter has two distinct logical modes inside an already-due competitor window:

1. **REVERSE EVENT DISCOVERY** — inspect active competitor feeds/dynamic search for event names, hashtags, dates and venues that may be absent from Candidate/Lifecycle/monthly/archive.
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

## Source learning / persistence
- When reverse discovery resolves a previously unmapped official recurring organizer/agency/venue/ticket source, return a persistence candidate for `_Direct_Source_Map`.
- Persistence requires verified official identity, recurring-source behavior, canonical source name/URL/media route and exact readback by the authorized Scanner path.
- A learned miss is not terminal unless it references a concrete source-map/planner/policy/alias correction with exact readback.

## Boundaries
- Return raw candidates to existing `EVIDENCE_VERIFIER` before accepted protected event/pricing truth is created.
- Do not call/depend on `COMPETITOR_PRICE_EVIDENCE_RANKER`; ranking is downstream.
- No task create/delete/disable/pause/reschedule.
- No final event/monthly/business/Notification/provider/owner/customer write.

## Dependencies
- current Active policy
- POSTER_MEDIA_FACT_EXTRACTOR
- existing EVIDENCE_VERIFIER
- `lib/kk-competitor-discovery-contract.js` for deterministic routing/coverage contract

## Replay / regression tests
- unknown event in competitor feed => raw unknown-event signal, not final event
- known event in competitor feed => known-event path
- out-of-area signal => observability only
- blocked/not-accessible source preserves access truth
- all active competitor sources attempted => reverse-discovery coverage complete
- missing active competitor attempt => coverage partial/debt
- verified recurring official source absent from map => persistence candidate
- learned miss without concrete correction/readback => OPEN_REPAIR
- same-event text price
- same-event image price
- generic shop rate only => not exact
- old event price rejected for exact
- KK own listing excluded
- reply/quote price candidate
