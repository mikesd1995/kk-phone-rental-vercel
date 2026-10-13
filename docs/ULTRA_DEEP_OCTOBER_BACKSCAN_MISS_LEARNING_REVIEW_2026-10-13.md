# KK October 2026 — Backscan to Miss Learning Review Contract

Date: 13 October 2026 (Asia/Bangkok)
Status: DRAFT / HOLD / REVIEW ONLY. Owner selected follow-up task #4.
Parent: Draft PR #720 at b9da7721707a984c393cd571e283e9c29ca6d5e9.
No Sheets, booking, stock, poster, pricing, publishing, Supabase, Vercel or paid-provider write.

## Why this change is required

Manual external-first Backscan found two different classes of gap:
- New external discovery not found in October Core, monthly Tracker or Candidate (Guerlain x BLUE Oct15, Onitsuka pop-up Oct15, Miu x KEB DAO Oct19, ONLYUS boat party Oct14).
- Known Candidate or monthly Tracker that has not reached Core (Melody of Life Day16, HOWE Awards Oct20, EVERPINK Oct22, LenaMiu EVEANDBOY Oct26, PERSONA Oct27, THE FACE SHOP and LenaMiu PLS Oct30).

Core also contains intentionally hidden dates (ZATO Blackbeans Oct26, Tiffany Oct25, various booking-day hides). They MUST NOT be re-added just because secondary sources were found.

Authoritative current October Core snapshot: 144 dated rows, 44 WebReady show, 3 show_full, 97 hide. Tracker October has 67 populated rows. The _Miss_Learning tab contains previously accepted LEARNED rows; newly found cases are not automatically accepted.

## Source-attributed regression cases (discovery evidence, not filming rights)

- Oct14 ONLYUS Weeknd Boat Party: https://www.eventpop.me/e/174645
- Oct15 Guerlain x BLUE PONGTIWAT: third-party schedule https://hoshilive.com/en/event/guerlain-holiday-collection-2026 ; primary brand photo/access unverified
- Oct15 Onitsuka pop-up artist schedule: https://eveduler.com/province/bangkok ; performer/time primary authority unverified; same-day artist is not same event as Guerlain
- Oct16 Melody Of Life 17 Day16: organizer-named stages https://music.apple.com/th/playlist/wave-stage-melody-of-life-17/pl.c7fb2334ce194e57b0e034fe2aea3517 and https://music.apple.com/th/playlist/sun-stage-melody-of-life-17/pl.bdd632d84afa46a9a6d4060a26147720 ; already Tracker Candidate + monthly HOLD, not Core
- Oct19 KEB DAO/Caltex with Miu Natsha: https://asiangl.com/event/miu-natsha-keb-dao-caltex-october-19-2026/ ; independent schedule conflict (centralwOrld versus Charoen Krung) means VENUE_CONFLICT_HOLD
- Oct20 HOWE Awards: official BITEC https://www.bitec.co.th/event/howe-awards-2026-14th-anniversary ; private ceremony is NOT general public fan access
- Oct22 EVERPINK x TleFirstOne: indexed brand https://www.beautynailhairsalons.com/TH/Bangkok/100505691409142/EVERPINK-COSMETICS ; Candidate VERIFIED_HOLD, lucky-fan entry
- Oct26 LenaMiu x EVEANDBOY: https://asiangl.com/event/miu-natsha-eveandboy-new-underground-october-26-2026/ ; Candidate VERIFIED_HOLD
- Oct26 ZATO Blackbeans: ticket page https://www.zipeventapp.com/e/volume-base-022 ; already Core hide
- Oct27 PERSONA LIVE TOUR 2026: first-party ticket https://www.eventpop.me/e/171450 plus venue https://cloud11bangkok.com/happenings/all-events/6abfbaeac51a82b625124598 ; monthly Tracker HOLD already, but Core absent; Bangkok photography/lens restrictions still unverified
- Oct30 THE FACE SHOP x TeeTeePor: brand website https://www.thefaceshopthailand.com/index.php/ and indexed brand post https://03-presentation.twstalker.com/thefaceshop_th ; Candidate VERIFIED_HOLD, restricted 30 selected fans, exact venue/photo rules pending
- Oct30 LenaMiu PLS Love: https://asiangl.com/events/ ; Candidate HOLD, precise time unverified
- Oct30 SIAM HALLOWEEN: https://www.flexconnect.net/ ; already Core show

