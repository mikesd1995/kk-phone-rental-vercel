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

Always preserve:
- `authoritative=false`;
- `verifier_required=true`;
- `production_writes=0`;
- source URL, observed time, and evidence identity;
- current Machine-SOT policy, lock/fence, Manifest, and Planner gates when operating inside a governed runtime.

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
