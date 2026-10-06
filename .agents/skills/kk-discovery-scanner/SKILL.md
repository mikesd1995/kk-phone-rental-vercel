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

## Persistent visibility history and anti-recreate rule

`18_Event_Visibility_Locks` is the durable visibility/history SOT for Ultra Deep and reconciliation work.

- `LOCKED` means an explicit owner-hidden tombstone. Scanner must never create, recreate, reopen, or recommend automatic publication for that event identity.
- `REOPENED` means the owner explicitly reopened a previously hidden event. It remains historical and must be reconciled to the existing Core row, not recreated.
- `SEEN_CORE` records that an event has already existed in Core. If its Core row later disappears, rediscovery is historical reconciliation debt, not permission to create a fresh event automatically.
- Match history by exact `event_id` first, then normalized event name + event date + venue. A new generated event ID does not bypass the tombstone.
- Ultra Deep output for any history hit must be `EXISTS/RECONCILE/HOLD_OWNER_HIDDEN`, never `NEW_AUTO_PUBLISH`.
- Only an explicit owner/Admin reopen may transition `LOCKED → REOPENED`; Scanner cannot emit that intent.

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

## Rental-opportunity discovery contract (2026-10-06)

Discovery must optimize recall for **rental opportunities**, not merely concerts.

Required source classes for a monthly/full scan:
1. official organizers/promoters;
2. ticketing platforms;
3. venues;
4. artist/agency schedules;
5. fandom/fanclub/community signals;
6. public social/X announcement and engagement signals;
7. competitor rental listings and rental-keyword radar;
8. brand/sponsor/mall activations;
9. fanmeeting/fancon/fansign/birthday/final-EP/premiere/blessing/lucky-fan/meet-and-greet/sport/special-stage formats;
10. public event calendars as a recall layer, never final authority.

A scan may not claim coverage complete while any required source class has no executed evidence/receipt.

### Fandom graph expansion

When a fandom, artist, actor pair, group or agency is high-priority, expand discovery to adjacent identities and formats. Example: pair -> each member -> agency -> brand appearances -> mall events -> fan benefits -> birthday/fansign/fancon/additional rounds. This is a discovery expansion rule, not verification.

### Competitor rental radar

Competitor listings are both pricing evidence and discovery radar. Search exact event/artist/fandom names with rental-intent terms such as phone rental, เช่ามือถือ, vivo, X300 Pro, iPhone, Samsung, lens, waitlist/คิวหลุด. Multiple independent rental listings for an event not in Candidate Master Pool must raise `DISCOVERY_MISS_HIGH_CONFIDENCE` and trigger official-source verification.

### Internal feedback boundary

KK booking, revenue, inquiry, full-stock and waitlist outcomes may increase **discovery priority only** for the same/adjacent fandom. They must never increase External Demand Score, never bypass Verifier, and never directly authorize storefront publication.

A full/high-waitlist event should trigger adjacent-fandom expansion and announcement early-warning, while retaining its actual inventory state.

### Candidate Master Pool

Discovery is intentionally broad. Keep viable discoveries in Candidate Master Pool even when they are not storefront-worthy. Required candidate fields should preserve event identity, date, venue/city, event type, artist/fandom, organizer, ticketing/official source, poster lead, discovery source class, observed time, confidence and change state.

Discovery output is not storefront publication. New-event publication requires the downstream External Demand hard gate.

## Parent vs fandom sub-event rule (2026-10-07)

When discovery finds a high-demand fansign/artist slot inside an existing parent event, do not create a duplicate storefront card by default.

If child and parent share date, venue, admission and operational pickup/return boundary:
- attach child external rental/social/photo-intent evidence to the parent;
- use only external-market child evidence to strengthen the parent external score;
- keep one storefront identity.

Create a separate candidate only when date, venue, admission, pickup window or another operational boundary is genuinely distinct.

A high-demand child signal may never reopen a LOCKED or owner-hidden parent.
