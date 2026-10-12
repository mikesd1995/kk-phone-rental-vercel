# KK Phone Rental — November 2026 governed external-first scan and first publish (10 Oct 2026)

**Scope**: Nov 1–30 2026, Bangkok/greater metropolitan area, concerts, fancons, brand/artist lucky-fan events, small idol/mall/official artist calendars. User explicitly requested "ทำของเดือน 11 ต่อ" after the October successful 15-event catalog action and locked daypart pricing. **This document records real business-data writes and verified public reads** but **does NOT claim autonomous Ultra Deep Full Loop completed**.

## Owner governance, MUST carry forward across chats
- Missing trustworthy *same-event comparable X300 Pro rental price evidence* fallback **Mon–Thu phone 490 THB, phone+lens 590 THB; Fri–Sun phone 690 THB, bundle 890 THB**. This does not override owner-locked prices, existing booked event prices or exact-event supported competitor quotes. **NEVER call default prices competitor median.** Lens-only remains hidden per new event.
- If **any active booking on a date**, NO other event on that date may be newly published or unhidden, even when a phone remains. No resurrecting tombstones/owner-hidden events. Preserve legacy owner closed dates.
- Zero paid provider/credits/top-up. Owner approves X posts and booking confirmations.
- Missing exact-event official poster is NOT a reason to miss otherwise corroborated event: blank poster + explicit pending-source in customer note, no AI/generated or unrelated artist/year image, follow up later. BUT insufficient date/identity evidence, closed venue or unknown public access must be explicitly disclosed and reconciled before handing over a phone.
- Booking happens with no deposit; customer pays on physical handoff, completed only after device return and uploads. Do not alter revenue rules.

## Source-of-truth read-only reconciliation before November writes

Backend Sheet `12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`: `00_Master_Booking`, `01_Events`, `18_Event_Visibility_Locks`, `08_Web_Ready`, `04_Event_Overrides`, `09_Web_Packages`. Tracker `1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo`: `พ.ย. 2569`, `_Candidate_Queue`.

- Before insert: ~107 existing Nov Core events, **17 public** (show/show_full), most of remainder owner-hidden; existing monthly tracker ~60+ event rows and ~24 named long-tail November candidates. No duplicate titles/date matched for six new cases.
- **Active booking dates: Nov1 NCT127, Nov7 Dew Tee, Nov8 Dew Tee, Nov15 K*Pop Masterz and Milk Love, Nov21 CAT EXPO (two confirmed/one cancelled), Nov22 CAT EXPO, Nov28 STARLYMPICS.** Exclude ALL other candidates on these dates. Nov28 LOLLI BeverTonliew and NOV28 multiple new festivals are **NOT** added despite interested fandoms. Nov1 other events and Nov8 others are owner explicitly hidden. Nov28 owner explicit hide ALL except STARLYMPICS.
- Prior explicit owner-hidden/tombstone locks: Nov1 NuNew, Zara Larsson, other; Nov7 BABYMONSTER/BIGBANG/SHINE/PONG etc; Nov8 BABYMONSTER/BIGBANG/MAXKYBAS; Nov21–22 JanJingjing and LenaMiu; Nov28 Lucy/Henry/Together Festival and FORTREASURE day2; Nov30 Slowdive, multiple owner-pruned niche concert events. **No row reopened or repriced**.

