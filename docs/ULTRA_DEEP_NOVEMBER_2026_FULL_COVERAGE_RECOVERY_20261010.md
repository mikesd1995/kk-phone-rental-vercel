# KK Phone Rental — November 2026 Ultra Deep recovery, from external-first evidence

**Date:** 2026-10-10 Asia/Bangkok.
**Work type:** source fixes and read-only production audit. **NO Production Business writes in this recovery pass.**
**Acceptance level:** DRAFT SOURCE UPDATED; **NOT full live November Ultra Deep Acceptance**.
**No paid tools, no topups, no X auto-publishing, no blind merge/deploy.**

## 1. Observed production truth at start
- Live site https://kk-phone-rental.vercel.app/ on Vercel Production READY SHA `69390a94972b8c636317bbf00d62ab677c0cc66f`, deployment `dpl_AmYtTipVdrzuT1i5XdYBGp3wdY1L`; not Draft PR #680.
- Read-only Supabase `mxjnjujqjybqughsnqbz`: **0** November 2026 unified `kk_ultra_deep_commands`, **0** `kk_ultra_deep_scan_shards` table, **0** `command_kind` column. Source-only proposed migration and Edge OIDC action from previous work are **NOT DEPLOYED**.
- Read-only canonical backend Google Sheet `12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU` `01_Events` / `08_Web_Ready` currently **113 November event rows**, **23 public** (20 show / 3 show_full), **90 hidden**. Before prior November insertion, 107 / 17 public; existing 6 owner-authorized brand cards in current Production public API.
- Read-only tracker `1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo` `_Candidate_Queue`: ~24 November date-matched candidates, many `VERIFIED_HOLD` / `PROCESSED_HOLD`. The monthly `พ.ย. 2569` sheet and Core exist, so the problem isn't a blank month; it is **new-discovery completeness**.
- Exact active booked days **November 1, 7, 8, 15, 21, 22, 28**. Owner explicitly wants no other events on each, even one remaining phone; Nov 1 NCT only, Nov 8 Dew Tee only, Nov 28 STARLYMPICS only. Historic owner-hidden tombstones never auto-reopen or repriced.
- The **6 live November brand events** (Oct10 earlier turn, untouched here): Nov6 SENKA×Junior, Nov20 L'Oréal Elseve×AuAu, Nov26 LOLLI Mew, Nov27 LOLLI JamesSu, Nov29 LOLLI EmiBonnie and D7×NuNew. No additional events published in this recovery pass; no booking/price/visibility change.

## 2. Direct root causes proven in Draft PR #680
1. `server/kk-monthly-deep-scan-query-plan.js` V14 contained many **literal October 2026** Beauty Buffet, LingOrm, NARS, Halloween and Oct 30/31 searches. They appeared in broad discovery even for November because the plan loop consumed entire static tier terms irrespective of target month. This wastes search attempts and misses November brand announcements.
2. `server/kk-ultra-deep-runtime-runner.js` V2 `buildKnownMissPlan()` scanned the **ENTIRE** historic corpus, even September/October cases on November runs. A time-bounded 210s single call could expire before target-month coverage. `server/kk-ultra-deep-month-shard-runner.js` likewise used this unscoped plan. Historical/other-month known misses still belong in learning but must not consume every November scan.
3. No named November first-party brand/source lanes for **BEAUTRIUM×SENKA, L'Oréal×AuAu, LOLLI multiple exact daily artists, D7×NuNew**, although those official first-party posts were independently published early; no November date-scoped regression guard. Only October Beauty Buffet had been pinned.
4. `server/kk-final-pricing-policy.js` V4 `scoreFallback` calculated expensive 890/1090 on high-score weekends and 790/990 on high-score weekdays, violating latest explicit owner fallback **Mon–Thu 490/590; Fri–Sun 690/890**, even when no exact competitor quote. Invalid date/Thai formatted Google Sheets dates could cause baseline to override price expectations. Historical owner booking day price locks need fail closed before any repricing.
5. Infrastructure gap is independent of source code: no November queue command and no deployed service-role durable shard storage. No honest claim of completed Production Full Loop is possible without live authenticated receipts and source-to-storefront readback.

