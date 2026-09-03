# COMPETITOR_PRICE_EVIDENCE_RANKER

Status: **STAGING_REVIEWED_NOT_INSTALLED**

## Purpose
Rank only verifier-promoted competitor evidence so KK pricing context uses fresh, comparable and independent sources.

## Inputs
- competitor evidence already promoted/rejected by existing `EVIDENCE_VERIFIER`
- exact event identity
- target product/package
- business identity/dedup result
- timestamps/freshness

## Outputs
- accepted exact evidence
- accepted comparable evidence kept separate
- rejected evidence with reason
- independent-shop count
- exact range eligibility
- exact median eligibility

## Rules
- Never accept raw unverified hunter output directly.
- Highest rank: exact-event + exact product/package + current direct evidence.
- Duplicate accounts/posts of the same business count once.
- Exact-event range requires >=2 independent shops.
- Exact-event median requires >=3 independent shops.
- Comparable evidence must remain labeled and must never be mixed silently into exact statistics.
- Reject stale, wrong-event, package-mismatched, self-listing, ambiguous-price or unverifiable evidence.
- Do not automatically choose/undercut the cheapest competitor.
- No dependency back to `COMPETITOR_RENTAL_HUNTER`; consume verifier-promoted evidence supplied by router.
- No schedule/Core/Production mutation.

## Dependencies
- existing EVIDENCE_VERIFIER

## Replay / regression tests
- 2 independent shops => range yes / median no
- 3 independent shops => median eligible
- same business via duplicate accounts counts once
- package mismatch rejected
- comparable fallback kept separate
- stale post rejected
- raw unverified hunter row rejected
