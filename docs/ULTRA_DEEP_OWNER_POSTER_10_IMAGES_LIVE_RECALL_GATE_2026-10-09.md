# Owner-poster challenge: October–December 2026 event recall and false-FULL hardening

**Date:** 2026-10-09  
**Mode:** Candidate + Learning only. No storefront, booking, prices, inventory, or production business writes.

## Ten owner posters and canonical dispositions

| Poster | Actual event date | Canonical disposition | Root cause |
| --- | --- | --- | --- |
| L'Oréal Elseve Day with AuAu | 2026-11-20 | EXISTING_CANDIDATE row 315, HOLD | Restricted Lucky Fan event; do not duplicate |
| MR.FANBOY BUSKING presented by true5G | 2026-10-11 | NEW_CANDIDATE row 336, POSTER_ONLY_HOLD | Earlier similarly named Sept13 busking is a different show; current date direct organizer notice not found |
| Saraan Love at First Trip with TleFirstone | 2026-11-08 | EXISTING_CANDIDATE row 314 | Qualification ends Oct10; not October event |
| Curél Sun-safe & Fan-fun! Auu & Save | 2026-12-19 | EXISTING_CANDIDATE row 317 | Qualification October–November; event December |
| SING INFINITY | 2026-10-24 | EXISTING_CANDIDATE row 316 | October event; Oct24 has confirmed LYKN booking; owner booking-day prohibition |
| GELBOYS THE LAST PAINTING FANMEET | 2026-11-22 | NEW_CANDIDATE row 337 | Tickets on sale Oct24 but event Nov22; not same as Sept26 GELBOYS final episode |
| TEEHENG GEN OF US 1st FANMEETING | 2026-10-24 | EXISTING_CANDIDATE row 243 and CORE hidden | Ticket/showtime info was stale, corrected from DeeHup official; Oct24 LYKN booking overrides older explicit reopen |
| WESPARK MEET&LOVE BAILU SPECIAL FANMEETING | 2026-10-25 | EXISTING_CORE hidden | Not a new miss; do not reopen automatically |
| LABX × DEXX HOTEL DE RÊVE Private Secret Session No.01 | 2026-11-22 | NEW_CANDIDATE row 338 | Spending qualification Sept15–Oct31, winners Nov6; not the Sept15 LABX DEXX grand opening |
| KAZZ คนดีอาสาทำดี × TutorYim 'ปล่อยปลาฉลาม' | updated 2026-10-18 | NEW_CANDIDATE row 339 | UPDATED owner poster and KAZZ category say Oct18; product detail page still says Sept27. Date conflict + Chonburi geo gate + Oct18 booking/day closure |

## Evidence hierarchy

- Dee Hup House primary: https://www.deehuphouse.com/ and One Bangkok https://www.onebangkok.com/th/whats-happening/tee-heng-gen-of-us/
- WESPARK Bai Lu primary ticketing: https://megatix.in.th/events/meetlove-bailu-fanmeeting
- LOOKE GELBOYS official social indexed: https://www.sotwe.com/looke_world ; event Nov22 at SiamPic Hall and ticket on-sale Oct24.
- LABX Clinic official campaign indexed: https://www.sotwe.com/LABXClinic ; event Nov22, purchase to Oct31, announcement Nov6, 20 Top Spenders + 30 Lucky Fans.
- KAZZ same-organizer conflicting evidence: https://kazzmarket.com/product-category/activity/ (Oct18) vs https://kazzmarket.com/product/store/kazz-magazine/activity-x-tutor-yim/ (Sept27). Owner uploaded UPDATED Oct18 poster; **do not silently choose original product page over updated poster**.
- MR FANBOY Oct11 remains poster-only; September 13 One Bangkok busking evidence is *not* proof of an October 11 centralwOrld show.

## Root cause and code repair

Before this repair `kk-ultra-deep-runtime-runner.js` computed `knownMissLive` but its FULL gate tested `KnownMiss.evaluateFixtureRegression().complete`, whose candidates are synthesized from the same known-miss corpus. Thus a deterministic historical fixture that always passes could mask genuine live omissions.

Repair:
1. Keep historical fixture separate as matcher-level regression only.
2. Require `KnownMiss.evaluate(...,{month,strict_live:true}).complete` for FULL; require actual sourced live candidates or sourced executed dispositions.
3. Do **not** count `SOURCE_UNAVAILABLE` or unsourced classifications as successful live proof.
4. Include future-month events with qualification/ticket launch in target month via `discovery_months`, without making them current-month storefront candidates.
5. Require direct-source families KAZZ MARKET activities, LOOKE, DeeHup House, LABX, and date-change / ticket-sale-vs-event queries.
6. Keep owner tombstones, date booking price locks, governed writer, geographic eligibility and exact readback unchanged.

## Durable data

- Event Tracker `_Candidate_Queue!A336:AL339` four new candidate-only rows; `_Candidate_Queue!C243:AA243` refreshed TeeHeng lifecycle only. Existing six poster identities not duplicated.
- `_Miss_Learning!A21:M27` seven root-cause/false-FULL entries.
- No modifications to Core `01_Events`, `08_Web_Ready`, `09_Web_Packages`, or owner visibility tombstones.

## Acceptance required before production

Targeted Node tests + exact-head GitHub Actions CI must execute (zero-step provisioning != pass). Validate the new fail-closed gate, all owner-protected date locks, no visible new events, and the same public storefront readback. **Do not claim that a staged PR is live or that FULL scan ran until executable evidence is collected.**
