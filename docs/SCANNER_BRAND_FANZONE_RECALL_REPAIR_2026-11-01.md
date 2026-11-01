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
