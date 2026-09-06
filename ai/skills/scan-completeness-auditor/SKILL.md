# SCAN_COMPLETENESS_AUDITOR

Status: **STAGING_REVIEWED_NOT_INSTALLED**

## Purpose
Prevent premature "scan complete" claims and gate the handoff to downstream verification/content while enforcing the live v4.9.5–v4.9.7 closure invariants.

## Inputs
- current Active `_Policy_Registry`
- source/access matrix + route/section attempt accounting
- normalized extracted signal set
- Candidate ↔ `_AI_Inbox` handoff lineage
- verifier-promoted canonical event facts
- canonical ↔ visible-monthly projection lineage
- official hashtag resolution
- competitor reverse-discovery coverage/results
- exact/comparable competitor price scan results
- current competitor-price projection and append-only price lineage/history
- source-persistence / miss-learning readback
- current product/footer/main-account rules

## Outputs
- `SCAN_STATE=COMPLETE / PARTIAL / BLOCKED`
- missing/unresolved checks
- source access summary using `CHECKED / PARTIAL / BLOCKED / NOT_ACCESSIBLE`
- `HANDOFF_STATE=PASS / HOLD`
- `CLOSURE_STATE=PASS / HOLD`
- `CONTENT_GATE=PASS / HOLD`
- allowed final-output scope

## v4.9.7 multi-pass completion
Every Ultra-Deep in-year sweep must account for all four passes:

A. official universe — ticket, venue, organizer, agency/label, artist/series, brand/mall/cinema routes;
B. opportunity keyword/alias universe — fan meeting, fan gathering, final episode, premiere, screening, birthday, graduation, anniversary, mini concert, busking, special guest, meet & greet, fan zone, lucky fan, registration, exclusive event, red carpet, product launch and current learned aliases;
C. reverse competitor discovery;
D. negative cross-source audit / source-vs-tracker set difference.

Missing any required pass means PARTIAL. Event distance changes cadence only, not source-family breadth.

## Mandatory signal accounting
- Every extracted in-area in-year signal must resolve to exactly one governed disposition: existing canonical/candidate link, deterministic Candidate+packet handoff, duplicate, out-of-area, explicit HOLD or explicit SUPPRESS.
- Unaccounted in-area signal count must be zero before normal Scanner FINISHED.
- Suspicious zero/low current/near-term event dates require the policy-defined date-scoped forced discovery pass before accepting no opportunity.
- Two or more independent competitor businesses mentioning the same unknown in-area event create a P0 discovery gap requiring authority backcheck or explicit hold.
- Recall happens before business scoring. Low opportunity may be non-promoted only after lineage/verification, never silently discarded at discovery.

## v4.9.5 handoff atomicity
A Candidate may become `READY_FOR_VERIFIER` only after:

`PREPARE -> Candidate STAGED -> deterministic AI packet write -> exact dual identity readback -> Candidate READY -> COMMIT`

Required identity is stable Event Family + Show/Showset + Work Packet. Row number is an execution address, never the business identity.

Before Scanner normal FINISHED:
- READY Candidate count must equal matching READY packet count for the run scope;
- every READY Candidate must have exactly one matching nonblank Work Packet ID and packet status `READY_FOR_VERIFIER`;
- a failed/missing packet write leaves the Candidate staged/failed, never READY.

Before Verifier `NO_OPERATIONAL_PACKET`, compare READY Candidates against READY packets and reconcile any orphan deterministically or hold explicitly.

## v4.9.6 closure invariants
Before Verifier normal FINISHED exact readback must prove:

- `READY_LINEAGE_GAP = 0`
- `CANONICAL_MONTHLY_GAP = 0` for eligible canonical events, unless explicit governed non-promotion reason exists
- `UNRESOLVED_PREPARED_COMMITTING = 0`

Audit visible monthly ↔ canonical/pending lineage in both directions. Positional shifted-row writes are prohibited; every protected row mutation requires pre/post stable-key identity readback.

