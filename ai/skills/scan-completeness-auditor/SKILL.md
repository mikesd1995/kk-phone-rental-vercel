# SCAN_COMPLETENESS_AUDITOR

Status: **STAGING_REVIEWED_NOT_INSTALLED**

## Purpose
Prevent premature "scan complete" claims and gate the handoff to `CONTENT_THREE_VARIANT_ENGINE`.

## Inputs
- source/access matrix
- verifier-promoted event facts
- official hashtag resolution
- exact/comparable competitor scan results
- verifier-promoted competitor evidence
- pricing evidence ranking
- current product/footer/main-account rules

## Outputs
- `SCAN_STATE=COMPLETE / PARTIAL / BLOCKED`
- missing/unresolved checks
- source access summary using `CHECKED / BLOCKED / NOT_ACCESSIBLE`
- `CONTENT_GATE=PASS / HOLD`
- allowed final-output scope

## Mandatory audit checks
- exact event identity promoted by `EVIDENCE_VERIFIER`
- event date and venue checked; unresolved conflicts surfaced
- >=1 official/authorized event source supports protected truth
- required social/media branch attempted with explicit access states
- official hashtag verification attempted; verified set or explicit UNRESOLVED
- exact-event competitor scan attempted
- KK own listing exclusion confirmed
- competitor pricing used only from verifier-promoted evidence
- exact/comparable evidence not silently mixed
- current product/footer/main-account rules resolved before content generation

## Rules
- `CHECKED`, `BLOCKED`, `NOT_ACCESSIBLE` are distinct and must never be collapsed.
- Do not return COMPLETE if any mandatory branch was never attempted.
- BLOCKED/NOT_ACCESSIBLE does not authorize invented facts and may require PARTIAL/BLOCKED.
- `CONTENT_GATE=PASS` only when the requested 3 variants can be generated without inventing protected facts/hashtag/price/link and all required current posting rules are resolved.
- If official hashtag is UNRESOLVED and current policy requires an official event hashtag in every variant, content gate is HOLD.
- If competitor market price is unresolved, do not fabricate it; content may pass only if current KK pricing is independently authoritative and the requested post does not falsely claim competitor-derived pricing.
- Existing `CONTENT_THREE_VARIANT_ENGINE` must not be called on HOLD.
- No schedule/Core/Production mutation.

## Dependencies
- existing EVIDENCE_VERIFIER
- existing CONTENT_THREE_VARIANT_ENGINE

## Replay / regression tests
- all gates passed => COMPLETE + PASS
- official source missing => HOLD
- hashtag unresolved while required => HOLD
- competitor scan skipped => not COMPLETE
- blocked X with authorized ticket evidence => PARTIAL/BLOCKED as policy dictates, never fake checked
- competitor evidence raw/unverified => HOLD for market-derived pricing
- generated variants missing required tag/footer/product => audit failure
