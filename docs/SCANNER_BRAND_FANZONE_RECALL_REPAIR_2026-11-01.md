# KK Phone Rental — P0 Brand / Fan Zone Ultra Deep Recall Repair

Last inspected: 2026-11-01 (Asia/Bangkok). Owner request: implement in order without approval loops, no extra spending, immutable bookings and tombstones, fail-closed production.

**Execution status: CODE REPAIR STAGED IN DRAFT PR #827; NOT DEPLOYED.**
Incident #826: iQIYI iJOY Nov5. Incident #828: Ongredients × EVEANDBOY Nov21 + 29 November public lead candidates. This is a source-recall fix, **not a storefront publication or a monthly FULL acceptance claim**.

## Root causes confirmed with exact source inspection
1. A source-registry coverage gap: no dedicated iQIYI and brand-retailer / ambassador families. Previous registry included `iconsiam-hall` but the runtime-backed `_Direct_Source_Map` was not reconciled with it. Pre-existing `_Run_Coverage` historical reads did not establish a per-source run for Oct23–30.
2. Daily SMART_OPERATIONAL used one broad first query per tier and allowed early termination on generic evidence. It did not guarantee brand+retail named source attempts or cross-month registrations. The BRAND_MALL family was conflated with ticket sales.
3. The downstream reference identity filter excluded dated iJOY/FAN ZONE and brand ambassador/lucky fan announcements before verification.
4. Known-miss corpus omitted iJOY and November beauty-brand sources. Synthetic fixture pass alone is NOT unseeded real-world recall.
5. External Exa provider's 402 quota exhaustion can cause provider failure; do not buy capacity, hide the issue, or count a failed attempt as `NO_EVIDENCE`.

## Code changes in Draft PR #827
- `kk-ultra-deep-source-registry.js` adds iQIYI, EVEANDBOY, BEAUTRIUM, retail-partner and generic brand ambassador/fan-invite families as mandatory source IDs. A `direct_url` is a declared source to visit, **not** an executed visit.
- `kk-monthly-deep-scan-query-plan.js` preserves each source's source-specific `query_variants` and `direct_url` through the full-month planner, avoiding the prior one-query-only source universe. Daily SMART_OPERATIONAL adds three bounded mandatory evidence tasks for brand ambassadors, buy/register/win flows and mall artist boards, and one iQIYI source task. All reference the month and next month; all use only credential-free OFFICIAL_DIRECT/BING_RSS/DDG_HTML/BING_HTML entries. Do not interpret allowed provider identifiers as a guarantee they are bound or actually executed.
- `kk-ultra-deep-known-miss-regression.js`: includes exact Nov5 iQIYI, Nov6 BEAUTRIUM, Nov10 JOURNAL × FOURTH, Nov21 Ongredients × ThomasKong, and Nov21 Dr.PONG × Zee Pruk, with `discovery_months:['2026-10']`.
- `kk-ultra-deep-runtime-runner.js`: recognizes dated Fan Zone, iJOY, Brand Ambassador, Lucky Fans, Top Spender and artist appearances as *possible* reference identities without admitting undated or generic VIP subscriptions/product promotions.
- Tests enforce required source fail-closed, cross-month lookahead, exact event date+source proof, wrong-month/missing-date negative cases, source query variants and marketplace-irrelevant identity exclusions. Existing fixture-count assertions updated to preserve deterministic cases.

## Grounded current lead and risk
**Ongredients × EVEANDBOY — Enter the true Ongredients** with ThomasKong, event **Nov21 2026**, winners Nov17, 40 Lucky Fans. **Correct venue:** EVEANDBOY The Underground, Siam Square One, LG, Bangkok; official-account mirror https://teapawt.org/EVEANDBOY . The owner poster does not itself print this venue; the owner and secondary official-post evidence are distinct. **Nov21 confirmed CAT EXPO two bookings, Web Ready shared available phones = zero**. Never create a purchasable iJOY/Ongredients event on a booked date or duplicate locked entries. No validated organizer permission for detachable 200mm lens. No certified independent 3-seller exact-event/phone/lens price median. Do not invent a price.

