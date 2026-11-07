# KK Phone Rental — December 2026 UDS Gap Repair Checkpoint
Date: 2026-11-07 Asia/Bangkok. Classification: READ-ONLY / DRAFT / NO PRODUCTION CHANGES.

## Source-of-truth readback and blockers
- Google Sheets canonical backend: https://docs.google.com/spreadsheets/d/12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU/edit
- Tracker: https://docs.google.com/spreadsheets/d/1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo/edit
- Core event-days Dec: 70. December bookings: 13 (11 confirmed, 2 canceled).
- Booked dates where no new event may be published: 2026-12-03, 05, 06, 18, 19, 20. This owner rule applies DAY-WIDE even when one phone remains free.
- Owner December lock identities: 26 LOCKED (of 44 lock history entries). Never re-create or auto-unhide, including under a new event ID.
- Core event poster URL text populated in all 70 December rows, but image ACL/content correctness NOT confirmed.
- P0 fault remains: BTS December 03 and 05 have phone available=0, lens available=1, yet Web Ready says OPEN/show. Draft PR #831 and #833 not merged; the new audit helper does NOT fix runtime stock.
- Main SHA inspected: d4bd11f6ff78f67f41b79a26448d036007737701.

## December missing candidates by exact day
- Dec 27: SUHO Fan-Con, Island Hall Fashion Island, 18:00. Organizer KPSpring and secondary https://www.scenensound.com/?p=22637 . No Dec27 confirmed booking, but 3 other Core show cards share two physical phones. HOLD pending exact primary poster, photography/lens rules, fresh SOT, exact comparable Vivo rental pricing or verified final pricing fallback.
- Dec 09: M Universe Day with TeeTee–Por, EMSPHERE Sphere Gallery. Official M Card https://www.mcardmall.com/en/promotions/8188 , terms https://www.mcardmall.com/en/promotions/8260 . Exactly 20 Top Spenders plus 200 Lucky Fans; access is non-transferable, not open admission; HOLD on rental camera/lens rights.
- Dec 13: MCHOICE FANDAY, centralwOrld LIVE. Secondary-only https://popradar.app/th/events/meetup/mchoice-fanday-2026-centralworld-2026-12-13 . No original organizer proof/verified poster; HOLD.
- Dec 25: HADA LABO The Christmas Secret x Tle–FirstOne, Living Room Thonglor, 16:00–18:00. Watsons first party https://www.watsons.co.th/en/hadalaboxtlefirstone-p1026 . Only 30 lucky winners; some photos taken by organizer photographer. Do not assume customer camera/lens allowed; HOLD.
- Dec 31: One Bangkok Countdown Celebration: official concept but lineup, exact artist schedule and photo policy unverified. HOLD.
- Dec 19–20 PP KRIT BETWEEN MY LIPS, venue original https://www.qsncc.com/en/whats-on/event-calendar/pp-krit-between-my-lips-concert-presented-by-cp/ . Both days booked: EXCLUDE. Ticket admission fee is not rental rate.
- Dec 05–06 Gulf Club, organizer https://www.gulfkanawutofc.com/ . Both days booked: EXCLUDE.
This list is bounded source discovery, NOT FULL all-source coverage or verified production availability.

## Isolated code change and safe scope
PR branch audit/dec26-candidate-preflight-isolated-20261107 only adds:
- server/kk-dec2026-candidate-preflight.js — pure read-only December candidate checker.
- tests/kk-dec2026-candidate-preflight.test.js — deterministic booking, cancellation, owner lock, duplicate, rights, poster, rental fit score and pricing tests.
- scripts/qa/kk-dec2026-candidate-preflight.cjs — local offline CLI consuming sanitized fresh JSON snapshot.
- This dated checkpoint.

No existing production file was modified. This branch does not integrate into live Scanner, Verifier, public frontend, admin, or data path. It cannot publish, change a price, create a booking, send alerts or deploy.

Active Draft PR #827 and #829 ALREADY touch the primary Scanner registry, query plan and known-miss corpus. Active PR #831, #833, #845 touch stock/private core. PR #848 and #849 cover poster ACL. New branch deliberately does not touch those files.

## Offline usage
On a local checkout run:
  node --test tests/kk-dec2026-candidate-preflight.test.js
  node scripts/qa/kk-dec2026-candidate-preflight.cjs /path/to/fresh-sanitized-snapshot.json

