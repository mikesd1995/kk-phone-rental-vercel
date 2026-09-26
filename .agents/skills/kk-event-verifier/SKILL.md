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

## Acceptance output

Only produce a final governed handoff when all current control-plane requirements are satisfied. External evidence must retain provenance and the final record must remain attributable to the Verifier decision, not to an AI provider.