## 3. Source changes committed to Draft PR #680 (not Production)
- `server/kk-ultra-deep-known-miss-regression.js` **V17**: 7 exact event-date known misses: SENKA Nov6, L'Oréal Nov20, LOLLI Mew Nov26, JamesSu Nov27, **BeverTonliew Nov28 (BOOKED/report-only)**, EmiBonnie Nov29, D7 NuNew Nov29; first-party source URLs in fixture and explicit original month. No fixture grants live evidence.
- `server/kk-ultra-deep-runtime-runner.js`: `buildKnownMissPlan(month)` scopes probes to target month plus explicitly declared discovery months, while no-arg method retains historical full corpus only for historic unit tests. Both standalone monthly and checkpoint replay call with `MonthlyPlan.monthRange(input).month`. `server/kk-ultra-deep-month-shard-runner.js` now passes November target month to known-miss phase. This prevents old October-only queries from consuming November known-miss batch and from bloating total runtime.
- `server/kk-monthly-deep-scan-query-plan.js` **V15**: `tierTermsForMonth` removes explicit October-only, day-specific queries outside October; `NOVEMBER_2026_TERMS` covers four named brand categories, cross-month October campaign qualification for Nov performance, 26/27/28/29 distinct LOLLI appearances, official mall/artist calendars, independent idol, social, announcement changes. Existing generic 11 tiers/source registry remain. Not a dishonest "all web sources exhausted" claim.
- `server/kk-ultra-deep-source-registry.js` **V13**: four required first-party November coverage lanes: BEAUTRIUM/SENKA, L'Oréal Elseve, LOLLI official, D7 NuNew. Missing one must fail Source Universe strict-live proof, not silently classify generic NO_EVIDENCE as comprehensive.
- `server/kk-final-pricing-policy.js` **V5 OWNER WEEKPART**: non-exact-competitor owner price fallback **Mon–Thu 490/590, Fri–Sun 690/890**, standalone lens hidden. Price notes `NOT_COMPETITOR_MEDIAN`, provisional recheck; input `has_active_booking_on_date=true` or `booking_day_locked=true` returns `HOLD_BOOKING_DATE_PRICE_LOCK`, no price writes. Supports ISO `YYYY-MM-DD` and actual Google Sheet `DD/MM/YYYY` with calendar date validity. Genuine market observations may still select exact event median under old rules; no invented median.
- Regression additions in `tests/kk-ultra-deep-known-miss-regression.test.js`, `tests/kk-ultra-deep-runtime-runner.test.js`, `tests/kk-ultra-deep-source-registry.test.js`, `tests/kk-monthly-deep-scan-query-plan.test.js`, and `tests/kk-final-pricing-policy.test.js`, added pricing tests to `package.json` `test:ultradeep:recall`. Tests cover month-scoped corpus, Oct vs Nov source isolation, booked Nov28 NEVER publisher implication, 490/590 weekday and 690/890 weekend calendar cases, DD/MM/YYYY, and no fake 5-competitor evidence.
- Older regression test assumed `CORPUS.slice(1)` meant remaster was omitted; adding November rows above remaster exposed this **test-order coupling** and the initial preview failed two tests. Fixed test to use `case_id!=='remaster-20261010'`. This is a **test correctness repair**, not evidence a source broke.
- **Last HEAD before this handoff doc:** `4cfb4f172f2e8ca82f4465bfa4ab403b82ec6a19`; full CI on exact latest HEAD is **NOT YET VERIFIED**. Latest listed Vercel Preview for branch on commit `71b073ce879d6eb5f9669b49d165f7e3758bf437` `dpl_GfmDpip4icUo1xpcsHRA4HnTDcd7` ERROR: stale two test failures above; no newer deployment in list after test-order fix and pricing change. GitHub Actions run `37992441828` reported failure. DO NOT cite previous **143/143** October preview as proof of new November changes. No further Vercel paid quota or trigger commits.

