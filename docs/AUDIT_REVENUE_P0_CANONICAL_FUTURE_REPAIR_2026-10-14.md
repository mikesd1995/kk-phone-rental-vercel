# KK Phone Rental — 2026-10-14 P0 Future Revenue Canonical Quote Repair

## Scope and authority
Read-only code change in a DRAFT branch. No Google Sheets writes, Booking status/price changes, LINE sends, Drive permission changes, GitHub Actions rerun, Vercel Preview or Production deployment. Never merge automatically.

## Verified initial problem
Production Vercel commit `d6dc3bfe4cc0c4dd6fdfec407823752da0572464` serves Rental Dashboard Core and optional private CRM analytics. Both codepaths incorrectly compute Future using `amount_received` (Master column O), although KK Phone Rental collects rental payment at physical handover and only counts completed receipts as Actual. Canonical booked quote is Master Booking column X. Core Dashboard Sheet displayed Actual 67,125, Future 29,660, Forecast 96,785 at the initial audit. A zero-cash, confirmed future booking must still contribute booked X value, not 0.

## Changes on this branch
- `server/rental-analytics-booked-quote.js`: strict read-only quote resolver. Parse canonical Master `A4:X`, validate header and X positive money, join active bookings by exact booking_id + event_id, verify status and package type; reject duplicate same-key IDs, missing data, nonpositive/malformed quotes and stale status/package. No cross-event reused-ID joining, customer names or phone numbers in response.
- `server/rental-dashboard-core.js`: fetch and reconcile live canonical Master before aggregate; Actual remains completed cash O; Future uses verified quote X in totals/months/events/affiliations. No cash fallback. HTTP 503 for quote-invariant failure.
- `server/legacy/kk-rental-dashboard-v5.js`: same evidence join for private CRM analytics path. `api/kk-rental-dashboard-v6.js` continues to enforce CRM freshness, reconciliation and fallback.
- `tests/dual-sheet-intelligence.test.js`: existing split tests now give active rows explicit quote X (including confirmed O=0).
- `tests/rental-analytics-booked-quote.test.js`: new exact join, buckets, quote, collision, duplicate, mismatch and exclusion regressions.

## Live read-only evidence (2026-10-14, Asia/Bangkok)
Owner Google Sheets (no edits): `00_Master_Booking!A4:X170` and `_Rental_Dashboard_Data!A1:O270`.
- Helper rows: 117; Master current rows: 58.
- Active helper: 26, all confirmed.
- Exact active quote joins: **26 / 26 OK**; no mismatches, missing canonical rows, duplicate identities or invalid quotes in bounded read.
- SUM verified Master column X active = **THB 29,660**, consistent with prior Google Sheets Dashboard Future.
- Active cash-received O sum from prior read = 0, consistent with no-deposit/at-handover policy.
- No PII in this document.

## Validation
- GitHub branch-source blob readback and JavaScript V8 compile of actual fetched source (isolated stubs).
- Executed the six authored new regression cases against fetched branch code in V8: **6 PASS / 0 FAIL**. This is **NOT** Node `node --test`, GitHub Actions, actual HTTP or browser acceptance.
- Initial separate smoke harness had a faulty collision assertion; corrected authored six tests pass; no source defect confirmed.
- Mandatory before release: exact-head hosted Node full tests/checks; verify runtime Gviz Master read authorization with no browser/log PII exposure; exact Core/CRM API vs Sheet frozen-date comparison; timeout and Vercel Hobby quota; status/duplicate/history checks; negative auth/PII; main merge approval; exact prod alias SHA/rollback readback.
- No free-tier spend, CI rerun spam, public price updates or changes to Booking/Customer state.

## Other P0 issues unaffected
- Drive Anyone Writer 35 active files + 4 folders: #718/#721. Reader grant does NOT revoke old Writer. Owner-permission correction still pending.
- NEW independently confirmed privacy P0 #738: owner-connected canonical Core Booking document permissions include `anyone/reader` (not discoverable). This workbook contains customer contact data. Restrict only AFTER migrating all public/Core readers to authorized private projections; no immediate ACL toggle that breaks storefront. Draft PR #737's Master read requires explicit privacy review before deployment.
- LINE production inbox media E2E and booking binding: #715/#700.
- Booking 17–18 Oct and price/package quote disagreements: #714. No auto-edit.
- Storefront posters + signed-out QA: #731/#713/#727. The 27-Nov FORTREASURE canonical image cell was blank on a fresh source read, despite issue #733 saying a 3-row write was complete; do not replace a 27-Nov benefit image with 29-Nov concert artwork without verifying exact event-day appropriateness.
- Ultra Deep/CI natural production acceptance: #49/#707/#732.
- This PR is NOT a complete repository-wide line-by-line audit.

## Reproduce when runner available
```bash
node --test tests/rental-analytics-booked-quote.test.js tests/dual-sheet-intelligence.test.js tests/rental-dashboard-event-date-fallback-20261002.test.js
npm run check
npm test
```

**Release decision: DRAFT / HOLD** until all above gates pass and owner signs off.

## Latest source/PR verification
- Draft PR: https://github.com/mikesd1995/kk-phone-rental-vercel/pull/737
- Last verified branch source head prior to this documentation commit: `42f09426a02735111639010d61386c66b388432b`; actual PR head changes when this note is committed.
- Money parser additionally rejects malformed comma grouping (for example `1,2`); six authored V8 exact-source regression cases re-ran **6/6**, with the stricter case added.
- Exact-head GitHub Checks currently `[]` (no reported statuses), not a PASS. Latest Vercel production still `d6dc3bfe`, no branch preview in latest listed deployments.

## New fail-closed helper duplicate contract (15 Oct 2026, source-only)
- Existing Master reconciliation rejects duplicated canonical booking_id+event_id, but previously allowed repeated ACTIVE Helper rows with one canonical match. Even with a valid quote, two Helper rows could inflate Future. Added a `seenActiveHelper` map check in `server/rental-analytics-booked-quote.js`; duplicate active booking+event identities now throw `RENTAL_ACTIVE_HELPER_DUPLICATE` before the Dashboard aggregation response. Identical booking IDs for **different events** are still valid. Excluded cancellation/no_show/blank rows remain excluded.
- Added two synthetic regressions in `tests/rental-analytics-booked-quote.test.js`: same active identity twice fails closed, different event identities use their individual quotes and excluded duplicate rows are not counted.
- All changes are in Draft PR #737 only. The Core Master quote reader on this older-base branch still uses **public GViz**. **DO NOT DEPLOY OR MERGE THIS REVENUE PATCH STANDALONE:** reconcile with Private Core Reader/security PR #739 on a single owner-approved release candidate and prove no public Core GViz reads in strict/private mode, 13/13 authorized private datasets, exact HEAD Node/CI, signed-out Core denial, revenue readback and rollback. Do not grant additional public visibility to get Revenue working.
- P0 #710 and #49 remain OPEN. No CRM/Booking/Price, ACL, customer, X/LINE or Production writes, no paid service use. No native Node/CI PASS is implied by V8 mocks.
