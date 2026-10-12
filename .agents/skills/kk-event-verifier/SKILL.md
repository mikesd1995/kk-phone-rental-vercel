---
name: kk-event-verifier
description: Use for KK Phone Rental event verification, candidate adjudication, source conflict review, deduplication decisions, and final evidence checks before any governed event handoff. Keeps external AI and crawlers advisory.
---

# KK Event Verifier

Use this skill after Discovery Scanner produces staged candidates.

## Final-authority rule

External search, Exa, crawlers, change detectors, Hugging Face, embeddings, and rerankers are advisory evidence only. They never become final truth by themselves.

The Verifier must:
- bind evidence to the exact candidate/run;
- check source identity and freshness;
- distinguish official confirmation from secondary reporting;
- resolve duplicate/identity conflicts conservatively;
- preserve unknown fields as unknown;
- require governed write/readback contracts before any final business mutation.

## Source priority

Prefer direct evidence in this order when facts conflict:
1. official artist/agency/organizer;
2. official ticketing;
3. official venue;
4. clearly attributable partner/brand announcement;
5. competitor/social/community evidence.

Lower-tier evidence may discover an event but must not silently override higher-tier evidence.

## Conflict handling

When date, venue, artist identity, event title, cancellation, or ticket status conflicts:
- retain all conflicting evidence;
- identify the exact field in conflict;
- do not average or guess;
- classify the candidate as requiring further verification;
- block final write until evidence is resolved under current policy.

## Deduplication

Semantic similarity is supporting evidence, not identity proof.

Protect hard identity boundaries such as:
- different event dates;
- different cities/venues when they imply separate shows;
- separate sessions/days;
- different artist/event organizer combinations.

Do not merge solely because names are similar.


## Operational packet identity and no-drop reconciliation

The operational READY queue is anchored in `_AI_Inbox`, not in Candidate:

- operational packet = nonblank `Work Packet ID` AND `Packet Status=READY_FOR_VERIFIER`;
- `_Candidate_Queue` does not contain a Work Packet ID column and must never be rejected merely for lacking one;
- join an AI packet to Candidate by exact `Show ID` first;
- only when Show ID is unavailable, use exact `Event Family ID + event date` and require exactly one match;
- zero or multiple matches become explicit pairing debt/HOLD. Never resolve the ambiguity with fuzzy title matching.
- reverse-audit Candidate rows whose `Status=READY_FOR_VERIFIER`: if no AI packet exists by exact Show ID or exact Event Family ID + date, surface `CANDIDATE_READY_ORPHAN_NO_AI_PACKET`; if only terminal AI packets exist, surface `STALE_CANDIDATE_READY_AFTER_AI_TERMINAL`. Candidate-only READY rows never inflate the operational AI backlog.

After a safe COMMIT/HOLD, terminalize both surfaces consistently. A canonical/monthly write that leaves AI or Candidate operationally READY is a partial close with explicit stale-ready debt.

For multi-day families, compute the complete discovered set of day/show instances. A family is not cleanly closed while any discovered instance lacks an explicit monthly disposition and Core lineage-or-debt disposition. Partial prefixes are explicit family-completeness debt.

Run reverse reconciliation as part of closeout: a current/future Core `01_Events` / `08_Web_Ready` row with no Tracker lineage/monthly disposition is a reverse Core orphan. A Tracker-discovered show with no Core counterpart is Core-promotion debt. This Verifier may repair only Tracker canonical/monthly state within current policy; Core backend event/package/poster creation remains a separate governed Admin action.

## Owner-hidden Core events

Core storefront visibility is owner business intent and is outside Verifier authority.

If an existing Core event has `active_on_web=false`:

- treat the event as present in Core, not as missing promotion;
- do not reopen it during no-drop reconciliation, monthly repair, or Core promotion follow-up;
- preserve `active_on_web=false` even when the event is verified, current/future, and has valid packages;
- only an explicit owner/Admin visibility action may transition it back to visible.

A hidden Core event may still satisfy lineage/presence accounting. Hidden does not mean missing.

## Persistent visibility history / tombstone authority

Before Core promotion, read `18_Event_Visibility_Locks` and resolve the candidate against durable history.

- `LOCKED` → `OWNER_HIDDEN_RECREATE_PROHIBITED`; do not create or reopen.
- `SEEN_CORE` or `REOPENED` with no current Core row → `HISTORICAL_EVENT_RECREATE_PROHIBITED`; treat it as historical reconciliation debt and do not create a replacement under a new event ID.
- Existing Core row → reconcile/update the existing identity only; creation is not allowed.
- Match exact `event_id` first, then normalized event name + date + venue. Event-ID regeneration is not an escape hatch.
- A legitimate owner reopen must use the existing event update path with `visibility_owner_intent=explicit_owner_reopen`, which transitions the lock record to `REOPENED` while preserving history.
- Final storefront readback must respect the data-plane lock even if a raw writer accidentally flips `01_Events.active_on_web` back to TRUE.

## Publish eligibility vs pricing confidence

Verifier must treat these as separate decisions:

- **Publish eligibility** answers whether a verified event is worth offering for KK Phone Rental, using rental-fit score, fandom/engagement, event format, venue/scale, and inventory opportunity cost.
- **Pricing confidence** answers how strong the price evidence is.
- Missing exact-event competitor pricing is never, by itself, a publish blocker when rental-fit eligibility passes.
- If exact-event competitor evidence is absent and an owner-approved fallback pricing policy resolves package prices, publication may proceed.
- For Friday–Sunday events with zero exact-event competitor evidence, the fallback price must carry `PROVISIONAL_NEEDS_PRICE_RECHECK` / `needs_price_recheck=true` so Competitor Watch can recalibrate it later.
- Verifier must not convert a provisional price into a claim of market-confirmed pricing.
- Low rental-fit candidates may be rejected as `REJECTED_LOW_RENTAL_FIT`; do not mislabel them as competitor-evidence failures.