## Source code and safety path

1. server/kk-ultra-deep-backscan-miss-review.js: pure immutable case catalog, strict date + event identity matching, reconciliation of seven required snapshots, 13-column Miss Learning PROPOSED_REVIEW_NOT_LEARNED rows. Idempotent by stable MISS|OCTBACKSCAN|YYYYMMDD|CASEID. Never writes a data source.
2. server/kk-ultra-deep-v2-learning-agent.js V8: consumes optional backscan_review_snapshot. Returns backscan_miss_learning and BACKSCAN_REVIEW_PENDING. Does NOT create missed_events, adaptive query terms, miss classes or accepted training; adds explicit may_mark_backscan_as_verified_miss=false.
3. scripts/kk-ultra-deep-backscan-miss-review.js: local JSON input, read-only output. Only --snapshot-json and --as-of allowed, all other flags rejected.
4. tests/kk-ultra-deep-backscan-miss-review.test.js: 17 authored regression cases including conflicts, exact-date dedup, booked-day exclusivity even 1/2 spare, owner tombstone, past date, duplicate Miss ID, PII exclusion, incomplete snapshot, no-auto-learn, CLI read-only.
5. package.json: tests wired to test:ultradeep:recall and thus postinstall; check adds syntax checks for new module, CLI and test. Existing owner-core-learning VERSION assertion adjusted to V8.

## Zero-cost verification sequence — NOT accepted as executed

Use Node 20+ on a trusted private checkout of the exact branch head:

    npm run check
    npm run test:ultradeep:recall
    node --test tests/kk-ultra-deep-backscan-miss-review.test.js tests/kk-ultra-deep-owner-core-lineage.test.js
    npm run audit:ultradeep:backscan -- --snapshot-json /private/oct-2026-sheet-snapshot.json --as-of 2026-10-13

The snapshot must contain actual raw row objects for events, web_ready, tracker_candidates, tracker_monthly, miss_learning, bookings, visibility_locks. An omitted surface is HOLD, not an empty table. As-of timestamp mandatory. Do not commit customer identifiers or raw booking rows.

GitHub Actions quota warning 2032/2000 minutes and zero-step jobs block exact-head hosted acceptance. No paid GitHub Actions retries, Vercel Preview or browser release is authorized. Syntax/readback alone does NOT prove Node test success. The full October Supabase Shard authority still has zero accepted shard receipts.

## Governed Miss Learning progression

A. Review-only proposal with status PROPOSED_REVIEW_NOT_LEARNED, Root Cause=UNDETERMINED_AWAIT_SCANNER_AND_VERIFIER_RECEIPTS and Learned At blank. Manual omission from Tracker is not proof scanner failed.
B. Owner Verifier establishes primary event-specific evidence, exact date+venue, public zone and lens/photo rights, active booking locks, real provider search/negative receipts and deduplicated original identity.
C. Only a separately authorized governed Tracker writer may insert or update exact missing Miss IDs following header validation and fresh readback; no direct Google Sheets mutation as part of this work.
D. Owner-approved, evidence-backed real scanner failure may be passed to missed_events; unverified Backscan observations remain isolated until then.
E. No merge or Production deployment without green exact-head Node tests, verified cost-free CI and post-release readback.

Business writes: ZERO. Original Core, Tracker, bookings, customer info, marketing posts, pricing, owner-hidden history and Production unchanged.
