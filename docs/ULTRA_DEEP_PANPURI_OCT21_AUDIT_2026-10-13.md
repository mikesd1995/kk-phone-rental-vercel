# Ultra Deep October 21 PAÑPURI miss — evidence and release gates

Status: INVESTIGATING / FAIL-CLOSED. Scope: discovery-only, no production writes.

## Grounded poster case
- 2026-10-21, 16:00–17:00 ICT, PAÑPURI LIMINAL CURRENTS HOLIDAY 2027 POP-UP.
- centralwOrld floor 1 Beacon 3; PHUTATCHAI and THAI.
- Invited guests only; fans may support from designated outside area with limited space.
- User-supplied poster is the lead, NOT an independent official announcement verification.

## Source audit 2026-10-13
- `server/kk-ultra-deep-runtime-runner.js` reference groups contain concerts, fan meets, lucky fan, calendars, and mall performance schedule. `referenceScopeDecision` requires a strong event keyword or trusted event-ticket path; a brand POP-UP title without these may be classified EVENT_IDENTITY_NOT_STRONG_ENOUGH. This is a plausible *reference recovery* gap, not proven execution root cause.
- `server/kk-ultra-deep-v2-learning-agent.js` V6 has brand/social and campaign visual miss classes and protected policy; no evidence yet this case was fed as missed_events.
- `docs/ULTRA_DEEP_BRAND_CAMPAIGN_VISUAL_SCHEDULE_LEARNING_2026-10-07.md` documents a confirmed prior brand/visual schedule recall gap and V6/V9 mitigation.
- GitHub code search for PAÑPURI and PHUTATCHAI returned no matches on default branch; code search cannot establish Candidate Pool, Google Sheet, or production state.

## Required root-cause discrimination
1. Verify primary announcement URL and publication timestamp. Was the event public before the October scan?
2. Search scan task receipts and provider attempts for PANPURI, PAÑPURI, Phutatchai, Thai, centralwOrld and Beacon 3.
3. Search immutable Candidate Master Pool, rejection/hold logs, 01_Events, 08_Web_Ready; preserve event_id, source_url, dates, reason and fingerprint.
4. Confirm actual production runtime commit and plan/source registry versions. Separate not-discovered, not-executed, provider error, rejected, hidden, and never-published.
5. October 1–31 read-only re-sweep including brand pop-up, mall appearance, invite-only fan support, image-led schedules and Thai/English transliterations. Reconcile against protected booking days and owner tombstones; never reopen hidden rows.

## Proposed non-production regression
- Positive reference discovery fixture: PAÑPURI / PANPURI POP-UP, 2026-10-21, Bangkok centralwOrld, PHUTATCHAI and THAI, independent official evidence required.
- Negative publish fixture: invited-only and outside limited-space access MUST NOT be interpreted as storefront eligibility.
- Negative fixture: generic brand promotion without artist, date or Bangkok evidence remains rejected.
- Add learning miss class for brand pop-up artist appearance only after confirming classification from receipts.
- Keep reference recovery distinct from publication; no mutation of prices, bookings, inventory or customer records.

## Gates
G1 official source and timing verified; G2 receipts and root-cause classified; G3 October coverage reconciled; G4 tests executed and passing; G5 reviewer approval and production readback plan. All currently NOT PROVEN.
No merge, deploy, paid API, automatic publication or production writes. production_writes=0.

## Implementation checkpoint — 2026-10-13
- Branch-only source change `server/kk-ultra-deep-runtime-runner.js` commit `5ab28708520176bd7ca6a130e4637bfebabcf967`: explicit artist-led brand pop-up reference candidate recognition, while generic promotions remain excluded; date/month gates and verifier-only recovery retained.
- Branch-only test `tests/ultra-deep-panpuri-popup-reference.test.js` commit `d378781999e750cd90230acc0ae2bca00583ec0d`: four Node test cases covering positive artist pop-up, negative generic promotion, date/month, verifier-only provenance.
- Branch-only learning change `server/kk-ultra-deep-v2-learning-agent.js` commit `6966a2475821311b24cbf1ec07b471d3d3f682fb`: new `BRAND_POPUP_ARTIST_APPEARANCE_GAP` class and artist/brand pop-up expansion queries. Does not change protected scoring or production authority.
- These are source edits, NOT verified passing tests. No live October scan, source verification, provider receipts, candidate pool/backend readback, CI or deployment acceptance has been performed at this checkpoint. G1–G5 remain HOLD. Avoid claiming complete coverage.
- Follow-up: execute Node tests on isolated branch, run independent October provider sweep and compare event IDs with backend in read-only mode, classify missed-event receipts, then seek owner acceptance before any merge/deploy.
