# OFFICIAL_HASHTAG_VERIFIER

Status: **STAGING_REVIEWED_NOT_INSTALLED**

## Purpose
Verify exact-event official hashtags after event identity is promoted by existing `EVIDENCE_VERIFIER`.

## Inputs
- verified exact event identity
- promoted official/authorized source evidence
- poster/media hashtag candidates
- official social evidence candidates

## Outputs
- verified exact-event hashtag set
- supporting source(s)
- rejected/unverified hashtag candidates with reason
- resolution state: `VERIFIED / UNRESOLVED`

## Rules
- Run only after exact event identity is verified/promoted.
- Highest authority: official organizer/promoter/agency/artist announcement or official poster tied to the exact event.
- Never synthesize a hashtag from event name, artist name, or fan usage.
- Fan/community frequency alone is insufficient for VERIFIED.
- Preserve official spelling/capitalization where possible.
- If official sources conflict, prefer authority/freshness; otherwise keep unresolved.
- If no official event hashtag can be verified, return UNRESOLVED rather than inventing one.
- Do not call or depend on `SOCIAL_MEDIA_EVENT_SCANNER`; consume its upstream evidence supplied by the router.
- No schedule/Core/Production mutation.

## Dependencies
- existing EVIDENCE_VERIFIER

## Replay / regression tests
- exact-event official X hashtag
- official poster hashtag
- fan-created tag only => unresolved
- two official spellings with freshness resolution
- no hashtag found => unresolved
- wrong-event official hashtag rejected
