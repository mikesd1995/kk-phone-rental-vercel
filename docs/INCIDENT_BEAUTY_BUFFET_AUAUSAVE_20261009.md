# P0 Missed Opportunity — Beauty Buffet LIPTOK Event x AUAUSAVE (9 Oct 2026)

**Investigation date:** 10 October 2026 (Asia/Bangkok). **Classification:** P0 DISCOVERY/RECALL MISS, NOT A COMPLETED SCAN/PUBLISH REPAIR. **No production business write.**

## Exact event identity and primary evidence
- Event: **Beauty Buffet LIPTOK Event x AUAUSAVE / MHIIPRAEW**, Friday **2026-10-09**. Domundi / AuAuSave schedule lists **18:00**, G Floor **UNION MALL**, Union Co-Event Space Zone A. The public may cheer from around the venue, but access to the 70 privileged seats is controlled; do NOT conflate these with unrestricted crowd capacity.
- **Pre-event signal already existed 25 August 2026**, *45 days before the event*: indexed brand/social promo, `https://www.sina.cn/news/detail/5335886285244576.html` (copied influencer confirmation 25 Aug); first-party Beauty Buffet account campaign announcement and poster `https://www.lemon8-app.com/%40beautybuffet_th/7677921730569159176?region=th` (updated 25 August). Participants accrued campaign points **1–30 Sep**, winners announced 2 Oct, confirmed by 4 Oct. Brand listed **60 Lucky Fans + 10 Top Spenders**. This was an actionable discovery lead **weeks in advance**.
- Additional official/fan-schedule corroboration: `https://auausaveth.com/` October schedule, @DomundiTV publicly mirrored at `https://www.sotwe.com/domunditv?lang=en` and fanbase `https://www.sotwe.com/hashtag/AuauSave_Schedule?lang=en`.
- **User complaint is anchored to actual social post** `https://x.com/ZNNNUCH78/status/2108520507264073975?s=20`: 9 Oct 2026, fan @ZNNNUCH78 says many fans visited and references AUAUSAVE MHIIPRAEW at Union Mall G-floor Zone A. The live post extraction showed **approximately 29.3k views** at the time checked. Views are engagement, **not** unique onsite participants, renters or realized revenue.

## Connected source-of-truth reconciliation (READ ONLY)
- Tracker ID `1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo`: **no exact Beauty Buffet / LIPTOK / BeautyBuffetLiptokEventxAUAUSAVE 9 Oct** in `_Candidate_Queue` (~353 nonblank rows), monthly `ต.ค. 2569` (~75), `_Event_Lifecycle` (~138).
- Backend ID `12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`: **no exact event in `01_Events` or `08_Web_Ready`** (~323/324 rows), nor a corresponding `18_Event_Visibility_Locks` entry. **No booking for 2026-10-09** in `00_Master_Booking` (~52 booking records read). Therefore no evidence the Oct9 event was blocked by a booking date, or found then owner-hidden; exact root at source/provider ingestion vs rejection cannot be determined without per-source historical live receipts.
- Important positive control: scanner DID find **HONAH LEE EVERLIGHT x AuAu Save** at Union Mall G Floor Co-Event Space on **13 Sep**, and **MondayMoist x AuAu Save** on 11 Sep. Those exist in Candidate and some Core/Web (hidden after event). Same fandom and venue **were known**; October brand campaign was never made a candidate.
- Scanner `_Scan_Status` bounded tab last nonblank around 25 Aug, while October Candidate entries exist from newer channels; don't mistakenly claim no Oct scan from that one stale legacy status log alone.
- Production Vercel main sha at investigation source context `69390a94972b8c636317bbf00d62ab677c0cc66f`; prior October queue 8 FAILED/1 control-plane lifecycle COMPLETE, most recent Oct6 failures `BLOCKED_NO_VERIFIED_CANDIDATES`. Draft PR #680 full new source/runtime remains **not deployed**.

## Evidence-grounded root-cause assessment
1. **Confirmed ingest/reconciliation miss**: exact event is absent from Candidate/Monthly/Core/Web/Locks and no Oct9 booking. Current records do not show a Verifier rejection for *this event* specifically.
2. **Source planning blind spot**: generic `Beauty/personal-care artist campaigns`, `Domundi/Mandee`, `Union Mall` existed as broad required lanes, but there was **no named Beauty Buffet/LIPTOK/AuAuSave artist-schedule source** and **no Oct9 known-miss regression**. Earlier green deterministic fixture tests could pass without this event, and generic `NO_EVIDENCE` can be returned without matching the brand-specific announcement.
3. **Cross-month lead-time blind spot**: 25 Aug announcement of an Oct event, campaign collection September, public fan support October. Exact brand × artist/fandom × venue pivot missing before the final 48h.
4. **Runtime acceptance gap**: Production October full-loop queue attempts failed independently; there is no verified successful monthly exhaustive catch-up. No source-specific historical trace for this event: do **not** claim a particular provider, filter or ranking definitely discarded the exact post.

