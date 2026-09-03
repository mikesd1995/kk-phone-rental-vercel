# EVENT_WEB_RESEARCH_ORCHESTRATOR

Status: **STAGING_REVIEWED_NOT_INSTALLED**

## Purpose
Plan and execute evidence-first research for one on-demand X-post event without stopping after the first plausible result.

## Inputs
- event identity / artist / known date or venue
- service area
- current `_Policy_Registry` source-authority rules
- current Machine SOT event data when present

## Outputs
- source plan
- per-source `CHECKED / BLOCKED / NOT_ACCESSIBLE` matrix
- official/authorized evidence candidates
- unresolved/conflicting fields

## Ordered research policy
1. official organizer / promoter / agency / label
2. official artist
3. authorized ticket provider
4. venue
5. official social channels
6. indexed discovery / fanbase only as discovery fallback

## Rules
- Require at least one official/authorized source before protected event facts may be promoted; aim for two where practical.
- Preserve URL, source type, observed freshness/date, access state, and the exact field supported.
- `BLOCKED` and `NOT_ACCESSIBLE` must remain explicit; never convert them to `CHECKED` or "not found".
- Never use ticket-sale, registration, announcement, or benefit date as Event Date.
- Conflicts stay unresolved until authority/freshness resolves them.
- Indexed/fanbase evidence may discover candidates but cannot finalize protected event truth.
- Route media facts to `POSTER_MEDIA_FACT_EXTRACTOR`.
- Send collected event candidates to existing `EVIDENCE_VERIFIER`; do not self-promote protected facts.
- No schedule, Core Scanner, Production write, publish, or notification behavior.

## Dependencies
- SOCIAL_MEDIA_EVENT_SCANNER
- POSTER_MEDIA_FACT_EXTRACTOR
- existing EVIDENCE_VERIFIER

## Replay / regression tests
- organizer + authorized ticket corroboration
- fanbase-only discovery remains unverified
- blocked Instagram remains BLOCKED
- conflicting venue remains unresolved
- sale date vs event date separation
- first plausible result does not terminate required checks
