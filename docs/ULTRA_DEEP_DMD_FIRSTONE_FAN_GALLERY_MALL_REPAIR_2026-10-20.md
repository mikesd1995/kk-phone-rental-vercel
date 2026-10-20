# P0 Ultra Deep known-miss repair — DMD MUSIC, AuAuSave Gallery, Scarlet, GRIM LOVER, Siam Center
**Checkpoint:** 2026-10-20 Asia/Bangkok  
**Stack:** main `a54a348dd3258d87b1ec0c70e6ffd255d4678018` → Draft PR #769 `9b982949834c7aad8a5f299fc12db3b0a896cad2` → Draft PR #772 `946e28c658e211ebaec8898dc0d47094b877f974` → this Draft branch `fix/ultradeep-showcase-fan-gallery-mall-20261020`.  
**Safety:** zero paid provider calls, production_writes=0, no merge/deploy, no pricing/booking/customer/Google Sheets/visibility changes, no automatic X/LINE posts or Make activation.

## 1. Verified negative comparison with native source-of-truth

On 20 Oct 2026 read:
- Event Tracker `1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo`: `ต.ค. 2569`, `พ.ย. 2569`, `_Candidate_Queue` bounded populated rows.
- Backend `12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`: `01_Events`, `08_Web_Ready`, `00_Master_Booking`, `18_Event_Visibility_Locks`.

**Missing exact title+date identifiers:** FIRSTONE 2nd Single “8/7” Showcase **19 Oct**, Union Mall G; **Journey of AuAuSave Gallery 1 and 2 Nov**, Union Mall G Zone B; **ROAD TO THE GRIM LOVER Fansign 18 Nov**, ICONSIAM Hall F7; **Scarlet Heart Thailand The Grand Premiere 4 Nov**, Union Hall vs the separate TV broadcast key visual; and **Khom Khlang WeTV × Star Hunter Siam Center Halloween exhibition 29 Oct through 1 Nov**, Siam Center G. Existing Core `KHOM KHLANG Special Episode 5` (5 Oct), Flex/PMCU `SIAM HALLOWEEN` (Siam Square), and Sept `HONAH LEE × AuAuSave` are different works and **must not suppress these date-specific leads**.

Native booking checks on these exact days: **19 Oct 0, 29 Oct 0, 30 Oct 0, 31 Oct 2/2 NCT, 1 Nov 2/2 NCT, 2 Nov 0, 4 Nov 0, 18 Nov 0**. No booking in bounded register is necessary but not sufficient for offering rental. **31 Oct and 1 Nov MUST NEVER REOPEN** unrelated events.

## 2. Root-cause proof vs hypothesis

**Code-observable root causes:** `ARTIST_AGENCY` source universe had generic DOMUNDI but lacked independently mandatory DMD MUSIC singles and specific weekly schedule receipts. Monthly/Smart queries lacked dedicated Gallery/IP Mall/Single Showcase taxonomies, and known-miss regression corpus did not include these positive misses. Existing Production runtime only blocked **fully** booked days for fresh leads, not **partly** booked days, contrary to owner's booking-day exclusivity. The TV key visual displayed by user is **not** evidence of a ticketed event: the official offline premiere is an independent ticketing identity.

**Not yet proven:** whether historic failure happened in scraping, search-provider retrieval, event-date parsing or Verifier. Exact live provider input/output and source receipts not recovered. Do not claim a forensic failure stage without such records.

## 3. Draft source fixes (no live writes)
1. `server/kk-ultra-deep-source-registry.js` V10: new independent, required first-party source receipt targets: `dmd-music-single-showcase`, `domundi-artist-weekly-schedule`, `fan-organised-anniversary-gallery`, `siam-center-we-tv-ip-activations`, `star-hunter-series-activation`. Tailored official-source queries in October, November, December. FULL must fail closed when missing a receipt.
2. `server/kk-monthly-deep-scan-query-plan.js` V14 / Smart V6: three dedicated taxonomies `MUSIC_SHOWCASE`, `FAN_PROJECT_GALLERY`, `MALL_IP_ACTIVATION` in both Smart and monthly, with bounded 3 monthly localized Smart variants, no paid provider activation.
3. `server/kk-ultra-deep-event-type-access.js` V1: classify `SINGLE_SHOWCASE`, `FAN_PROJECT_GALLERY`, `MALL_ACTIVATION`, `OFFLINE_PREMIERE`, `FANSIGN`, and `BROADCAST_ONLY`. TV-only posters always `NOT_OFFLINE_EVENT`, not an automatic sale. Sensitive in-person events require explicitly verified venue, original first-party event source URL, recording and detachable-lens rules with source proof and owner not-blocked. Community gallery/mall exhibition also requires confirmed artist attendance OR independent evidence that rental value exists **without** performer appearance. No assumption from portraits or public gallery entry.
4. Explicit date arrays need `event_dates_verified:true` to split into individual ISO event days; otherwise HOLD. `8/7` song title is not a date.
5. `server/kk-ultra-deep-production-runtime.js` V3: new-event classification before writer handoff, expanded verified multi-day dates, owner **any active booked day** blocks fresh unrelated events; existing canonical booking cards unaffected.
6. `server/kk-ultra-deep-v2-runtime-adapter.js` V5: new event types cannot pass commercial score directly into FULL_LOOP when access proof missing; `NO_CAPACITY` still precedes type/access reviews; existing canonical maintenance remains separate.
7. `server/kk-ultra-deep-known-miss-regression.js` V13: 9 exact-day fixture identities added to previous 32 => **41 historical known-miss cases**, including cross-month Gallery / Siam Center date receipts. No fixture claims live provider recall. `tests/kk-ultra-deep-event-type-access.test.js` tests source, month tiers, TV-vs-offline, 8/7, 1–2 Nov, partial/fully booked day, misidentification and missing rights; existing planner+known miss tests updated.

## 4. Release checklist (fail closed)

- [ ] Exact head SHA and GitHub CI (npm run check, 20-tier planner tests, runtime + V2 + 41 known-miss fixtures) **all pass**. Failure means not accepted.
- [ ] Independent code review; parent PR #769 and PR #772 must pass, apply sequentially only with owner approval. No ungoverned merge to main or production.
- [ ] **Live** independent unseeded read-only provider receipt for DMD MUSIC/DOMUNDI, FirstOne, Union Mall, AuAuSave fan organizer, Star Hunter, Siam Center, GMMTV/CHANGE2561; exact day/source-URL discovery before claiming repair.
- [ ] Evaluate organizer's copyright/artwork rights and photo/external lens restrictions, proof of performer on a gallery or mall activation; no artist assumed from advertising graphic.
- [ ] Exact-event competitor rental comps and governed fallback price, booking/owner LOCK and full show-date dedup. Do not invent pricing or copy ticket prices.
- [ ] Governed Admin writer only after safety approval; exact Core→WebReady→Production readback, recheck live booking immediately before publishing. Never directly edit generated `08_Web_Ready` or `09_Web_Packages`.
- [ ] Source/no-source receipt and terminal HOLD reason persisted by live runtime, not merely hardcoded regression fixture.

**Current scope:** safe code and regression preparation, with GitHub-only cross-chat evidence. **Do not claim production discovery is fixed or missed events are listed for rent until verified.** Historical 19 Oct event is not for retrospective sale.

See [Issue #773](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/773) and [October/November backlog #770](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/770).