## 4. Independent public-source coverage and reconciliation
Actual public web searches checked:
- First-party brand X/IG: `https://x.com/TheBeautrium/status/2106604292421681359`, `https://x.com/LOrealParisTH/status/2091707064217145662`, `https://x.com/D7Thailand/status/2106981183045460166`, `https://www.instagram.com/p/DeLkoF9SLss/`.
- Official ticket/event discovery: `https://www.eventpop.me/g/concert?locale=th` — Nov14 BNK48/CGM48 Journey of Dreams and GE final results, Nov8 HUGO, Nov21 rock/music/film; all require Core+owner visibility check before treating as net-new.
- `https://eveduler.com/province/bangkok?m=2026-11` reports 25 Nov Bangkok concerts, artist/venue pages.
- `https://www.natgan.com/?month=2026-11` lists BL/GL fancons incl Nov7/8 Dew Tee, Nov13/14 NamtanFilm, Nov15 MilkLove, Nov21/22 JanJingjing and Nov28 STARLYMPICS.
- `https://popradar.app/th/events/festival/calendar?month=2026-11` includes Nov25–Dec1 เด็กสยาม festival; NOT automatically a filmed artist appearance on all seven days, and Nov28 blocked.
- `https://www.popupplans.com/events` includes MEGA MUSIC IN THE PARK #6 Nov28–29; owner-hidden day2 must NOT be auto-reopened.
- `https://livein.city/th/bkk/concerts/scene/thai?month=november&year=2026` lists Thai concerts; many existing Core but hidden.
- `https://www.siamzone.com/calendar.php` and `https://hoshilive.com/cities/bangkok` secondary cross-check only.

### Critical high-value correctly NOT republished
- **BNK48 & CGM48 Journey of Dreams 14 Nov** (`EVT-20261114-BNK48-CGM48-JOURNEY-OF-DREAMS`) and Senbatsu Final Results same date **already exist in Core `active_on_web=FALSE`**. Never create duplicates or unhide despite official Eventpop listing. These are NOT discovery misses.
- **MEGA MUSIC IN THE PARK #6 Nov28 & Nov29** both already Core inactive; `18_Event_Visibility_Locks` records LOCKED for both, Nov28 also booked STARLYMPICS. Day 2 Nov29 unbooked but owner-hidden; no resurrection.
- **RUNAWAY Becky concert Nov29** already Core inactive, not a new miss; no re-add.
- **THE PLAYERS BUILD FANCON Nov21** Core inactive, booked CAT EXPO day; no competing card.
- **LOLLI BeverTonliew Nov28** official brand original post confirms event; source mandatory Known-Miss, but date is booked STARLYMPICS and CANNOT be published.
- **MELT FEST / LOUDLY / private club music / classical recital** may be valid concerts but low or unclear rental/recording fit; existing Candidate `HOLD` states must not be published solely from secondary calendars.
- **เด็กสยาม FESTIVAL Nov25–Dec1** is a candidate lead; no reliable artist/day schedule proving phone-rental opportunity yet, do not fabricate poster or price or post all 7 days.

## 5. Automation/control-plane finding
- The old `KK Discovery Scanner — v4.9.43` and `KK GPT Verifier + Closure — v4.9.44` scheduled automations were read (private task state) and are **DISABLED**; many legacy watchers also disabled. They must NOT be silently re-enabled against stale policy/task binding and without runtime acceptance, as their own prompts forbid blind revival. The two separately created poster-only watch tasks for Oct/Nov are enabled, but do not substitute for exhaustive discovery. Notifications for the Nov poster watch are disabled in task state, so an alert may not reach the owner even if tasks run; review notification preferences in product if desired.
- No new automation task launched here and no production scheduler/control-plane configuration changed.