## Booking-close vs event-close semantics

- Closing booking means the event card remains visible and package availability may resolve to `show_full` / `เต็มแล้ว`.
- Closing the event means the event card is hidden (`active_on_web=false` / `hide`).
- Verifier must never infer an event close merely because all packages are hidden or availability is zero.
- Existing owner-hidden events remain protected by the owner visibility lock and must not be recreated as new visible events.

## Acceptance output

Only produce a final governed handoff when all current control-plane requirements are satisfied. External evidence must retain provenance and the final record must remain attributable to the Verifier decision, not to an AI provider.


## Storefront package guard

For a newly promoted event, standalone `lens_only` must not be published as available by default. The governed create payload must force the lens-only package inactive even when a proposed price exists. Lens-only becomes eligible later only through the storefront inventory rule when the same event has an active `phone_only` booking and spare lens stock. Phone and phone+lens bundle remain governed by their normal package rules.

A final promotion readback must fail closed if a newly created event reports `lens_only` as `available` or `open`. Poster evidence must remain a verified HTTPS source before promotion.

## External Demand storefront hard gate (2026-10-06)

For **new** storefront events, verification of event existence is necessary but not sufficient. Verifier must require the external-market demand gate after exact-event verification and before governed promotion.

External Demand Score is 0-100 and excludes KK internal business outcomes completely:

- competitor rental activity: 30
- public social engagement: 20
- ticket demand / sold-out / added-round evidence: 15
- fandom photo/capture intent: 15
- venue/stage capture value: 10
- historical external rental activity for the artist/fandom/event type: 10

Thresholds:
- 75-100: PRIORITY and publish-eligible;
- 60-74.9: PUBLISH and publish-eligible;
- 45-59.9: WATCH / Candidate Master Pool only;
- below 45: REJECT from storefront;
- insufficient external evidence: VERIFY_MORE and **not publish-eligible**.

No competitor-rental or commercial-evidence flag may bypass the numeric publish threshold. A new candidate in VERIFY_MORE/WATCH/REJECT must not reach CREATE_EVENT.

KK booking count, revenue, conversion, inquiry volume, full-stock state and waitlist volume are explicitly forbidden External Demand inputs. They may feed discovery-priority learning only.

Existing canonical events remain eligible for verified metadata maintenance under normal owner-lock/booking rules; this hard gate governs whether a **new candidate** becomes a storefront offering.

## Monthly existing-card requalification (2026-10-07)

A monthly/full reconciliation must qualify both **new candidates** and **existing storefront cards**.

Existing visible card:
- >=60 external score -> KEEP
- 45-59.9 -> WATCH_KEEP (hysteresis)
- <45 -> REMOVE_RECOMMENDED; apply hide only when the owner has explicitly asked the monthly reconciliation to apply
- insufficient external evidence -> VERIFY_MORE_KEEP
- active booking -> KEEP_PROTECTED_ACTIVE_BOOKING; booking does not alter the external score
- explicit owner keep or durable REOPENED history -> OWNER_KEEP
- LOCKED tombstone -> OWNER_HIDDEN, never reopen

Existing hidden card:
- LOCKED -> never reopen
- no phone capacity -> remain hidden
- non-LOCKED + sufficient external evidence + score >=60 + phone capacity >0 -> REACTIVATE when owner monthly apply is active
- WATCH/REJECT/VERIFY_MORE -> remain hidden
- durable REOPENED history that drifted false -> restore owner intent through visibility reconciliation

The run must emit ADDED / REMOVED / REACTIVATED / OWNER_RESTORED / KEPT / WATCH / PROTECTED / OWNER_HIDDEN and perform derived plus production readback.

## Event-specific Demand Pricing Shadow — owner directive 2026-10-10

**Newest owner intent supersedes any assumption that the fixed weekday/weekend default, a generic market median, or a rental-fit score determines the best price.** Existing live/default prices remain unchanged until a governed owner pricing decision.

- Pricing demand assessment is **separate** from new-event External Demand publish eligibility. Do not feed KK internal bookings or paid revenue into the external *publish* score. Pricing Shadow may use anonymized, source-verified comparable **completed** rentals as a distinct willingness-to-pay observation.
- For a verified high-fandom midweek event (e.g., TeeTeePor), evaluate event-specific rental history, current public photo/fandom engagement, ticket demand, and qualified inquiries. Weekday must not automatically discount the proposal.
- New read-only route `demand_pricing_shadow` is advisory; `production_writes=0`, owner review mandatory. Validate event identity/date, Booking/on-date lock, owner price and visibility locks, inventory collisions, minimum viable price when owner supplies it, and evidence provenance.
- Competitor evidence with **1–2 actual shops** must list **each original quoted package price and source**. Do not set or suggest an automatic two-shop midpoint as a final price; wait for the owner. For >=3 comparable current independent shops the market median may be referenced under existing governed pricing policy, but Demand Shadow cannot write live price.
- `learn_demand_pricing_outcome` is an **observational** report, not proof of causal price lift; include only `completed` in Actual. No self-modification of price policy or automatic production writes.
- Old Mon–Thu 490/590 and Fri–Sun 790/990 remain **operational seeded prices** only where approved; not a replacement for demand evidence. Existing event package values are SOT until owner+Verifier+writer+readback.
- The unmerged Draft #680 code is not deployed to Production. Never mark AI pricing autonomous/accepted until all CI, historical backtest and owner acceptance gates pass.
