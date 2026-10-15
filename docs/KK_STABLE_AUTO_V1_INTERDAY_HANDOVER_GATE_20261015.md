# Stable Auto V1 — Booking Interday Handover Safety (15 October 2026 ICT)

Status: **STAGED SOURCE ONLY / NOT DEPLOYED / RELEASE HOLD**.

## Implemented on canonical Draft PR #744
- New `server/kk-booking-handover-safety.js` read-only audit of the already assembled Admin booking snapshot. No remote network, no payment, no asset allocation, no customer/booking mutation.
- Integrated `booking_handover_safety_shadow` aggregate-only field in `server/admin-sheet-fallback.js`. Warning counts only, with NO customer names, Booking IDs, phone numbers or raw asset identifiers.
- New `tests/kk-booking-handover-safety.test.js` tests ISO, Thai Buddhist and numeric Excel event dates, handovers, same-day duplicates, missing assets/times, owner review and privacy; add `npm run test:booking:handover`. Existing `npm test` already discovers new `tests/*.test.js`.
- Exact locally tested Git blob SHA **source** `9bed6c1b705cbf0386683ea52e96ceb552536f01`, **tests** `d0f9bd680c2a9f623b1c5e4c3dd822c7b6b7fb29`. Both verified identical when uploaded as immutable Git blobs.
- Executed Node.js **v22.16.0** locally: **11/11 tests PASS** (zero npm installs, zero external requests). This is a genuine focused native Node test of these newly authored standalone files. **Not** a full repo Node 20 acceptance, not a rendered Admin QA or a Production E2E.

## Current business SOT (bounded authenticated read, no writes)
Core Master Oct 17 confirmed rows 60/63, Oct 18 rows 52/58; the same two phone assets booked both days, all four without pickup or return time. This indicates **handover not proven**, NOT a proven actual collision. Oct 18 also uses Lens packages. Never guess missing times, reassign assets, or send automated messages to customers.

## Acceptance constraints
- This new field is a **shadow advisory**, not a write-path authorization gate. Even `NO_OBSERVED_BLOCKER` cannot authorize customer notification, Booking write, device allocation, or unsupervised dispatch.
- For repeated adjacent-day asset IDs, complete pickup and return times still lead to `OWNER_REVIEW_REQUIRED`, never automatic approval.
- Real cross-date scheduling, transfer and device cleaning require owner/customer confirmation and lock readback in Canonical Core before enabling automated dispatch.
- Keep private Core Reader 13/13 authenticated owner deployment, Google Sheets Anyone Reader cutover, Drive artwork Anyone Writer fixes, Apps Script 9.5.13 E2E, LINE durable delivery, CI and Production owner acceptance blocked until separately proven. No Merge, Deploy, ACL changes, customer data writes, LINE sends, Make/Scanner changes, X posts or additional spending.
- Central release check and cross-chat checkpoint: [Issue #49](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/49), booking [Issue #714](https://github.com/mikesd1995/kk-phone-rental-vercel/issues/714), [PR #744](https://github.com/mikesd1995/kk-phone-rental-vercel/pull/744).

## Additional fail-closed audit refinement
- Pending bookings that already claim a phone asset are included in same-day allocation risk; unallocated pending requests remain outside allocated-device analysis.
- Invalid, empty or malformed date-window filters block instead of misleadingly reporting NO_OBSERVED_BLOCKER.
- Re-ran exact authored stand-alone Node v22.16.0 source/tests: **11/11 PASS**; 2 additional regressions. Still only a read-only advisory, NOT authorized live dispatch.

## Focus-date interday false-green fixed (2026-10-15, source-only)

**Additional rooted P0 flaw:** Before this commit, `audit(bookings,{focusDates:['2026-10-18']})` discarded Oct 17 records *before* checking whether the same physical phone is booked Oct 17 and Oct 18. With otherwise valid local times it could report `NO_OBSERVED_BLOCKER` for Oct 18 despite an actual adjacent-day asset reuse needing owner review, or miss a prior-day missing return.

**Remediation:** Keep neighboring ACTIVE and assigned-PENDING records solely for adjacent-day reuse analysis. Existing `active_checked`, missing pickup/return counters and same-day duplicate metrics remain restricted to the requested day. A repeated phone across a selected day boundary returns `BLOCKED` if upstream return/next pickup is absent, else `OWNER_REVIEW_REQUIRED`, never automatic allocation. A duplicate context record cannot hide a missing return/pickup. Unrelated outside-window adjacent bookings do not pollute scoped reporting.

**Native Node v22.16.0 exact blob evidence:** re-ran all original 11 + 4 added `tests/kk-booking-handover-safety.test.js` cases: **15/15 PASS, 0 FAIL**, without network calls or npm installs. Source blob `0c53f0d098b4d83e37c8fa1971026334fb3c5adb`; tests blob `5d35d57cca6327973e820da67bdd19694030458f`. Both immutable Git blobs exactly match local files run under Node; source code and test run are **not** a full-repository or hosted exact-head CI pass.

**Remaining HOLD:** Admin Snapshot warning is read-only and does not gate the actual Booking writer. Physical return, actual handover feasibility, Owner signoff, cross-date allocations, authenticated Apps Script/LINE delivery, private 13/13 Core, Drive ACL, exact-head native CI and Production rollout still require separate evidence. No Production/Booking/LINE/ACL/Make/Scanner/X actions authorized or performed.