## Live external discovery (primary evidence, not fabricated)
- **Nov6 Junior's Bright Day with SENKA**, first-party BEAUTRIUM X post `https://x.com/TheBeautrium/status/2106604292421681359` and artist IG `https://www.siamzone.com/ig/m/4002630672942357184`. Venue BEAUTRIUM Siam Square Flagship; 13:30–14:30; 30 Lucky Fans **closed event** and official 1:1 Polaroid; only for confirmed eligible entrants if permitted to record.
- **Nov20 L'Oréal Paris Elseve Day with AuAu**, primary brand `https://x.com/LOrealParisTH/status/2091707064217145662`. 13:00–15:00; 50 lucky people; winner confirm by Oct14; **venue not publicly confirmed**, explicitly TBA and customer needs proof of entry/access.
- **LOLLI POP-UP GET GLOWING** brand official Instagram `https://www.instagram.com/p/DeLkoF9SLss/`, artist calendar: Nov26 Mew Suppasit, Nov27 JamesSu, Nov28 BeverTonliew, Nov29 EmiBonnie. Nov28 excluded for booking; **Nov26/27/29 venue/clock/entry still unconfirmed**. JamesSu Oct–Nov cross-month purchase campaign ~50 Lucky Fans reported first-party `https://www.sotwe.com/domunditv`. No hotlinked temporary signed Instagram image used; poster missing for 3 events.
- **Nov29 D7 NuNew "นุนิวชวนม่วน งานวัดนี้มีรัก"** first party `https://x.com/D7Thailand/status/2106981183045460166` and official brand 70 Lucky Fans campaign cited on `https://www.sotwe.com/AuautnpFanclub?lang=id` is different (AuAu, do not mix). D7 venue Union Mall G, 13:00–15:00. Restricted 70 privileged participants, no blanket public access.
- **Nov25–Dec1 เด็กสยาม FESTIVAL** Siam Square 62th anniversary noted `https://www.thailandexhibition.com/thai-event-details/dek-siam-festival-2026-th/33529` and `https://popradar.app/th/events/festival/calendar?month=2026-11`. General festival is a lead, **not** a proven fandom/artists meet-and-greet for all seven days, and Nov28 is booked; not published without per-day artist/photography qualification.
- Independent BL/GL calendar `https://natgan.com/?month=2026-11`: Nov7/8 Dew Tee, Nov13/14 NamtanFilm, Nov15 MilkLove, Nov21/22 JanJingjing, Nov28 STARLYMPICS, Nov29 Runaway Becky already in Core or owner-held/locked. **Do not duplicate**.
- Other low-rental-fit/nightlife/classical indie show sources (e.g. piano recital Nov29, Aether night club Nov5) remain Candidate HOLD; booking-dates Nov1,7,8,15,21,22,28 exclude other shows regardless of poster.

## ACTUAL canonical business writes performed 10 Oct
Inserted six unique **new** rows in `01_Events`, following row 338, each `open`, `active_on_web=TRUE`, `data_health=OK`, readable Thai venue/entry/poster caveat notes + source URL. Inserted **18** new event-specific price rows to `04_Event_Overrides`, using default daypart only on these unbooked events; phone/bundle TRUE and lens-only FALSE.

| Date | Event ID | Name | Phone / bundle THB | Poster/source |
|---|---|---|---|---|
| Fri Nov6 | `EVT-20261106-SENKA-BRIGHT-DAY-JUNIOR` | Junior's Bright Day with SENKA × BEAUTRIUM | **690/890** | https://pbs.twimg.com/media/HTwpb6CbEAAUAB3?format=webp&name=large | 
| Fri Nov20 | `EVT-20261120-LOREAL-ELSEVE-DAY-AUAU` | L'Oréal Paris Elseve Day with AuAu | **690/890** | https://pbs.twimg.com/media/HQGNhMZaQAAvWqK?format=webp&name=large |
| Thu Nov26 | `EVT-20261126-LOLLI-POPUP-MEW-SUPPASIT` | LOLLI Get Glowing × Mew Suppasit | **490/590** | POSTER PENDING, official Instagram |
| Fri Nov27 | `EVT-20261127-LOLLI-POPUP-JAMES-SU` | LOLLI Get Glowing × JamesSu | **690/890** | POSTER PENDING, official Instagram |
| Sun Nov29 | `EVT-20261129-LOLLI-POPUP-EMI-BONNIE` | LOLLI Get Glowing × EmiBonnie | **690/890** | POSTER PENDING, official Instagram |
| Sun Nov29 | `EVT-20261129-D7-NUNEW-FAIR-FULL-LOVE` | D7 × NuNew — นุนิวชวนม่วน งานวัดนี้มีรัก | **690/890** | https://pbs.twimg.com/media/HT2ANyiaoAAlxi6?format=webp&name=large |