## 6. Remaining hard acceptance gates
1. **CI verification** on exact new HEAD with `node --test ... tests/kk-final-pricing-policy.test.js`, and Vercel Preview READY for exact source HEAD. Initial preview failed *two outdated test expectations*; changed source has not been tested on an exact READY deployment. Keep PR Draft.
2. **Cross-PR conflict review** for Verifier #654, booking day #655 and PR #680. No blind merge.
3. **Service-only Supabase migration** checkpoint table/type/RPC, OIDC Edge deploy, locked idempotent `SHARDED_READ_ONLY` command kind, with actual DB auth/readback, no paid plan; currently missing.
4. **Approved November queue command** `commit=false`, real zero-cost all-source fixed-month shard receipts, strict known misses, full source-universe and 21st-century event links; no false NO_EVIDENCE.
5. Exact candidate identity, first-party poster, event access/filming rights, external-only demand and current real competitor quote evidence; no source = no median. Owner Booking Lock + tombstones exact readback.
6. Genuine authenticated November `READ_ONLY_ACCEPTANCE` / Production Full Loop with Core→Web Ready→Public verified and `production_writes=0`, separate owner-governed changes only after every gate.
7. Long-tail event recheck T-7 and T-3 as source announcements change; don't treat historic candidates or 23 cards as exhaustive event universe.

## 7. Cross-chat truth
- This file + `docs/ULTRA_DEEP_NOVEMBER_2026_GOVERNED_RESCAN_AND_PUBLISH_20261010.md` (six actual live November cards with price/posters), + `docs/ULTRA_DEEP_OCT2026_RESUMABLE_RELEASE_HANDOFF_20261010.md`, + Issue #686 and PR #680.
- This recovery turn: **code changed, read-only audited external sources, no new event inserts, no business writes, no deployment or spend.** Code quality improvements observed in source only; production scanner NOT accepted. Continue from most recent HEAD and source evidence, never re-run the entire historical audit or lose owner rules.

**Status:** `NOV_MONTH_QUERY_FIXED_SOURCE_ONLY` | `NOV_7_KNOWN_MISS_GATES_SOURCE_ONLY` | `NOV_PRIMARY_BRAND_SOURCE_LANES_SOURCE_ONLY` | `PRICING_WEEKPART_SOURCE_ONLY` | `NOV_LIVE_FULL_SCAN_NOT_EXECUTED` | `V27_TABLE_UNDEPLOYED` | `CI_HEAD_NOT_READY` | `OWNER_BOOKING_HIDDEN_INTACT` | `PRODUCTION_BUSINESS_WRITES_ZERO_THIS_PASS`.

## 8. Same-pass final verification addendum (2026-10-10)

- After initially writing this handoff, the owner pricing source acquired additional **strict Google `DD/MM/YYYY` input support**, invalid-day date validation, and **fail closed on nonempty invalid event dates** rather than reverting to expensive rental-fit-score tiers. Regression coverage was added for all seven weekday types, actual Nov cases, booked dates, and `2026-11-31`.
- **Latest tested-by-commit CI state is NOT GREEN**: Branch code/test HEAD before this documentation update is `75621ea98326b4e210f895a4671ebb7ba4aacca9`. GitHub Actions `Ultra Deep V2 Acceptance` run `37992927206` returned **failure**; attempting to fetch logs for failed job `114031474932` returned GitHub 404 `BlobNotFound`. Thus exact failed step/code reason is UNAVAILABLE. Do not attribute it to test failures or quota without proof.
- New Vercel Preview for commit `75621ea` was **NOT PRESENT** in the branch deployment list at final check. Most recent listed deploy `dpl_GfmDpip4icUo1xpcsHRA4HnTDcd7` at OLD commit `71b073ce` failed two prior test-order assumptions, now fixed in later source HEAD but **still untested at exact latest HEAD**. Do not misstate the prior preview as full pass or buy Vercel credits.
- Published November 6 owner-authorized event cards remain live from the previous turn; this pass only edited Draft branch code/docs and read production systems. No store edits, booking changes or price changes in Production.
- Latest release gate remains **RUN NEW EXACT-HEAD REGRESSIONS + VERCEL PREVIEW READY** and then an authorized migration/OIDC/queue-run acceptance. If Preview/CI unavailable, classify as `CI_EVIDENCE_UNAVAILABLE` not `PASS`.
