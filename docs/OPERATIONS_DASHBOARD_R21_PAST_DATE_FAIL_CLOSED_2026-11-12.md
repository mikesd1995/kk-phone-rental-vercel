# KK Operations Dashboard R21 — fail-closed past-date availability

Date: 2026-11-12 Asia/Bangkok. Parent R20 exact SHA `93781fb10eeaa32512cb7a5bb66297343ecbe0a3`; isolated Draft PR #867; no merge or Production deployment.

## Real source finding, read-only
Bounded read of canonical Google Sheet `KK Phone rental backend` tabs `08_Web_Ready`, `09_Web_Packages`, `01_Events` and `18_Event_Visibility_Locks` on 2026-11-12 Asia/Bangkok:
- 124 records with `action_for_web=show`, including **45 historical event dates** preceding 2026-11-12. This is a source-data visibility flag, *not* proof those records appear on live Production storefront. The Dashboard previously did not exclude past dates when labeling a verified private source with positive phone/package stock as READY.
- All 124 SHOW events satisfy Core active_on_web according to this bounded check; zero positive-package-over-WebReady-phone-count discrepancies were observed. This does not waive private hosted UAT.
- 73 SHOW entries still have no matched Owner Lock ID, and 2 SHOW entries report zero phone stock (Dec 3/5 BTS). No source rows, locks, prices, bookings, posters or web visibility were modified.

## Code fix
`admin/operations-dashboard.js`: compute past-event eligibility from the normalized canonical event date and `bangkokToday(now)`. Keep historical events visible for audit, but set both phone and bundle readiness false even if a fresh verified private transport, matching Core, Owner Lock and positive packages otherwise pass. Record explicit `งานผ่านวันที่แล้ว` QA, `วันที่งานผ่านไปแล้ว` gate reason, and separate QA group `งานย้อนหลัง`.

`tests/operations-dashboard-readonly.test.js`: three regressions isolate positive stock with consistent Event ID/Core/Web Ready date, positive today/tomorrow controls, and the exact UTC 16:59→17:01 transition across midnight Bangkok time. No Production data or customer PII in tests.

## Release gates
New exact-HEAD targeted/full tests, Chromium eight-width synthetic browser and Preview are required after this commit. Independent human reviewer (not owner/AI self-review) and authenticated protected Admin private-source positive UAT/PII-wire checks remain unfulfilled on candidate branch; do not copy/decrypt Production credentials or bypass protection. Owner granted production release consent but has not produced substitute human review/test evidence. No further source writes, merge or Production deploy until release gates are verified. Cross-chat continuation: use PR #867 HEAD; do not revert to R17/R18/R19/R20 head by accident.