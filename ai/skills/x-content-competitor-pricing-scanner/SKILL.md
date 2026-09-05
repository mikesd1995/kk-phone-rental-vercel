# X_CONTENT_COMPETITOR_PRICING_SCANNER

Status: **STAGING_REVIEWED_NOT_INSTALLED**

## Purpose
Top-level **on-demand only** router for KK Phone Rental X post preparation. It must never attach to, replace, reschedule, or mutate the hourly Core Discovery Scanner.

## Primary trigger
`ขอโพสงานนี้บน X`

Equivalent owner intents may also route here, but the primary trigger above is canonical.

## Inputs
- event name and/or owner-supplied poster/link/image
- current Machine SOT event data if present
- current Active `_Policy_Registry`
- current KK pricing/footer/product rules
- current competitor-price projection/history surfaces defined by the Active policy

## Mandatory run sequence
1. `EVENT_WEB_RESEARCH_ORCHESTRATOR` — official/authorized event verification plan and source-access matrix.
2. `SOCIAL_MEDIA_EVENT_SCANNER` — inspect relevant social channels and discovered media.
3. `POSTER_MEDIA_FACT_EXTRACTOR` — when facts are embedded in owner/discovered media.
4. existing `EVIDENCE_VERIFIER` — promote only supported event facts; unresolved conflicts remain unresolved.
5. `OFFICIAL_HASHTAG_VERIFIER` — verify exact-event official hashtag(s) from promoted evidence.
6. Resolve the current pricing surfaces/TTL rules from the Active Machine SOT. When a current competitor projection exists, read it before deciding whether competitor refresh is required.
7. `COMPETITOR_RENTAL_HUNTER` — exact-event refresh first when current evidence is absent, stale, conflict-held, insufficient, or due under policy; comparable fallback only when required.
8. existing `EVIDENCE_VERIFIER` — verify/dedup any newly collected competitor observations before pricing use.
9. Update/use the current projection only according to Machine-SOT append-history → current-projection → exact-readback semantics.
10. `COMPETITOR_PRICE_EVIDENCE_RANKER` — rank only current fresh exact evidence for range/median/current-market use; history is lineage/trend only.
11. `SCAN_COMPLETENESS_AUDITOR` — issue `COMPLETE / PARTIAL / BLOCKED` and `CONTENT_GATE=PASS/HOLD`.
12. existing `CONTENT_THREE_VARIANT_ENGINE` — run only when `CONTENT_GATE=PASS`; return exactly 3 main-account X variants.

## Access-state contract
Every required source/channel attempt must record exactly one of:
- `CHECKED`
- `BLOCKED`
- `NOT_ACCESSIBLE`

A blocked or inaccessible source is not equivalent to checked/no-result. Never claim a full scan when a mandatory branch was not actually checked.

## Outputs
- exactly 3 verified X variants only when `CONTENT_GATE=PASS`
- otherwise verified scope plus exact unresolved/blocked items
- internal evidence/completeness summary

## Current-market pricing contract
- Current Active Machine SOT decides the authoritative current-market surface and TTL; never pin an older policy in this skill.
- When `_Competitor_Price_Current` (or its current-policy successor) is authoritative, consume its **fresh exact-event rows first**.
- `_Price_Evidence` remains append-only historical lineage/trend and must not silently substitute for stale/missing current projection.
- Stale, superseded, expired, lineage-missing or `CONFLICT_HOLD` offers are excluded from current exact range/median/recommendation.
- Current projection rows require exact Event + normalized competitor + package identity and source-evidence lineage/readback.
- If current exact-event market is insufficient, request/perform governed refresh or HOLD the market-derived decision; comparable fallback stays explicitly separate.
- A current competitor refresh never authorizes auto-undercutting or a final KK price by itself.

## Rules
- On-demand only. No cron/schedule/automation mutation and no Core Discovery Scanner hook.
- No Production write, publish, notification, Make activation, or owner-send side effect from this skill.
- Never invent date, time, venue, hashtag, source link, competitor price, package match, access success, or current-market freshness.
- KK Phone Rental own listing never counts as competitor evidence.
- Exact-event evidence has priority; comparable evidence must stay explicitly labeled.
- Existing `EVIDENCE_VERIFIER` is the promotion gate for event facts and newly collected competitor evidence.
- Existing `CONTENT_THREE_VARIANT_ENGINE` receives verified facts/pricing/hashtags only.
- If the content gate is HOLD, return verified scope + exact unresolved/blocked items; do not fabricate 3 "verified" variants.
- If competitor market price is unresolved, content may pass only when the current KK campaign price is independently authoritative and the copy makes no false competitor-derived claim.
- Product/footer/pricing display must come from current active KK rules, not hard-coded historical text when live policy differs.
- Main account only.

## Dependencies
- `EVENT_WEB_RESEARCH_ORCHESTRATOR`
- `SOCIAL_MEDIA_EVENT_SCANNER`
- `POSTER_MEDIA_FACT_EXTRACTOR`
- existing `EVIDENCE_VERIFIER`
- `OFFICIAL_HASHTAG_VERIFIER`
- `COMPETITOR_RENTAL_HUNTER`
- `COMPETITOR_PRICE_EVIDENCE_RANKER`
- `SCAN_COMPLETENESS_AUDITOR`
- existing `CONTENT_THREE_VARIANT_ENGINE`

## Replay / regression tests
- canonical short trigger still executes all mandatory stages
- poster-only request does not bypass official verification
- blocked social source reports BLOCKED and cannot become CHECKED
- no official source => event promotion/content gate HOLD
- unverified hashtag => unresolved, never synthesized
- fresh current exact competitor price is preferred over older history
- stale/expired/conflict-held current market forces refresh/HOLD, not historical fallback
- exact competitor price passes verifier/ranker before pricing use
- same-shop duplicate evidence counts once
- no competitor price found => no fabricated market price
- comparable evidence stays separate
- content engine is never called before `CONTENT_GATE=PASS`
- no schedule/Core/Production mutation