**BEAUTRIUM** Nov6 15th anniversary / Siam Square is the other major missed brand event; requires official poster lineup + real source proof and rights. **JOURNAL × FOURTH** Nov10 registered in Oct; **Dr.PONG × Zee** Nov21 is private 50 lucky fans and shared stock zero. The November lead ledger has **29 candidates**, not 29 bookable shows, and the 30-day audit shows leads on 17 days; it explicitly says PARTIAL, not FULL.

## Native evidence links
- [29 lead staging rows (not Core)](https://docs.google.com/spreadsheets/d/1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo/edit#gid=1926103051)
- [30-day November row/date comparison](https://docs.google.com/spreadsheets/d/1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo/edit#gid=1926103052)
- [8 proposed Source Map entries: NOT authoritative](https://docs.google.com/spreadsheets/d/1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo/edit#gid=1926110101)
- [Ongredients P0 Miss Learning OPEN_REPAIR](https://docs.google.com/spreadsheets/d/1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo/edit#gid=740790233&range=A39:M39)
- [iQIYI P0 Miss Learning OPEN_REPAIR](https://docs.google.com/spreadsheets/d/1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo/edit#gid=740790233&range=A38:M38)

## Acceptance gates, in dependency order
1. Current exact policy, GitHub main/head SHA, task ownership/lease, active scanner/backing project and environment (no secrets exposed), latest `_Policy_Registry`, `_Run_Manifest` and `_Run_Lock` must be re-read. **One Scanner runner and one POLICY_VERSION**. If ownership or mode unknown, do not run multiple jobs.
2. Exact-head GitHub Actions: `Ultra Deep V2 Acceptance`, syntax, focused/full relevant regressions, independent review, no new expenses. CI pass is source-level only.
3. Stage reviewed Source Map rows from the nonauthoritative staging tab into _Direct_Source_Map **only via governed Scanner writer** with exact lease/fencing, manifest and readback. Source names and URLs in the code are not proof of runtime wiring.
4. For each critical family (iQIYI, EVEANDBOY, BEAUTRIUM, actual cosmetics brands, retail store schedules, EVEANDBOY cross-promotion, competitor reverse listings) acquire per-source **observed-at** and provider attempts, including a failed/empty state if appropriate. **Do not count a query plan, an indexed URL, source registry task, or 402 error as a scanned source.**
5. Live *unseeded* day-and-month discovery against actual original organizer text AND images. Extract event date separately from buying window and year in edition title; reconcile exact (artist, date, venue, organizer, official URL) and de-duplicate parent/sub-event.
6. Verifier independently corroborates event date/venue/access and original poster; optional images/media are a **coverage debt** if unread. Compute date-wide physical inventory from bookings and owner-hidden tombstones before listing; no oversell.
7. Pricing: >=3 independent shops with same show/day/device/200mm package for certified median; else verified check-in through final benefit under owner approved time rule. No revision to existing customer contract.
8. Production write requires separate Admin/createEvent authorization and transaction gates (no stealth Core edits), followed by exact `01_Events`, `08_Web_Ready`, `09_Web_Packages`, live `/api/kk-data`, web image and button readback. Only then may scanner or incident state become `LEARNED`/`COMPLETE`.

## Guaranteed limits of this artifact
No bookings, contacts, Owner Locks, customer records, production pricing, external credentials, machine schedule, deployment, merge, external credit purchase, or live Product Feed have been changed by this code branch. The only spreadsheet writes so far are inert audit/source staging and correction of Ongredients venue + citation in existing **staging audit** and `_Miss_Learning` (still OPEN_REPAIR). Draft PR #827 remains the release candidate, not an active production fix.

## Next run checklist / cross-chat continuation
Find Draft PR #827 and Issues #826/#828 first; inspect its exact HEAD CI. Read staging Source Map gid=1926110101. Reconcile with actual `_Direct_Source_Map` without blindly copying stale/social mirrors. Check Scanner/Verifier healthy live receipts and case coverage for 5 fixed misses. Prioritize November 6 BEAUTRIUM, November 10 JOURNAL, November 21 Ongredients and Dr.PONG, but use shared inventory and owner locks; do not create commercial bookings for November21 with 0 phones. When external Exa remains 402, use existing no-fee provider routes if genuinely available and mark PARTIAL instead of funding provider.

## 2026-11-01 implementation addendum — mandatory operational readiness
Deeper inspection found a deterministic acceptance flaw: `runOperationalDiscovery()` returned `READY_FOR_VERIFIER` with any broad-query evidence and >=3 source attempts, **ignoring** `required:true` on the new iQIYI/retail brand sources. The branch now requires every required operational source to have a genuinely executed provider attempt and no truncated/dropped candidate indication. A failure emits `HOLD_FOR_OPERATIONAL_DISCOVERY`, blocker `OPERATIONAL_REQUIRED_SOURCE_COVERAGE_MISSING`, counts and exact missing source IDs. A broad-only regression must hold, while valid free BING_RSS attempts allow the operational gate to proceed. The new operational test still does not certify event discovery or first-party media reading.

**CI before this docs addendum**: GitHub Actions Ultra Deep V2 Acceptance for exact code HEAD `d7557079339ea00c5f2639ae0d9fc375d5e47e54`, run `41306494642`, completed **SUCCESS** including syntax, focused regression, detail/identity diagnostics and known-miss recall. All source changes remain Draft/unmerged/un-deployed. This workflow does NOT certify complete `npm test`, live Scanner, browser, media capture, _Direct_Source_Map write or full Production acceptance.

**Source/map status**: 8 prospective sources, three of which are generic source-family search routes rather than actual official profiles, recorded at [source-map staging gid=1926110101](https://docs.google.com/spreadsheets/d/1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo/edit#gid=1926110101). Nothing was written to authoritative `_Direct_Source_Map`; its Scanner lease/fencing and `_Run_Coverage` run receipts require a governed runtime.

**Audit correction**: earlier limited _Run_Coverage reading through row 2200 had appeared to end at Sep8. A broader exact read of `_Run_Coverage!A4000:J6500` showed historical entries through **row4592, dated 2026-10-10**, but **zero populated rows after 4592** in that range. `_Run_Manifest` has existing Oct7-Nov reconciliation entries, but neither shows a current Nov1 per-source official scan. The previous conclusion 'latest coverage Sep8' was based on a partial range and must NOT be repeated. Missing latest coverage is still a gap, NOT proof an entire scanner never ran.

**2026-11-01 current booking check**: on Nov21 CAT EXPO `show_full` with `available_phone_count=0` and **2 confirmed bookings**; four other hidden shows remain unchanged. No photo/lens access proof for Ongredients, no authorized booking mutation, no storefront opening.

**Verified venue correction** for Ongredients was written and reread in *staging lead row14* and `_Miss_Learning!A39:M39` with organizer EVEANDBOY repost source https://teapawt.org/EVEANDBOY . It remains `OPEN_REPAIR`.

## 2026-11-02 source-proof hardening and cross-chat continuation

Owner explicitly instructed continue in order, fail over on first attempt, no added cost and report factual readback. Examined Draft #827 and Draft #831 exact HEAD. Both remain **DRAFT, not merged or deployed**; PR #831 Booking E2E and Storefront Automated Visual QA were SUCCESS at examined HEAD `1c31c2f4923d0c47b65d5f38f4b0e6b421bcca64`, but backend still has BTS 3/5 Dec zero phone + one lens wrongly `show / เปิดจอง` due old GAS formulas. **No production correction has been performed.** Do not claim storefront safe.

### Additional deterministic failure and fix in Draft #827
Before this patch, `SourceRegistry.buildUniversePlan` carried `direct_url` for iQIYI, EVEANDBOY, BEAUTRIUM, and ICONSIAM **but never included `OFFICIAL_DIRECT` in its providers**. Therefore an indexed Bing/DDG result could count as evidence that an official first-party source had been checked, without visiting its direct URL.

The additional code hardening:
1. All mandatory source records with an explicit direct URL now plan a single real `OFFICIAL_DIRECT` provider attempt followed by bounded indexed aliases for the current month. `EXECUTE_AND_RECORD_RECEIPT` source tasks still check all bounded search aliases after a direct homepage hit, so a generic first-party homepage cannot mask a later lucky-fan announcement.
2. `executeGapTask` calls a first-party URL **once** (not once per campaign alias) and preserves direct errors as `PROVIDER_ERROR`. A first-party `HTTP_403` plus Bing evidence must NOT pass the official-source proof.
3. `runMonthlyUltraDeep` source receipts and `runOperationalDiscovery` required-source readiness both demand an `OFFICIAL_DIRECT` attempt with `EVIDENCE_FOUND` or `NO_EVIDENCE` for required tasks carrying `direct_url`. A search-only source becomes `DIRECT_SOURCE_NOT_VERIFIED`, `executed:false`, and FULL/operational readiness fail closed. An official 200 returning no relevant event is only proof the page was fetched, *not* proof all its text/multicard media were read, that the event was verified or that any booking can be opened.
4. Tests cover (a) direct URL once plus remaining alias search, (b) direct failure not laundered by Bing fallback, (c) source-universe missing first-party receipt, (d) operational HOLD on Bing-only evidence, and (e) required official-source provider lists exclude **paid Exa**. Existing optional unrelated providers remain governed by their own prior policy; no Exa requests or paid services were invoked during this turn.
5. Latest code fixes are in the **same Draft PR #827** and do not alter main/Production. An initial CI run failed due a `task is not defined` local destructuring bug, fixed; next CI failed because a negative test fixture inadvertently included a direct provider, fixed. The recovered exact HEAD `cfbfe276ce5668de504e70f78df205e3a6b59dd1` passed Ultra Deep V2 Acceptance run `41391507242`. **Later HEAD contains the no-Exa provider restriction and updated tests; exact latest HEAD CI must be rechecked before approval.**
6. All existing owner-hide tombstones, bookings, package prices, poster assets, credentials, canonical `_Direct_Source_Map`, machine leases, service scheduler, and production runtime remain unchanged.

### 2026-11-02 runtime / data exact checks
- Tracker `_Run_Coverage!A4550:J4850`: 43 populated records in the range, last visible record **2026-10-10**. This is bounded evidence, not proof *no* other scanner ran. Current 1–2 Nov official-source receipts and live unseeded case recall were not established.
- Tracker authoritative `_Direct_Source_Map!A1:L120` **zero matching records** for iQIYI, ICONSIAM, Ongredients, EVEANDBOY, BEAUTRIUM. Staging `UDS_20261101_SourceMap_Gate` has 10 proposed records including 3 synthetic/family query routes. Do **not** bulk-copy query families as fake direct official URLs; use authorized Scanner Writer with live lease/fencing, exact readback and single POLICY_VERSION.
- Backend `08_Web_Ready` exact BTS 03/05 Dec `phones=0, lens=1, action=show, status=เปิดจอง`, with 2 confirmed bookings on each date. PR #831 has draft code+tests only; zero actual production/failure correction. Customer transactions immutable.
- Controlled status: both iQIYI #826 and Ongredients #828 remain **OPEN_REPAIR**, and November public-source 29-lead audit is **PARTIAL** not FULL. December 61-row inventory preflight gid `1926110191` is read-only and not a December Ultra Deep completion certificate.
- Production alias and authoritative Core promotions must not be touched before independent review, canonical source map and booking repair gates, real source receipts and independent unseeded live-case checks, visual storefront+API readback. No merge, deployment, new spend, credentials, customer, owner lock, or booking writes.

### Next-action sequence
1. Verify the exact latest #827 HEAD/source-only CI and independent review; verify #831 booking/visual checks AND Apps Script deployed-code exact SHA/readback. Do not substitute synthetic tests for live acceptance.
2. Use the single authorized Scanner runtime owner with valid lock/fencing to upsert actual *verified direct official* brand/retailer/venue URLs into canonical _Direct_Source_Map. Separately track generic discovery families as query plans, not fake sources.
3. Acquire per-source executable attempt status for iQIYI/EVEANDBOY/BEAUTRIUM/ICONSIAM and exact official media; catch up actual November dates unseeded, including Ongredients 21 Nov, BEAUTRIUM 6 Nov, JOURNAL Fourth 10 Nov and Dr.PONG 21 Nov. If social endpoints block, fail closed and explicitly report that gap, never forge a receipt.
4. Independently resolve photo/detachable lens rights, 3-seller exact-event comparable market price or verified event duration, owner-lock precedence, physical date-wide 2-device stock. November 21 CAT EXPO has two confirmed reservations, no bookable phones; preserve it.
5. Only after verified end-to-end safety gates, approve merge/deploy and live API+visual acceptance; close P0 if genuinely proven. December new releases blocked by confirmed booking mismatch for BTS 3/5 until PR #831 source patch is safely deployed and formulas/data read back.