## Concrete corrections committed to Draft PR #680, no production promotion
- `server/kk-ultra-deep-source-registry.js` **V12**: required named lanes `beautybuffet-liptok-artist`, `auausave-schedule` (secondary calendar, corroborate official brand/Domundi), `unionmall-gfloor-brand-appearance`.
- `server/kk-monthly-deep-scan-query-plan.js` **V14**: exact artist/brand/date/hashtag queries, prior-month 25 Aug → Oct9 lead-time pivots, fanbase and Domundi schedule, public cheering/fanzone context.
- `server/kk-ultra-deep-known-miss-regression.js` **V16**: exact-date required case `beautybuffet-liptok-auausave-20261009` with source/alias and official brand evidence. A month-scoped live scan missing it fails the known-miss gate; a fixture alone does not certify it.
- `server/kk-ultra-deep-v2-learning-agent.js` **V10**: `BRAND_ARTIST_LUCKY_FAN_LEAD_TIME_GAP` triggers artist schedule, official social and previous-month beauty-brand campaigns. No KK internal bookings/revenue used in External Demand score.
- New regression tests assert exact Oct9 date, names/aliases, mandatory named sources, previous-month announcement query and no production writes.
- **Exact tested code/test SHA** `e0c63d08fb670987756ad017a5984d55e8a27a29`; Vercel Preview `dpl_HdbHLmHZckRjyBKBKo4jxQp31Ps7` **READY**, **143/143** combined Ultra Deep/Booking/Verifier/Checkpoint tests, **1/1** poster test, zero failures. Deterministic tests only: live October Production scan is NOT accepted.

## Immediate adjacent future opportunity — do not miss 11 October
- Official AuAuSave calendar `https://auausaveth.com/` lists **Skin Editor Famie Fest with AUAUSAVE / MHIIPRAEW, 2026-10-11 ~12:00**, Central Park Bangkok G Floor Parkside. Brand announcement requires independent official/photography confirmation.
- **Candidate exists already** in tracker `_Candidate_Queue`: `Skin Editor Famie Fest with AuAu & Save` **2026-10-11**, status `VERIFIED_HOLD`, note `OWNER_DAY_CLOSE_POLICY_REVIEW|CANDIDATE_ONLY|NEVER_AUTO_PUBLISH`. Also related trainees/TeeTeePor/EstWesley variants are held. No Oct11 booking was found in bounded Master Booking read. **Do not infer absence of booking is an owner approval**, or override explicit hidden/closed-day rule: resolve owner/eligibility/official poster and venue access before governed event publish. No storefront mutation was performed.
- For 9 Oct already past, **DO NOT recreate or publish the event retroactively**; it is an audit/learning item only. The missed revenue is unquantified; 29k views and 70 benefit seats are not rental bookings.

## Acceptance required before calling this resolved
1. Verify genuine live no-cost producer/artist/brand discovery on a next analogous event announced a month early (not just forced known-miss injection).
2. Per-source durable receipts, Date/venue/poster/access and known miss proof via actual OIDC-enabled October scan; October pipeline still Draft/unmerged as of this incident.
3. For 11 Oct adjacent event, reconcile current owner/date status, final official source, booking/venue photo permission, sufficient competitor prices and safe Core/Web/public readback. All writes owner-governed and separately authorized.
4. Track owner-visible **P0 missed-opportunity alert** when a known first-party event poster with artist/date is not in Candidate by T-7 / T-3; don't infer success from `NO_EVIDENCE` or Preview unit tests.

**Incident status:** `MISSING_EVENT_CONFIRMED` / `INGEST_GAP_IDENTIFIED` / `SOURCE_FIX_PREVIEW_TESTED` / `OCT9_EVENT_PASSED` / `OCT11_SIMILAR_HOLD_FOR_OWNER_AND_VERIFICATION` / `PRODUCTION_FULL_LOOP_NOT_PROVEN` / `PRODUCTION_WRITES=0`.
