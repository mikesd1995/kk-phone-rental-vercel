# KK Ultra Deep October 2026 — Brand + Artist Schedule Recall Recovery

**Recorded:** 2026-10-09 (Asia/Bangkok)  
**Authority:** read-only external-source and canonical backend/Event Tracker reconciliation; source-only changes on draft PR; no scanner/scheduler/booking/price/storefront production writes.  
**Run classification:** `PARTIAL_MANUAL_RECON`, **not** `FULL_SCAN_COMPLETE`, `PROD_ACCEPTED` or automated V27 acceptance.

## Confirmed new discovery gaps, not commercial approvals

| Event-date identity | Evidence | October canonical state when read | Classification |
| --- | --- | --- | --- |
| 2026-10-21 HER HYNESS × Lingling Kwong — Unlock The Ultimate Protection | Brand campaign: https://www.herhynessbeauty.com/blogs/blog-the-clean-side/her-hyness-x-lingling-kwong-unlock-the-ultimate-protection-campaign ; Oct21 venue/date artist calendar https://www.lingorm.site/upcoming-schedule ; indexed brand X post corroborates date and centralwOrld | No exact match in `_Candidate_Queue`, `08_Web_Ready` or October monthly tracker | `DISCOVERY_MISS / VERIFY_MORE`; Top/Lucky Fan entry eligibility and equipment/photo access not qualified |
| 2026-10-23 Cathy Doll × Orm Kornnaphat — The Mission Love Party | Secondary artist calendar: https://www.lingorm.site/upcoming-schedule ; reports Asiatique location, no verified public primary official post | No exact match in `_Candidate_Queue`, `08_Web_Ready` or monthly tracker | `DISCOVERY_LEAD / PRIMARY_SOURCE_PENDING / NO_CAPACITY`. Oct23 two LYKN phone bookings consume 2/2 phones |
| 2026-10-25 NARS × TeeTeePor | Secondary TeeTeePor calendar https://sites.google.com/view/porteetee-octomarchchronicles/schedule | No exact match in `_Candidate_Queue`, `08_Web_Ready` or monthly tracker | `DISCOVERY_LEAD / PRIMARY_SOURCE_PENDING`; no public commercial qualification |

**Avoid false misses:** Oct16 WEIRDO-101 Final EP is already `show` in `08_Web_Ready`; Oct28 Benton × TeeTeePor is already `show`; Oct24 SING INFINITY already exists at Candidate row316 and must be source verified, not duplicated; Oct25 ONE OR EIGHT already exists in monthly tracker and Web Ready as `hide`; Oct30-31 SIAM HALLOWEEN already has Candidate rows. Do not recreate or republish any of these by title.

## Additional read-only reconciliation

- `00_Master_Booking` confirms 18 Oct OH MY FOURTH booked 2/2, 23 Oct LYKN booked 2/2, 24 Oct LYKN 1/2 booked, 31 Oct NCT127 booked 2/2, and 10 Oct REMASTER booking cancelled at read time. Oct18, Oct23, Oct31 feed `show_full`; Oct10 has non-REMASTER shows `show` despite older owner exception rule, so check latest visibility-authority before changing it.
- Competitor `_Competitor_Price_Current` October matching rows were last checked in September with several stale `FRESH` labels; cannot use those to claim a current median. Fresh exact-event comparable bundles (same device + lens) are not sufficiently corroborated; no repricing.
- In Issue #672 and Event Tracker row 318+ previous recovered Oct misses remain `VERIFIED_HOLD`; booking-lock and owner tombstones still govern.
- Source Registry V8 and Query Plan V11 did not explicitly require HER HYNESS/Cathy Doll/NARS lanes and these daily fan calendars. This branch adds explicit required discovery source identities, targeted October query terms, and dated known-miss regression tests. Public fan calendars are **secondary discovery leads, never date/venue, access or publication authority by themselves**.

## Source-only patch scope

1. `server/kk-ultra-deep-source-registry.js` — five required source receipts for LingOrm and TeeTeePor calendars plus HER HYNESS, Cathy Doll and NARS.
2. `server/kk-monthly-deep-scan-query-plan.js` — V12 new targeted brand, Top/Lucky Fan, visual/schedule expansion.
3. `server/kk-ultra-deep-known-miss-regression.js` — V12 three exact event/day recall fixtures with secondary-vs-brand source boundaries.
4. `tests/kk-ultra-deep-known-miss-regression.test.js` and `tests/kk-ultra-deep-source-registry.test.js` — new tests for dated known misses, evidence URL, required source receipts and search query coverage.

## Required next acceptance, no shortcuts

1. Run `node --test tests/kk-ultra-deep-known-miss-regression.test.js tests/kk-ultra-deep-source-registry.test.js` on the exact branch head. **No executable test result was produced in this connector-only fix session**; do not imply pass before runtime results. Check existing CI budget; no paid minutes or repeated quota-exhausted reruns.
2. Independent code diff review (no accidental broadening of publish authorization), then source test/Verifier acceptance. Draft PR remains unmerged until the normal required gates are met.
3. Obtain primary Cathy Doll/NARS event/day identity and public filming/access conditions, official poster, latest exact-event rental competitors, external-only demand evidence. Record manual Candidate entries only through authorized discovery intake (no direct derived sheet writes).
4. Confirm current Oct10 owner visibility policy, Oct23/31 full-stock and Oct18 full-stock from canonical rows immediately before any business action. **Never auto-reopen suppressed events.**
5. Collect source-universe receipts for the full month, run one governed October `READ_ONLY_ACCEPTANCE` with Verifier and `production_writes=0`. Scan is not FULL until this passes.
6. Only after all gates, a separate explicit production writer authorization with exact Core, derived Web Ready, and public storefront readback; never bypass Auth/Admin for direct Sheet mutations.
7. No paid top-up, no new scanner/scheduler, no X auto-publish and no unattended booking approval.

## Long-lived cross-chat continuation

Canonical context: GitHub Issue #672 (October misses), Issue #651 (external-only score), Issue #368 (runtime activation). Latest doc is **source-recovery proposal**, not proof of production runtime activation. The answer to “เสร็จหรือยัง?” remains **no** until FULL and readback are independently demonstrated.
