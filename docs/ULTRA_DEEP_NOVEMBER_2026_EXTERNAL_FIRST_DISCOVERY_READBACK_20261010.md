# KK Phone Rental — November 2026 external-first Ultra Deep search and owner-governed publication

**As-of:** 2026-10-10, Asia/Bangkok. Scope November 1–30, Bangkok metro / nearby accessible venues.
**Work done:** actual external discovery / primary-source cross-check; exact canonical booking/owner-hidden snapshot; one legitimate new event publish with official account identity and missing poster explicitly flagged; seven additional Candidate Queue dispositions; month-specific regression code; public API readback. **NOT** an authenticated November autonomous Full Loop acceptance. Do not equate 114 Core events with total external event universe.

## 1. Owner hard constraints (never regress)
- **ANY active booking day** blocks adding/unhiding any other event that date, regardless of spare devices; inventory total **2** vivo X300 Pro. Protect **Nov 1, 7, 8, 15, 21, 22, 28** confirmed active-booking dates (re-read before EACH future write).
- Existing inactive/owner-hidden event rows and `18_Event_Visibility_Locks` tombstones are not candidates for auto-resurrection. No duplicate event IDs or duplicate same event/date.
- Without truly verifiable independent **same-event phone-rental competitor market median**: **Mon–Thu phone 490 / phone+lens 590 THB**; **Fri–Sun phone 690 / phone+lens 890 THB**. Lens-only hidden. Do not change price for booked event or override explicit owner price. A phone-brand purchase threshold (e.g. 250 or 4590 THB product spend) **is not KK rental pricing**.
- Event with no official poster may be published with blank poster when event date/identity confirmed and user expressly authorized; do not use different artist/year generic image or generated poster. Customer must have legitimate event access and organizer recording permission (often private Lucky Fans).
- Zero credit topups/paid plan upgrades, no auto X posting, no booking confirmation, no accidental customer/financial data writes.

## 2. Canonical before/after business state — independently verified
Spreadsheet `12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`.
- Pre-turn `01_Events` + derived `08_Web_Ready`: **113 November events / 23 public (20 show + 3 show_full) / 90 hidden**.
- Post-turn `08_Web_Ready`: **114 November events / 24 public (21 show + 3 show_full) / 90 hidden**.
- Seven booking-locked dates protected, no prior hidden row changed, no Booking mutation, no changes to other events' prices. There were **REAL Production business writes** this turn: **one `01_Events` event, three `04_Event_Overrides` rows**. Other writes: seven Candidate Queue rows + one prior Candidate classification correction in tracker. Not `production_business_writes_zero`.

