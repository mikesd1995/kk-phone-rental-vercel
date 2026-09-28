---
name: kk-discovery-scanner
description: Use for KK Phone Rental event discovery, ultra-deep scans, source expansion, candidate staging, and Scanner work. Enforces staging-only authority, evidence provenance, exact source attribution, and zero direct business writes.
---

# KK Discovery Scanner

Use this skill when finding concert, fan-meeting, premiere, screening, artist, venue, ticketing, or competitor signals for KK Phone Rental.

## Authority boundary

The Scanner is discovery/staging only.

Never:
- write final event truth, final pricing, booking, inventory, customer, or monthly business state;
- bypass GPT Verifier;
- send LINE, Telegram, X, or owner notifications directly;
- create a replacement Scanner, watchdog, or competing writer;
- convert missing evidence into a positive claim.

## Owner storefront visibility is immutable to Scanner

An existing Core event with `active_on_web=false` is an explicit owner decision, not missing discovery coverage.

- Never set `active_on_web=true` because a hidden event falls inside the current/next-week scan window.
- Never label an owner-hidden Core event as “reactivated” or repair it into storefront visibility.
- Discovery may report that the event exists and is owner-hidden, but `production_writes=0` remains mandatory.
- Only an explicit owner/Admin visibility action may reopen a hidden event card.
- When reconciling an existing event, preserve owner-hidden state exactly.

Always preserve:
- `authoritative=false`;
- `verifier_required=true`;
- `production_writes=0`;
- source URL, observed time, and evidence identity;
- current Machine-SOT policy, lock/fence, Manifest, and Planner gates when operating inside a governed runtime.

## Publish eligibility is independent from competitor pricing

Competitor-price discovery is pricing evidence, not permission to publish an event.

- Do not drop or block a verified candidate merely because no exact-event competitor price is found.
- Stage the candidate's rental-fit evidence and score separately from pricing evidence.
- A candidate that meets the owner-approved rental-fit threshold may continue to Verifier even when exact competitor count is zero.
- Preserve zero-competitor state explicitly so downstream pricing can mark a fallback price as provisional when required.
- Do not invent a final price in Scanner. Scanner remains staging-only and `production_writes=0`.
- A low rental-fit candidate may be rejected on rental-fit grounds; the rejection reason must not be disguised as missing competitor evidence.

## Discovery order

1. Prefer official artist/agency, event organizer, ticketing, and venue sources.
2. Use source-watch/change-detection signals to avoid rescanning unchanged pages.
3. Use Exa for semantic discovery and gap-finding.
4. Use managed/custom crawlers only for extraction that search cannot supply.
5. Deduplicate and normalize before handoff.
6. Send candidates to the existing Scanner → Verifier route only.

## Change detection

For a watched source, normalize observations through `server/discovery-source-watch-contract.js`.

- `UNCHANGED` → stop; do not spend downstream discovery calls.
- `NEW` / `CHANGED` → eligible for staging discovery only.
- `ERROR` → record provider failure; do not fabricate an event.
- Invalid/stale/ambiguous evidence → fail closed.

## Candidate evidence

A staged candidate should include, when available:
- candidate ID;
- event title;
- artist(s);
- event date/time;
- venue;
- source URL;
- source tier;
- observed time;
- evidence/change identity;
- confidence or extraction notes.

Missing values remain unknown. Do not infer them from unrelated sources.

## Handoff

A valid handoff must remain:

```text
handoff_state = DISCOVERY_STAGING_ONLY or READY_FOR_VERIFIER
authoritative = false
verifier_required = true
production_writes = 0
final_truth_mutation = false
notification_sends = 0
```

If a provider tries to mark data verified/final or write the Machine SOT, reject the result.