Input JSON fields (never include names, phones, contact data, or secrets):
- snapshot_verified: true; checked_at: ISO timestamp within 15 min.
- bookings: array of {event_id,status} or {event_date,status}.
- events: array of {event_id,title,event_date} from private Core.
- owner_locks: array of {event_id,name,state,reason} (or include exact event_date).
- candidates: array of {title,event_date,venue,primary_source_url,primary_source_verified,poster_url,poster_verified,access_type,access_verified,access_terms_disclosed,photo_allowed,lens_allowed,bundle_requested,rental_fit_score,pricing}.
- pricing is the already verified final output of the existing KK_FINAL_PRICING_POLICY_V4 resolver, NOT raw event ticket price.
- Output status CANDIDATE_PREFLIGHT_PASS_NOT_PUBLISH_APPROVAL means only eligible for independent Verifier. Publication_authorized=false and production_writes=0 in all cases.
- CLI exit 0 = local preflight pass only; 2 = blocked or empty; 1 = invalid input; 64 = no file. Do not interpret exit 0 as publish approval.

## Governing rental prices, not guesses
Price rule: exact comparable event-specific Vivo X300 Pro offers -> median; failing that approved rental-fit tiers on V4: score >=9 phone890 / bundle1090, score >=8 phone790 / bundle990, score >=7 phone690 / bundle890. No invented score. Lens-only hidden. Without adequate scored tier, a fresh approved SOT baseline could be considered by the existing guarded resolver only after rental-fit eligibility and verifier approval. At the 2026-11-07 read 03_Packages standard were phone590, lens390, bundle690; they are not a competitor median. Friday-Sunday zero exact price comparisons require a provisional price recheck flag. Do not overwrite owner-set per-event prices.

## Mandatory remaining gates
1. Review the current Codex Scanner PR #827/#829 and add December known-miss exact-date cases without clashing branches.
2. Resolve current P0 stock false-open and private Core reader/auth, exact HEAD, CI and 13/13 Core private staging.
3. Confirm poster, rights, access eligibility, scores, quote sources and actual day-wide booking/owner locks, then run independent Verifier.
4. Governed Admin createEvent only when entire release path passes, followed by exact Web Ready, packages and signed-out public storefront readback plus rollback.
5. No business writes until safe. Report no production success unless verifiable.

Related https://github.com/mikesd1995/kk-phone-rental-vercel/issues/489 and https://github.com/mikesd1995/kk-phone-rental-vercel/issues/847 .


## Actual sanitized Core+Booking+Owner Lock preflight readback — 2026-11-07 17:39 ICT
Read-only private read of canonical Core/Booking/Locks and extraction of non-PII fields only:
- Core December: 70 day rows; bookings: 13 December rows; lock history: 44 December rows (26 locked).
- Seven sourced candidate/date records checked (5 unbooked leads + PP KRIT Dec19 + Gulf Club Dec06): **7 HOLD, 0 PASS**, 0 production writes.
- SUHO Dec27: booking_day_matches=0, core_duplicate_matches=0, owner_lock_matches=0. HOLD for official photo+poster/lens permission, access terms, independent rental-fit evidence, verified canonically reconciled phone/lens capacity, and final V4 pricing.
- M Universe Day TeeTee–Por Dec09: zero booking/dup/lock; primary M Card official date/access proof retrieved. HOLD for rights, poster asset, independent score/price, day-wide stock.
- MCHOICE Dec13, HADA LABO Dec25, One Bangkok Dec31: zero booking/dup/lock; HOLD for applicable primary evidence (MCHOICE, One Bangkok), photo/cover rights, scored pricing, stock. HADA LABO restricted 30 winners, official Watsons issuer verified.
- PP KRIT Dec19: one confirmed active Jasper booking on same day and two owner date-exclusive lock matches -> HOLD. Gulf Club Dec06: two active confirmed bookings -> HOLD. The other 2026-12 booked dates remain excluded.
- 2026-12-27 has three OTHER storefront visible event cards, but separate rows do not represent six independent phones. Do not treat Web Ready per-card phone=2 as canonical day-wide inventory proof.
- All missing primary poster/rights/score/price data remained unverified in this audit; NONE was invented just to make a candidate pass.

## Final isolated hardening and checks
After independent code logic review, the evaluator additionally requires:
- A fresh CANONICAL_ASSET_BOOKING_RECONCILIATION stock_by_day entry for each date, with a positive phone count; bundle also requires a positive addon lens count. Web Ready is NOT accepted as a canonical stock source.
- Independent rental-fit score proof: rental_fit_verified=true AND a non-empty rental_fit_evidence plus valid score 7–10. A numeric score alone does not pass.
- Phone-only proposals may not leave an active bundle visible; weekend score-fallback must carry needs_price_recheck=true.
- Exact original candidates still go to the independent Verifier and owner publisher gates; publication_authorized=false unconditionally.

Isolated V8 execution of the actual branch evaluator and test source with compatible require/URL shims: **19/19 tests PASS, 0 FAIL**. Node exact-HEAD hosted CI, independent Reviewer and runtime test are **NOT** evidenced. No Github Actions workflow was manually dispatched and no paid provider was used.

PR #850: https://github.com/mikesd1995/kk-phone-rental-vercel/pull/850 (Draft; no merge/deploy).