### NEW customer-visible verified event
- New unique `event_id`: `EVT-20261105-MIZUMI-PHUWIN-MOISTURE-MATCH`
- **Thursday 5 November 2026** — **MizuMi × PHUWIN — FIND YOUR MOISTURE MATCH**, **EDEN ZONE FL1, CENTRAL WORLD**, Bangkok.
- Source: Brand **MizuMi Official** @MizuMi__ campaign announcement independently re-tweeted/quoted at https://workingww.twstalker.com/_aimme_t and https://workingww.twstalker.com/PPw_Azula , plus independently compiled Pond/Phuwin schedule https://ppw-schedule.vercel.app/. **Source proof from the brand's post text is strong but direct exact original X status permalink is not yet obtained; do not misrepresent the fan mirror as the canonical announcement permalink.**
- Brand qualification cross-month: purchase/campaign roughly Oct 4–23, eligible announcement Oct28; actual event Nov5. **120 selected fans**: 20 Super Fans + 100 Lucky Fans (25 from 7-Eleven + 75 all channels). Specific group photo/polaroid/digital opportunities depend on winning tier; *NOT open public filming*. Shop only rents equipment; customer must have real access/recording permission. This is why brand purchase-lead discovery must run across month boundary.
- Source official poster asset exact November-event media **not found** despite image lookup and social source checks. Per owner explicit rule `01_Events.poster_image_url` is **blank**, customer Thai note says original poster pending. NEVER borrow Phuwin/MizuMi generic campaign/key-visual older imagery.
- Zero active Booking Nov5; existing Nov5 guitar/indie shows are owner-hidden (e.g. Paul Gilbert, Tigers Jaw, Blackbeans, AYLA). Did **not** reopen them.
- **Actual event write** into `01_Events` appended after earlier Nov entries: event status `open`, `active_on_web=TRUE`, `data_health=OK`, source and 120-winners condition.
- **Actual price writes** to `04_Event_Overrides`: `TPL-VIVO-X300-PRO-PHONE` **490** TRUE, `TPL-VIVO-X300-PRO-BUNDLE` **590** TRUE, `TPL-ZEISS-2-35X-LENS` FALSE/hidden.
- **Derived Sheet readback**: `08_Web_Ready`: exact ID `show`, `เปิดจอง`, `available_phone_count=2`; `09_Web_Packages`: `phone_only=490 available`, `phone_lens_bundle=590 available`, `lens_only=390 hidden` (390 is *inactive generated base value*, not published offer).
- **LIVE PUBLIC CUSTOMER API EXACT READBACK SUCCESS** through authenticated read-only Vercel web fetch, both contain exact event ID, name, date, `show`, 490/590 available / 390 lens hidden:
  - https://kk-phone-rental.vercel.app/api/kk-data?sheet=08_Web_Ready&range=A4%3AK
  - https://kk-phone-rental.vercel.app/api/kk-data?sheet=09_Web_Packages&range=A4%3AN
- Browser screenshot/real iPhone graphical QA **not performed**. Live public data feed confirmation != visual poster/UI QA.

## 3. Recovered external candidates / business dispositions
All appended with source, date, venue/limitations, `decision` to existing separate `_Candidate_Queue` in tracker `1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo` (7 additions; not new storefront cards except MizuMi).

| Date | Name | Source | Decision / why not published |
|---|---|---|---|
| **Nov5** | **MizuMi × Phuwin** | Official brand post retweeted by independent X mirrors + actor calendar | **PUBLISHED** exact public feed, poster blank, 490/590; special access 120 winners |
| **Nov6** | Brice × Pond Naravit, SCBX NEXT TECH Siam Paragon | https://ppw-schedule.vercel.app/ | **VERIFY_REQUIRED**, secondary fandom schedule only; primary Brice/GMMTV official announcement, time and entrance rules missing, cannot confidently publish |
| **Nov15** | Namneung Fan Meeting THE FEELING OF US: Written With You Chapter 30 | https://www.ticketmelon.com/th/grandstarconnext/namneung-chapter30 | **BOOKED_DAY HOLD**; exact primary ticket available at NT Auditorium, 16:00, but Nov15 MilkLove + K*Pop Masterz booked |
| **Nov21** | Serious Bacon \"ลอย กะ เธอ\" | https://www.eventpop.me/e/171584/seriousbacon-loykathoeconcert | **BOOKED_DAY HOLD** CAT EXPO, no conflicting storefront card |
| **Nov21** | Giffarine × Pond \"Fitt to Fin with Pond\" | https://x.com/Giffarineoffice plus public first-party post mirrors | **BOOKED_DAY HOLD** CAT EXPO; 50 selected Lucky Fans at EmSphere, exact photo/access terms still need check |
| **Nov28** | LOLLI GET GLOWING × BeverTonliew | https://x.com/lolliofficialth and calendar | **BOOKED_DAY HOLD** STARLYMPICS; distinguish this from already published Nov26 Mew, Nov27 JamesSu, Nov29 EmiBonnie |
| **Nov15** | Felinacanin × Phuwin \"A Special Afternoon Tea\" | https://x.com/felinacaninoth/status/2105130523748450524 | **BOOKED_DAY HOLD**; invitation-only/private access |

