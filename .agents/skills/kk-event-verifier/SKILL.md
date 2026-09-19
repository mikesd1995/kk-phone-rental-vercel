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

## Acceptance output

Only produce a final governed handoff when all current control-plane requirements are satisfied. External evidence must retain provenance and the final record must remain attributable to the Verifier decision, not to an AI provider.
