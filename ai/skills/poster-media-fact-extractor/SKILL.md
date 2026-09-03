# POSTER_MEDIA_FACT_EXTRACTOR

Status: **STAGING_REVIEWED_NOT_INSTALLED**

## Purpose
Extract factual candidates from owner-supplied or discovered posters/images/carousels/video frames without altering or inventing source content.

## Inputs
- poster/image/carousel/video frame
- surrounding source context and observed URL/source identity when available

## Outputs
- candidate event date/time/venue/city
- ticket/sale/registration/announcement date candidates kept separately
- official hashtag candidates
- candidate competitor price/package when visible in media
- confidence/readability per field
- visual support locator/description

## Rules
- Media is evidence, not an editable design.
- Never alter artist identity, faces, logos, names, date/time/venue, or other factual poster content.
- Separate EVENT DATE from ticket sale, registration, announcement, benefit, or application dates.
- Preserve multi-day events as explicit date ranges/rounds.
- If unreadable/ambiguous, mark unresolved; do not guess.
- A price seen in media is only a candidate until source attribution, event/package identity and freshness are verified.
- Return support detail so existing `EVIDENCE_VERIFIER` can cross-check and promote/reject.
- No schedule/Core/Production mutation.

## Dependencies
- existing EVIDENCE_VERIFIER

## Replay / regression tests
- poster with event + sale date
- multi-day event
- carousel fact on later slide
- low-readability text => unresolved
- time-only poster
- competitor price in image stays candidate until verifier
