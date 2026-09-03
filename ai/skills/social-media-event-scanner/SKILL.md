# SOCIAL_MEDIA_EVENT_SCANNER

Status: **STAGING_REVIEWED_NOT_INSTALLED**

## Purpose
Inspect relevant social channels for one on-demand X-post event and return raw social/media evidence without deciding official hashtag truth or final competitor pricing.

## Inputs
- event/artist/organizer account candidates
- known event identity terms
- competitor keywords when supplied by router

## Outputs
- raw social evidence rows
- channel/source
- source URL when actually observed
- freshness/post date when observable
- extracted claim/candidate
- access state: `CHECKED / BLOCKED / NOT_ACCESSIBLE`

## Rules
- Prioritize official X, Instagram, TikTok, YouTube Community and authorized organizer/artist/ticket accounts.
- Fan/support accounts are discovery signals only unless corroborated by authorized evidence.
- Media with factual text must be routed to `POSTER_MEDIA_FACT_EXTRACTOR`.
- Never infer an official hashtag solely from fan/community usage.
- Never infer a competitor price from product availability or generic historical rates.
- Replies/quotes/pinned/profile context may be inspected when relevant and accessible.
- Record access failure explicitly and preserve the distinction between BLOCKED and NOT_ACCESSIBLE.
- This skill returns raw evidence only; `OFFICIAL_HASHTAG_VERIFIER` and competitor verifier/ranker run downstream.
- No dependency back to hashtag verifier or competitor ranker.
- No schedule/Core/Production mutation.

## Dependencies
- POSTER_MEDIA_FACT_EXTRACTOR

## Replay / regression tests
- official X announcement
- IG carousel routed to media extractor
- TikTok caption
- X reply with price remains raw candidate
- blocked profile recorded BLOCKED
- fanbase-only hashtag remains candidate/unverified
