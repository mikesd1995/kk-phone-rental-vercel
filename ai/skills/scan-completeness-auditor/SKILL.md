# SCAN_COMPLETENESS_AUDITOR

Status: **STAGING_REVIEWED_NOT_INSTALLED**

## Purpose
Prevent premature "scan complete" claims and gate the handoff to `CONTENT_THREE_VARIANT_ENGINE`.

## Inputs
- current Active `_Policy_Registry`
- source/access matrix
- verifier-promoted event facts
- official hashtag resolution
- exact/comparable competitor scan results
- current competitor-price projection and append-only price lineage/history defined by Active policy
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
- exact-event competitor scan/current-market resolution attempted as required by the current Active policy
- KK own listing exclusion confirmed
- competitor pricing used only from current-policy-authorized, verifier-promoted/current evidence
- if a current-price projection is authoritative: current rows are fresh, exact Event+Competitor+Package matched, source-lineage bound and read back
- stale/superseded/expired/conflict-held observations excluded from current range/median/recommendation
- append-only price history used for lineage/trend only, never silent current-price fallback
- exact/comparable evidence not silently mixed
- current product/footer/main-account rules resolved before content generation

## Rules
- Read the current Active policy every run; this skill must not freeze a historical policy version.
- `CHECKED`, `BLOCKED`, `NOT_ACCESSIBLE` are distinct and must never be collapsed.
- Do not return COMPLETE if any mandatory branch was never attempted.
- BLOCKED/NOT_ACCESSIBLE does not authorize invented facts and may require PARTIAL/BLOCKED.
- `CONTENT_GATE=PASS` only when the requested 3 variants can be generated without inventing protected facts/hashtag/price/link and all required current posting rules are resolved.
- If official hashtag is UNRESOLVED and current policy requires an official event hashtag in every variant, content gate is HOLD.
- If current exact-event competitor evidence is stale, conflict-held, missing lineage, insufficient or absent, require governed refresh/HOLD for any market-derived price decision; never silently reuse first-seen historical evidence.
- If competitor market price is unresolved, content may pass only if current KK pricing is independently authoritative and the requested post does not falsely claim competitor-derived pricing.
- Existing `CONTENT_THREE_VARIANT_ENGINE` must not be called on HOLD.
- No schedule/Core/Production mutation.

## Dependencies
- existing EVIDENCE_VERIFIER
- existing CONTENT_THREE_VARIANT_ENGINE
- current Active pricing/TTL/current-market contract

## Replay / regression tests
- all gates passed => COMPLETE + PASS
- official source missing => HOLD
- hashtag unresolved while required => HOLD
- competitor/current-market resolution skipped when due => not COMPLETE
- blocked X with authorized ticket evidence => PARTIAL/BLOCKED as policy dictates, never fake checked
- raw/unverified competitor evidence => HOLD for market-derived pricing
- stale/expired/conflict-held current rows => refresh/HOLD, not historical fallback
- current projection without exact source lineage/readback => HOLD
- generated variants missing required tag/footer/product => audit failure
