# October–December 2026 Ultra Deep fallback discovery and cross-chat handoff

**2026-10-19 / Bangkok. Scope:** Support owner-authorized addition only on booking-free days after individual Safety Gates, plus December fresh scan. **No production booking, pricing, publication, Make, X or LINE writes.**

## Pre-existing blockers and source states
- Main `a54a348dd3258d87b1ec0c70e6ffd255d4678018`; HOWE red carpet and awards fix Draft [#769](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/769) `9b982949834c7aad8a5f299fc12db3b0a896cad2`, **not production**. This branch depends on #769 and extends only discovery queries/tests.
- Oct–Nov owner-approved conditional additions and current zero-booking dates documented exhaustively in [#770](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/770).
- Three official ticketing date-verified but **not approved for immediate publication**: 30 Oct **หงเสนคลุกฝุ่น : The Legend Begins** (GMMTV official https://www.gmm-tv.com/news/4492/ ; TTM https://event.thaiticketmajor.com/index.php?la=en ); 4 Nov **Scarlet Heart Thailand The Grand Premiere** (TTM https://event.thaiticketmajor.com/index.php?la=en ); 18 Nov **ROAD TO THE GRIM LOVER** (TTM current). Native booking register showed zero reservations on each date; recording permission, external-lens use, original poster/creator-use, authoritative package price/competitor market/score and governed writer acceptance still pending. **No create/write was justified.**

## December manual primary-source discovery
- Native backend sheets: `01_Events` / `08_Web_Ready` **35 event-date rows; 9 show/show_full, 26 hide**. December Tracker **19** title/date-expression rows and Candidate queue **22** December-related title/date matches. Data overlaps, not additive; **no FULL live provider receipt** yet.
- Booking: **Dec3 two BTS**, **Dec5 two BTS**, **Dec6 two WilliamEst** (one cancelled excluded), **Dec7 one WilliamEst**, **Dec18 two JASP**, **Dec19 one JASP**, **Dec20 two JASP**. Owner-booking-day exclusivity blocks unrelated new events even if one phone remains. Re-read immediately before publication.
- Owner LOCKED prevents December reopening of BOYdKO 10–12, Maho Rasop Kings of Convenience 1, Tattoo Stadium 19, other hidden same-day concerts. `08_Web_Ready` & `09_Web_Packages` are generated outputs: NEVER directly write.
- Direct-event new discovery **BOSSNOEUL CROSSOVER CONCERT [THE FINAL CHAPTER] 27 December**, 17:00–19:00, ICONSIAM Hall, https://www.eventpop.me/e/177073/bossnoeul-crossover-concert . Distinct event from **Boss & Noeul 2nd Fansign: Our Golden Moment 26 December** which is ALREADY Core shown. Eventpop terms: livestream prohibited; cameras allowed without lens length limit, photo/benefit sessions must obey zone/height rules. Whether mounted external lens/phone rental qualifies is not yet explicitly certified. Dec27 zero booking found; **P0 VERIFY market & rules**, never copy Fansign 26 package/prices.
- New **Lunatic Summer: Paradox Film Live Concert**, 4 December 19:00, Cloud 11; exact Eventpop https://www.eventpop.me/e/177537/paradox-film-live-concert ; **P2 HOLD** due film/recording restrictions and missing exact rental demand.
- New **Wednesday Song Vol.29**, 9 December 19:30, SiamPic Hall; official Eventpop https://www.eventpop.me/e/176102/wednesdaysong29 ; **P3**, lower expected phone camera rental fit.
- New **CSE Pop Concert**, 25 December 18:00, BITEC Live, official Eventpop https://www.eventpop.me/e/152102/cse-pop-concert ; **P3** pending actual lineup, equipment rules, market.
- **WHITE PARTY BANGKOK**, 29 Dec–3 Jan, already December tracker/Candidate; official Eventpop https://www.eventpop.me/e/159292 . Do not recreate; age restriction and niche/nightlife not automatically attractive for KK.
- **Boss & Noeul Fansign**, 26 Dec, existing Core show https://www.eventpop.me/e/174010/boss-noeul-2nd-fansign .
- **Fujii Kaze 26 Dec CANCELLED** (as recorded in Tracker and direct ticket-operator cancellation); do not recreate from stale event page.
- `รักแห่งสยาม The Musical` 9–25 Dec: this is a **production window, NOT 17 confirmed discrete showdates**. Require per-performance casting and original official schedule to model day by day; December otherwise must not invent many phantom events.

## Source patch scope and tests

This draft branch extends #769 month-planner **without changing any promotion, visibility, booking, price, score or Safety Gates**:
- `server/kk-monthly-deep-scan-query-plan.js` V13: full-month search adds crossover concert / grand premiere OST / Thai phrases; Smart Operational V5 gives source-targeted Eventpop fan-concert, TTM premiere and official agency BL/GL special-show variants using deterministic month-aware search terms.
- `tests/kk-ultra-deep-ticketed-fandom-recall.test.js`: Oct/Nov/Dec search variants; native candidate matcher MUST keep BossNoeul 26 vs 27 different identities; unknown market and package info must stay `VERIFY_MORE` with `production_writes:0`.
- These are regression safeguards, not proof of live event retrieval; exact current provider query/execution receipts and source outcome still required.

## Release gates / next continuation
1. Review exact SHA and focused CI source tests on this stacked Draft PR before any merge/deploy. Merge dependency #769 must pass its own reviewer/owner gates first.
2. Independent manual Verifier for EACH official event: original poster creator-use, date, venue, artist/lineup, access, photography (incl. external add-on telephoto), capacity, exact external demand/competitors, price override/approved fallback, canonical dedup, owner LOCKED history.
3. Governed admin writer with clean dry-run acceptance + owner authorization, exact Core => Web Ready => Production readback. No generated-sheet direct edits.
4. Re-run three months' unseeded provider execution and record source receipts, newly found/known/HOLD/skipped, omissions and reasons. Never claim FULL coverage until proven.
5. If any blocker persists, retain P0 `VERIFY_MORE` and do not claim the event is on sale.

**This checkpoint is durable GitHub evidence for cross-chat continuation. The business release was not executed and remains incomplete.**