**Corrected pre-existing Candidate** `_Candidate_Queue!I353:L353`: **`เด็กสยาม FESTIVAL 2026` November date conflicts**. A secondary calendar advertises Nov25–Dec1 but https://www.zipeventapp.com/e/dek-siam-festival-2026-aab0591e announces **Oct5–11** for DEK SIAM. Caution: these might be similarly named but distinct editions; **must get organizer PMCU authoritative November-specific announcement and matching official poster to resolve**, don't assume they are same or automatically publish November. Flagged `DATE_CONFLICT_HOLD` with both source links.

## 4. Main external-source scope in this manual round
Actual search families covered: Eventpop, Ticketmelon, Ticketmaster TH, ThaiTicketMajor, Zipevent, LiveNation, official venue/mall social accounts and artist schedules, Natgan BL/GL, Bangkok event calendars, pop-up festival listings, GMMTV, branded X/IG lucky fan/Top Spender, limited brand/photo sessions, general Thai and international livehouse music; tested competitive-phone-rental price terms. **This is a substantial manual external-source sweep but has no instrumented per-source exhaustiveness receipt**, no precise denominator or justified 100% claim. Individual sites can block/censor historical social posts; monitor changes.

Correctly no re-add/unhide of existing hidden events:
- Nov14 BNK48/CGM48 Journey of Dreams and Senbatsu Final Results (canonical inactive).
- Nov11 Wednesday Song Pause & Scrubb (canonical inactive).
- Nov29 RUNAWAY Becky concert, MEGA MUSIC IN THE PARK #6 Nov29 (historical owner hidden/LOCKED).
- Nov21 The Players Build, InnOngsa, JMNK and Melt Festival are booked-date or hidden.
- Nov28 GMMTV STARLYMPICS only, all other artists/festivals blocked.
- Nov1 NCT127 only, Nov7/8 Dew Tee only; owner day rules override unused stock.
- The three prior LOLLI Nov26/27/29 events were already updated by separate poster-monitor workflow as seen in current read-only snapshot:
  - Mew Nov26 `https://pbs.twimg.com/media/HUBeFawaYAAePC_.jpg`, Siam Center Atrium2 G, 18:00
  - JamesSu Nov27 `https://pbs.twimg.com/media/HUBk6vTb0AATlw7.jpg`, same venue 18:00
  - EmiBonnie Nov29 `https://pbs.twimg.com/media/HUBywQgbcAAaroT.jpg`, same venue 17:00
  **Do not credit this turn with updating them**; only observed/validated existing source of truth.

## 5. Root-cause prevention code in Draft PR #680, NOT merged
- `server/kk-ultra-deep-known-miss-regression.js` **V18**: new first-party MizuMi × Phuwin Nov5 exact-month case with October cross-month purchase `discovery_months:['2026-10']`, strict Nov event date even when social post indexed in Oct; cover 120 fans. October/November crossmonth probe is for discovery; never equate October event date with November.
- `server/kk-monthly-deep-scan-query-plan.js` **V16**: NOV `PRESS_BRAND` MizuMi × PHUWIN and `CAMPAIGN_LEAD_TIME` October MizuMi 7-Eleven / Shopee qualification for Nov5, retains November specific other brand source terms.
- `server/kk-ultra-deep-source-registry.js` **V14**: MizuMi x PHUWIN October-purchase-to-November appearance first-party mandatory brand lane. Missing real live source receipts = coverage HOLD.
- Unit tests added/adjusted in `tests/kk-ultra-deep-known-miss-regression.test.js` and `tests/kk-monthly-deep-scan-query-plan.test.js`; crossmonth January? no; **Oct strict LIVE should include MizuMi forward-discovery but without exact Nov5 event date must still fail**, Nov should detect separately.
- Previous owner-tier `kk-final-pricing-policy.js` V5 from earlier turn remains Source draft, not production deployed. Live Sheet 490/590 this turn written by expressly authorized governed business data update, not a result of the unavailable source auto-run.

