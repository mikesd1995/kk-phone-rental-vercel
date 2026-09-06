# EVENT_WEB_RESEARCH_ORCHESTRATOR

Status: **STAGING_REVIEWED_NOT_INSTALLED**

## Purpose
Plan and execute evidence-first research for one event or one governed discovery sweep without stopping after the first plausible result.

## Inputs
- event identity / artist / known date or venue when event-scoped
- service area + current-year horizon
- current `_Policy_Registry` source-authority / discovery rules
- current Machine SOT Candidate/Lifecycle/monthly/archive identities
- due source-family/section plan when invoked by Scanner

## Outputs
- source/pass plan
- per-source and per-section `CHECKED / PARTIAL / BLOCKED / NOT_ACCESSIBLE` matrix
- official/authorized evidence candidates
- normalized raw opportunity signals
- unresolved/conflicting fields
- explicit accounting disposition for every extracted in-area signal

## Event-scoped authority order
1. official organizer / promoter / agency / label
2. official artist
3. authorized ticket provider
4. venue
5. official social channels
6. indexed discovery / fanbase only as discovery fallback

## v4.9.7 Scanner multipass mode
When the current Active policy assigns this orchestrator to an Ultra-Deep Scanner sweep, use all four discovery passes before completeness is evaluated:

- **PASS A — OFFICIAL UNIVERSE:** ticket catalogs/detail routes, venue calendar/detail routes, organizer/agency/label/artist/series routes, brand/mall/cinema event routes.
- **PASS B — OPPORTUNITY KEYWORDS:** current Thai/English fan-meeting, fan-gathering, final-episode, premiere, screening, birthday, graduation, anniversary, mini-concert, busking, special-guest, meet-and-greet, fan-zone, lucky-fan, registration, exclusive-event, red-carpet, product-launch and learned alias patterns.
- **PASS C — REVERSE COMPETITOR:** competitor event mentions are demand/discovery sensors only and must be backchecked to authority.
- **PASS D — NEGATIVE CROSS-SOURCE AUDIT:** compute source-vs-tracker set differences so an event visible externally but absent from Candidate/Lifecycle/monthly cannot silently disappear.

Event distance changes re-fetch cadence only. It must not remove source families from the discovery universe.

## Signal accounting / anomaly rules
- Every extracted in-area in-year signal must end as an existing link, deterministic Candidate+packet handoff, duplicate, out-of-area, explicit HOLD or explicit SUPPRESS.
- Unaccounted signal exact0 is required for normal Scanner FINISHED.
- A suspicious zero/low current or near-term date, especially weekend/holiday, triggers the current date-scoped forced multi-pass rescan before accepting no opportunity.
- Two or more independent rental businesses referencing the same unknown in-area event trigger a P0 authority-backcheck alarm; linked/sister shops count once and KK self listings never count.
- Recall precedes business scoring. Low expected rental fit may become explicit non-promotion only after lineage/verification.

## Source-section coverage
- Root/profile access alone never counts FULL when a source family has due catalog/detail/feed/post/search routes.
- Attempt each applicable section/route required by current policy and record the actual access result.
- `BLOCKED`/`NOT_ACCESSIBLE` can satisfy attempt accounting but never successful-access coverage; required blocked sections keep the pass PARTIAL.
- Preserve exact route, source type, observed freshness/date, access state and supported field.

## Evidence rules
- Require at least one official/authorized source before protected event facts may be promoted; aim for two where practical.
- Never use ticket-sale, registration, announcement, or benefit date as Event Date.
- Conflicts stay unresolved until authority/freshness resolves them.
- Indexed/fanbase/competitor evidence may discover candidates but cannot finalize protected event truth.
- Route media facts to `POSTER_MEDIA_FACT_EXTRACTOR`.
- Handoff material Scanner signals using stable Event Family + Show/Showset + deterministic Work Packet lineage; Candidate may be READY only after matching packet exact readback.
- Send protected event adjudication to existing `EVIDENCE_VERIFIER`; do not self-promote final event/business truth.

## Boundaries
- No schedule create/delete/disable/pause/reschedule.
- No Core replacement.
- No final monthly/pricing/content/provider/notification/owner/customer write from this orchestrator.
- No total-internet-completeness claim; external inaccessible routes remain explicit PARTIAL.

## Dependencies
- SOCIAL_MEDIA_EVENT_SCANNER
- COMPETITOR_RENTAL_HUNTER
- POSTER_MEDIA_FACT_EXTRACTOR
- existing EVIDENCE_VERIFIER
- `lib/kk-discovery-closure-contract.js`

## Replay / regression tests
- organizer + authorized ticket corroboration
- fanbase-only discovery remains unverified
- blocked Instagram remains BLOCKED/PARTIAL
- conflicting venue/date remains unresolved
- sale date vs event date separation
- first plausible result does not terminate required checks
- missing A/B/C/D pass => sweep PARTIAL
- root-only access on sectioned source => PARTIAL
- >=2 independent competitor businesses mention unknown event => P0 backcheck
- every in-area signal accounted before Scanner FINISHED
