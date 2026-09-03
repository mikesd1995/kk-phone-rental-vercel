# COMPETITOR_RENTAL_HUNTER

Status: **STAGING_REVIEWED_NOT_INSTALLED**

## Purpose
Collect raw competitor smartphone/lens rental evidence for the exact verified event, then optionally comparable events when instructed by the router.

## Inputs
- verified exact event identity
- verified date/venue when available
- target product/package
- known competitor account/search terms
- upstream social/media evidence

## Outputs
- raw competitor evidence candidates
- candidate label `EXACT / COMPARABLE / UNRESOLVED`
- shop/account/business identity candidate
- product/package candidate
- price candidate + unit/duration when explicit
- source URL/source type when observed
- freshness
- access state

## Rules
- Search exact event first.
- Inspect accessible direct posts, replies, quotes, pinned/profile context, media, booking forms/pages and websites when relevant.
- KK Phone Rental own listings are always excluded.
- Never infer a price from availability, generic product offering, old unrelated event, or unverified screenshot.
- `EXACT` requires explicit exact-event identity plus package/model comparability; otherwise use UNRESOLVED/COMPARABLE as appropriate.
- Media-only prices go through `POSTER_MEDIA_FACT_EXTRACTOR` and retain attributable source context.
- If exact-event evidence is insufficient, return `INSUFFICIENT_EXACT`; comparable scan may then be requested explicitly.
- Return raw candidates to existing `EVIDENCE_VERIFIER` before any accepted pricing evidence is created.
- Do not call/depend on `COMPETITOR_PRICE_EVIDENCE_RANKER`; ranking is downstream.
- No schedule/Core/Production mutation.

## Dependencies
- POSTER_MEDIA_FACT_EXTRACTOR
- existing EVIDENCE_VERIFIER

## Replay / regression tests
- same-event text price
- same-event image price
- generic shop rate only => not exact
- old event price rejected for exact
- KK own listing excluded
- reply/quote price candidate
- inaccessible competitor source preserves access state