## Mandatory source/evidence checks
- exact event identity promoted only by `EVIDENCE_VERIFIER` or current designated final writer
- event date and venue checked; unresolved conflicts surfaced
- >=1 official/authorized event source supports protected truth where final promotion is attempted
- required social/media branch attempted with explicit access states
- root/profile access alone never counts FULL when policy requires catalog/detail/feed/post/search section attempts
- blocked required route/section stays PARTIAL
- official hashtag verification attempted; verified set or explicit UNRESOLVED
- due active competitor sources have explicit attempt accounting
- competitor-surfaced unknown events normalized/deduped/geo-classified and authority-routed before promotion
- out-of-area signals remain observability-only
- recurring official source learning includes `_Direct_Source_Map` correction + exact readback
- learned miss without concrete repair/readback remains `OPEN_REPAIR`

## Current-market / price-persistence checks
- exact-event vivo X300 Pro + Lens observation accepted by Scanner persistence scope must append `_Price_Evidence` before current upsert
- `_Competitor_Price_Current` uses exact Event + competitor business + package identity and source lineage
- stale/superseded/expired/conflict-held/non-bookable rows excluded from current stats
- one fresh independent shop = Reference only; two = Range only; >=3 = Range + Median
- no fresh current rows + exact-bundle history = explicit STALE last-known with Fresh Shops=0
- no exact-bundle history = `NO EXACT BUNDLE YET`
- same event + same shop + same package non-zero recent delta may display `PRICE UPDATED`; a new shop at another price may not
- exact/comparable evidence is never silently mixed
- historical prices remain lineage/trend context and are never silent current-price fallback

## Year-end/deep-sweep completion semantics
A requested through-Dec-31 sweep may be `PASS_WITH_PARTIAL_EXTERNAL_COVERAGE` only when:

- required multi-pass attempt accounting is complete;
- every accessed in-area signal is accounted;
- overdue P0/P1/material P2 backlog is canonically promoted or carries an explicit current authority/access/rule hold + next-watch lineage;
- canonical/monthly cross-projection closure passes;
- unresolved protected transactions are zero.

Blocked/inaccessible external routes must remain PARTIAL and the system must never claim total-internet completeness.

## Content gate
`CONTENT_GATE=PASS` only when the requested three variants can be generated without inventing protected event facts, official hashtag, KK price, competitor claim or link, and all current posting rules are resolved. If the official hashtag is unresolved while policy requires it, HOLD. Market-derived pricing must HOLD when current market evidence is insufficient unless an independently authoritative KK price exists and no competitor-derived claim is made.

## Boundaries
- Read live Active policy every run; never freeze a historical policy version.
- `CHECKED`, `PARTIAL`, `BLOCKED`, `NOT_ACCESSIBLE` remain distinct.
- No task/control-plane/Core/Production mutation from this auditor.
- Existing downstream engines must not be called on HOLD.
- Never promote a local/CI audit result to runtime/provider/production evidence.

## Dependencies
- existing EVIDENCE_VERIFIER
- existing CONTENT_THREE_VARIANT_ENGINE
- `lib/kk-competitor-discovery-contract.js`
- `lib/kk-discovery-closure-contract.js`
- `lib/kk-market-presentation-contract.js`

## Replay / regression tests
- all A/B/C/D passes + zero unaccounted + handoff closure => eligible COMPLETE
- missing discovery pass => PARTIAL
- root-only access for a due sectioned source => PARTIAL
- blocked required source section => PARTIAL
- READY Candidate without matching packet => HOLD/P0 orphan
- shifted row identity before protected write => fail closed
- canonical eligible event without exact1 monthly or explicit non-promotion => closure HOLD
- unresolved PREPARED/COMMITTING transaction => closure HOLD
- >=2 independent shops mention unknown event => P0 authority backcheck
- stale exact-bundle history only => STALE, Fresh Shops=0, no median
- one current shop => Reference, not median
- two current shops => Range, not median
- >=3 current shops => Range + Median
- new shop price difference => no false PRICE UPDATED
- same event/shop/package price delta => recent PRICE UPDATED eligible
- blocked external sources with all internal closure gates passed => PASS_WITH_PARTIAL_EXTERNAL_COVERAGE, never total-internet complete