Price override notes explicitly `OWNER_MON_THU_FALLBACK_20261010 | NOT_COMPETITOR_MEDIAN` or `OWNER_FRI_SAT_SUN_FALLBACK_20261010 | NOT_COMPETITOR_MEDIAN`. Targeted public indexed searches found no sufficient independent exact-event rental prices, **median unavailable**. No existing booked/hidden prices touched. Standalone lens offers all hidden.

## VERIFIED real production data readback

1. Backend `01_Events!A338:I355` contains six new event IDs and dates, `active_on_web=TRUE`.
2. Backend `04_Event_Overrides!A944:E986` contains exactly 18 new package override rows.
3. Derived `08_Web_Ready!A338:K365`: **6/6** newly inserted cards = `show`, `เปิดจอง`, available_phone_count=2. Three have official pbs.twimg.com images, three LOLLI blank. Note: 2 per event is shared real inventory, NOT six times two new physical devices.
4. Derived `09_Web_Packages!A1001:N1080`: **18/18 package rows**: each exact phone 690/490 (daypart), bundle 890/590, lens-only hidden.
5. **PUBLIC LIVE Production customer data feeds**, exact first-party readback successful via read-only fetch: 
  - https://kk-phone-rental.vercel.app/api/kk-data?sheet=08_Web_Ready&range=A4%3AK — **6/6** event IDs present, `show`, Thai notes; verified rows for LOLLI Mew and D7 NuNew.
  - https://kk-phone-rental.vercel.app/api/kk-data?sheet=09_Web_Packages&range=A4%3AN — **6/6** new event IDs, 18 packages, examples Mew phone 490 bundle 590 / D7 phone 690.
6. After write Nov `08_Web_Ready` read across all events: 113 total Nov Core/Web rows = 23 public total, including 20 show and 3 show_full (preexisting booked-event states), 90 hidden. Before was 107 / 17 public. **0 newly published on the seven active booking dates**, zero resurrected owner-hidden cases.
7. Live visual screenshot/poster render QA was NOT completed; API readback != manual browser visual acceptance. No GitHub PR merge or Vercel code deploy required for existing Google Sheet-derived storefront.

## Pending follow-through
- Obtain stable first-party LOLLI event artwork Nov26 Mew, Nov27 James, Nov29 EmiBonnie and confirm venue/exact show times; update only `01_Events.poster_image_url` after identity proof (do not substitute generic June LOLLI popup poster or expiring tokenized IG URL). L'Oréal Nov20 organizer/private venue remains TBA; confirm organizer permission before physical phone pickup or customer guarantee.
- Update exact comparable 10–20 competitor shops when public sources available; owner fallback provisional until then. Do not promise real comparable market median from zero observations.
- **No new tickets or bookings confirmed by this scan**; 6 published cards are customer-facing data only. Once a new booking is created on Nov26/27/29, other cards on SAME DATE must be subject to owner booking-day lock immediately (e.g. both D7 NuNew and LOLLI EmiBonnie on Nov29 now share only 2 phones).
- Phase 2 subsequent November discovery: keep monitoring organizer/artist schedules and brand announcements, prioritize real opportunities already Candidate HOLD by demand; no automatic reactivation of Nov1/7/8/15/21/22/28 blocked event days, Nov30 Slowdive owner hide, etc.
- Production autonomous Ultra Deep Scanner Full Loop acceptance remains NOT PROVEN; PR #680 fixes staged Draft only. Manual connected public-first scan and owner-directed governed Sheet publication are real and separate.

**Truthful status:** `6_NEW_NOV_EVENTS_PUBLIC_API_VERIFIED`, `NOV_TOTAL_PUBLIC_23`, `NOV_ACTIVE_BOOKING_DATES_PROTECTED_7`, `LOLLI_3_IMAGES_MISSING`, `VENUE_CONFIRMATION_NEEDED_LOREAL_LOLLI`, `OWNER_DAYPART_FALLBACK_COMPLIANT`, `NO_PAID_TOPUP`, `PRODUCTION_AUTONOMOUS_FULL_UNACCEPTED`.
