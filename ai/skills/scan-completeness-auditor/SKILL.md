# SCAN_COMPLETENESS_AUDITOR

Status: **STAGING_REVIEWED_NOT_INSTALLED**

## Purpose
Prevent premature "scan complete" claims and gate the handoff to `CONTENT_THREE_VARIANT_ENGINE`.

## Inputs
- current Active `_Policy_Registry`
- source/access matrix
- verifier-promoted event facts
- official hashtag resolution
- competitor reverse-discovery coverage/results when required by Active policy
- exact/comparable competitor price scan results
- current competitor-price projection and append-only price lineage/history
- source-persistence / miss-learning readback when a new recurring official source or learned miss is produced
- pricing evidence ranking
- current product/footer/main-account rules

## Outputs
- `SCAN_STATE=COMPLETE / PARTIAL / BLOCKED`
- missing/unresolved checks
- source access summary using `CHECKED / PARTIAL / BLOCKED / NOT_ACCESSIBLE`
- reverse-discovery coverage summary when due
- `CONTENT_GATE=PASS / HOLD`
- allowed final-output scope

## Mandatory audit checks
- exact event identity promoted by `EVIDENCE_VERIFIER`
- event date and venue checked; unresolved conflicts surfaced
- >=1 official/authorized event source supports protected truth
- required social/media branch attempted with explicit access states
- official hashtag verification attempted; verified set or explicit UNRESOLVED
- when current Active policy requires competitor reverse discovery: every due active competitor source has an explicit attempt result; missing attempts remain coverage debt
- unknown competitor-surfaced event signals were normalized/deduped, geo-classified and routed to official authority verification before promotion
- out-of-area signals remained observability-only
- newly verified recurring official sources absent from `_Direct_Source_Map` have a persistence action + exact readback before a learned miss/run is called complete
- exact-event competitor scan/current-market resolution attempted as required by the current Active policy
- KK own listing exclusion confirmed
- competitor pricing used only from current-policy-authorized, verifier-promoted/current evidence
- if a current-price projection is authoritative: current rows are fresh, exact Event+Competitor+Package matched, source-lineage bound and read back
- stale/superseded/expired/conflict-held observations excluded from current range/median/recommendation
- append-only price history used for lineage/trend only, never silent current-price fallback
- exact/comparable evidence not silently mixed
- current product/footer/main-account rules resolved before content generation

## Rules
- Read the current Active policy every run; never freeze a historical policy version.
- `CHECKED`, `PARTIAL`, `BLOCKED`, `NOT_ACCESSIBLE` are distinct and must never be collapsed.
- A source attempt reported `BLOCKED` may satisfy attempt-count accounting but never successful-access coverage.
- Do not return COMPLETE if any policy-mandatory branch/source attempt was never attempted.
- Competitor reverse discovery completion and known-event price completion are separate gates.
- Competitor evidence alone never authorizes final event promotion.
- BLOCKED/NOT_ACCESSIBLE does not authorize invented facts and may require PARTIAL/BLOCKED.
- `CONTENT_GATE=PASS` only when the requested 3 variants can be generated without inventing protected facts/hashtag/price/link and all required current posting rules are resolved.
- If official hashtag is UNRESOLVED and current policy requires an official event hashtag in every variant, content gate is HOLD.
- If current exact-event competitor evidence is stale, conflict-held, missing lineage, insufficient or absent, require governed refresh/HOLD for any market-derived price decision; never silently reuse first-seen historical evidence.
- If competitor market price is unresolved, content may pass only if current KK pricing is independently authoritative and the requested post does not falsely claim competitor-derived pricing.
- A miss may be `LEARNED` only when a concrete source-map/planner/policy/alias correction has exact readback; otherwise keep `OPEN_REPAIR`.
- Existing `CONTENT_THREE_VARIANT_ENGINE` must not be called on HOLD.
- No task/control-plane/Core/Production mutation.

## Dependencies
- existing EVIDENCE_VERIFIER
- existing CONTENT_THREE_VARIANT_ENGINE
- current Active pricing/TTL/current-market contract
- `lib/kk-competitor-discovery-contract.js` when reverse-discovery/source-learning rules are active

## Replay / regression tests
- all mandatory gates passed => COMPLETE + PASS
- missing active competitor reverse-discovery attempt => PARTIAL/debt
- blocked competitor source => attempted but access truth remains BLOCKED
- unknown in-area signal without authority verification => not final/hold
- confirmed out-of-area signal => observability only
- verified recurring source without persistence/readback => not complete
- learned miss without concrete correction/readback => OPEN_REPAIR
- official source missing => HOLD
- hashtag unresolved while required => HOLD
- competitor/current-market resolution skipped when due => not COMPLETE
- raw/unverified competitor price evidence => HOLD for market-derived pricing
- stale/expired/conflict-held current rows => refresh/HOLD, not historical fallback
- current projection without exact source lineage/readback => HOLD
- generated variants missing required tag/footer/product => audit failure
