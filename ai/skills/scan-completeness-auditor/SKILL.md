# SCAN_COMPLETENESS_AUDITOR

Status: **STAGING_REVIEWED_NOT_INSTALLED**

## Purpose
Prevent premature "scan complete" claims and gate the handoff to downstream verification/content while enforcing the current live closure invariants.

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
Every Ultra-Deep in-year sweep must account for all four passes: A official universe, B opportunity keyword/alias universe, C reverse competitor discovery, D negative cross-source audit. Missing any required pass means PARTIAL. Event distance changes cadence only, not source-family breadth.

## v4.9.8 nightly / morning closure
For the existing 01:00 Scanner Ultra-Deep:
- `FULL` requires Pass A+B+C+D present, required source-family attempts accounted, and `UNACCOUNTED_SIGNAL=0`.
- Required blocked/403/inaccessible routes remain PARTIAL and create explicit Coverage Debt; a timer firing or root/profile hit is never proof of full completion.
- Coverage Debt must remain visible through the existing 03:00 fallback/due retry and 06:00 Venue+Ticket/negative retry ladder until resolved or explicitly still blocked.
- Nightly P0/P1/material P2 packets are priority input to the existing 01:30..06:30 Verifier chain.
- By 06:30, every nightly high-value signal must be canonical+visible monthly exact1 or explicit current HOLD with Next Watch; hidden high-value backlog is a P0 closure gap.
- New/material P0/P1 events <=14 days with missing/stale exact X300 Pro + Lens market require a targeted price-refresh request before morning; do not broaden this into a full overnight year-end price crawl.

## Mandatory signal accounting
- Every extracted in-area in-year signal resolves to an existing link, deterministic Candidate+packet handoff, duplicate, out-of-area, explicit HOLD or explicit SUPPRESS.
- Unaccounted in-area signal count must be zero before normal Scanner FINISHED.
- Suspicious zero/low current/near-term dates require the policy-defined forced discovery pass before accepting no opportunity.
- >=2 independent competitor businesses mentioning the same unknown in-area event create a P0 authority-backcheck gap.
- Recall happens before business scoring.

## v4.9.5 handoff atomicity
A Candidate may become `READY_FOR_VERIFIER` only after `PREPARE -> Candidate STAGED -> deterministic AI packet write -> exact dual identity readback -> Candidate READY -> COMMIT` using stable Event Family + Show/Showset + Work Packet identity. Row number is only an address.

## v4.9.6 closure invariants
Before Verifier normal FINISHED exact readback must prove `READY_LINEAGE_GAP=0`, `CANONICAL_MONTHLY_GAP=0` for eligible canonical events unless explicit governed non-promotion exists, and `UNRESOLVED_PREPARED_COMMITTING=0`. Protected mutations require pre/post stable-key identity readback.

## v4.9.8 monthly normalizer completion
For every material monthly-affecting Verifier mutation, before COMMIT prove:
- duplicate stable event key = 0;
- canonical↔monthly exact1 or governed non-promotion;
- full-row chronological/same-day sort contract passes using Start_Date_ISO, not localized date text;
- score/tier mapping passes: S+ 95–100, S 90–94, A+ 85–89, A 80–84, B+ 75–79, B 1–74, unresolved=PENDING;
- lifecycle/restriction override wins over numeric score (`CANCELLED/POSTPONED/non-promotable -> HOLD`, external-lens prohibited/explicit SKIP -> SKIP);
- conditional-format rule remains present;
- Monday–Sunday week grouping has exactly one separator between week keys and none inside a week;
- formula/reference errors = 0 and full-row A:R/extended presentation integrity passes.

A price-current change alone refreshes market columns/PRICE UPDATED semantics but must not cause row jitter unless a date/score/status/identity/venue sort key also changes.

## Mandatory source/evidence checks
- protected event truth finalized only by the designated verifier/final writer;
- event date/venue checked and conflicts surfaced;
- official/authorized authority supports final promotion;
- required social/media/section routes have explicit access states;
- root/profile-only access does not count FULL when section routes are due;
- due competitor sources have attempt accounting;
- unknown competitor events are normalized/deduped/geo-classified/authority-routed;
- out-of-area signals are observability-only;
- recurring-source/miss learning requires concrete correction + exact readback.

## Current-market / price-persistence checks
- exact-event vivo X300 Pro + Lens observation appends `_Price_Evidence` before current upsert;
- current projection uses exact Event + competitor + package + source lineage;
- current eligibility is derived from `last_checked` + `fresh_until` + freshness/queue/source evidence, so an expired textual `FRESH` label alone never makes a row current;
- stale/superseded/expired/conflict-held/non-bookable rows excluded;
- 1 fresh independent shop=Reference, 2=Range, >=3=Range+Median;
- no fresh + history=STALE with Fresh Shops=0; no exact history=`NO EXACT BUNDLE YET`;
- PRICE UPDATED only same normalized event+shop+package recent non-zero delta;
- exact/comparable never mixed and history never silently substitutes current truth.

## Content gate
`CONTENT_GATE=PASS` only when three variants can be generated without inventing event facts, hashtag, KK price, competitor claim or link. If protected facts/hashtag/market-derived pricing are unresolved, HOLD unless an independent authoritative KK price exists.

## Boundaries
- Read live Active policy every run; never freeze a historical version.
- `CHECKED`, `PARTIAL`, `BLOCKED`, `NOT_ACCESSIBLE` remain distinct.
- No task/control-plane/Core/Production mutation from this auditor.
- Never promote local/CI evidence to runtime/provider/production evidence.

## Dependencies
- existing EVIDENCE_VERIFIER
- existing CONTENT_THREE_VARIANT_ENGINE
- `lib/kk-competitor-discovery-contract.js`
- `lib/kk-discovery-closure-contract.js`
- `lib/kk-market-presentation-contract.js`

## Replay / regression tests
- all A/B/C/D + zero unaccounted + handoff closure => eligible COMPLETE
- missing pass/root-only/blocked required source => PARTIAL
- READY Candidate without matching packet => HOLD/P0 orphan
- shifted row identity => fail closed
- canonical event without exact1 monthly or explicit non-promotion => HOLD
- unresolved PREPARED/COMMITTING => HOLD
- nightly required source failure => Coverage Debt + retry, never false FULL
- hidden nightly P0/P1/material P2 at 06:30 => closure HOLD
- monthly duplicate/sort/tier/week/formula/full-row invariant failure => no normal COMMIT
- price-only change => no row reorder unless another sort key changes
- stale market => STALE/Fresh Shops=0 despite any stale stored label