## 6. Exact engineering/infra acceptance evidence
- Production Vercel remains READY **old main** SHA `69390a94972b8c636317bbf00d62ab677c0cc66f`. Code PR #680 Draft, not deployed, production autonomous Full Loop is still **NOT ACCEPTED**.
- During this turn a **Vercel Preview** for an intermediate code commit `d9e56da234482d89c4126eac22b0a760727793d8` became **READY** as deployment `dpl_41yyJ5wxF45tFrixP1SivKBwzDJp`; logs showed `test:ultradeep:recall` **160/160 PASS** and original poster tests **1/1 PASS**. **This is not latest-head acceptance**: subsequent MizuMi query/registry/test changes on HEAD through `badfbc29e47cf9981e72e211ae3593ef4ad8cf7e` must pass separately before claiming green current PR. No paid Vercel upgrades or trigger-commits.
- Supabase read-only **independently reverified this turn**: `kk_ultra_deep_scan_shards` table **absent (0)**, `kk_ultra_deep_commands.command_kind` **absent (0)**, `kk_ultra_deep_commands` **0 November commands**. There is NO authenticated month-wide resumable checkpoint or complete Source Registry execution/Verifier/price/owner state evidence; synthetic fixture tests do not count. The scanner cannot honestly be certified `FULL`.
- Exa retrieval returned credits-exceeded **402** during public feed fetch attempt; NO user topup/pay action. Recovered fully using user's already connected **Vercel web_fetch_vercel_url** read-only, which verified production customer API.
- Neither Migration nor Edge Function pushed; no GitHub merge, no X post, no booking/customer confirmation. No added scheduled task. Owner-critical Booking and owner-hidden locks remain unchanged.

## 7. Next real gates before calling automatic Ultra Deep Nov COMPLETE
1. Exact-HEAD CI node regression and Vercel READY (not intermediate SHA), cross-PR verifier (#654) and booking date (#655) parity.
2. Deploy reviewed free-tier protected Supabase read-only shard migration/Edge bridge with RLS, authenticated proof, and queue `SHARDED_READ_ONLY` command for **2026-11** `commit=false`.
3. Run all required source-registry November source IDs across bounded persisted shards: first-party brand official X/IG, label/artist, concert tickets, mall stages, venue, calendars, competitor shops; record each **real** executed receipt and reason for no evidence (no fake NO_EVIDENCE coverage).
4. Strict known-miss Nov (MizuMi included) and crossmonth recovery; exact event date/venue, photo/rights, poster pending records, independent fan demand and exact-event independent competitor samples, fallback only when none.
5. Re-read current booking/owner locks, no owner-hidden resurrection, run authorized November `READ_ONLY_ACCEPTANCE` with `production_writes=0` and reconciled Core/Ready/packages/public exact readback; only separately owner-approved business writes.
6. Resolve Brice original authority, DEK SIAM Nov conflict, MizuMi original poster exact media, and any future fresh artist schedule events. Maintain owner's zero-paid-credit policy.

**Status as delivered:** `NOV_MANUAL_SWEEP_PERFORMED_NOT_EXHAUSTIVE_PROVEN`, `1_NEW_EVENT_LIVE_PUBLIC_API_EXACT_VERIFIED`, `7_NEW_CANDIDATE_DISPOSITIONS_DURABLE`, `DATE_CONFLICT_RECORDED`, `114_CORE_24_PUBLIC_90_HIDDEN`, `BOOKING_DAYS_PROTECTED`, `MIZUMI_RECALL_SOURCE_PATCH_DRAFT`, `INTERMEDIATE_PREVIEW_160_OF_160_PASS`, `LATEST_HEAD_CI_PENDING`, `AUTONOMOUS_PRODUCTION_FULL_NOT_PASSED`.
