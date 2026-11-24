# KK Operations Dashboard R22 — active Booking semantics instead of historical false positives

Date: 2026-11-12 Asia/Bangkok. Parent source SHA `11c40165b30bf95b877111e8c5a6d36d02ad67a9`, existing isolated Draft PR #867. No Production merge/deploy or Business Sheet/Booking/Owner Lock/price/stock/X/secrets/ACL changes.

## Actual bounded source evidence (read-only)
Exact canonical `KK Phone rental backend`, `00_Master_Booking!C4:D250` and `08_Web_Ready!A4:J600`. Active statuses from Dashboard source: pending/confirmed/prepared/picked_up/returned/uploaded; cancelled/completed/closed/etc. are not active.
- 80 nonempty Booking rows across 47 event IDs.
- 124 SHOW Web Ready events: **20** with any Booking *history*, **8** with active Booking, **12** with only historical closed/cancelled Bookings. Therefore prior "มีบุกกิ้ง" filter using `bookingTotal` falsely grouped 12 closed-only events with currently booked events.
- One future SHOW event with closed-only history: `EVT-20261207-WILLIAM-EST-REIGN-TOGETHER-C`. This is NOT proof the date is rentable: independent Owner Lock and availability gates still apply.

## Surgical fix and normalized domain contract
- Preserve `bookings` = verified **active** count or null when unverified; preserve `bookingTotal` = **all historical** Booking records or null. No new data fields, API, or PII exposure.
- A single pure `bookingFilterMatches()` drives the 'มี/ไม่มีบุกกิ้งที่ยังใช้งาน/ต้องตรวจ' UI filter. No booking source/integrity unknown may be classified as zero.
- Table now explicitly displays active count; Details show active count and historical total separately. QA 'ไม่พบบุกกิ้งที่ยังใช้งาน' is emitted for future events only when Booking is verified and active count is zero, not on null/unknown states.
- Unit tests cover cancelled vs confirmed and bad source identity. Existing eight-width synthetic-only Chromium fixture now has one confirmed, one cancelled historical, one never booked event; browser tests the three filter states at every viewport. No live customer fields in fixture or screenshots.
- Full exact-HEAD CI, Chromium and new exact-source Preview still required after commit before claiming engineering pass.

## Inherited release restrictions
- Owner previously authorized Production release, but independent genuine human reviewer is still absent; signed Admin private-source hosted UAT unresolved (Preview env scoped secrets not configured on branch); 73 missing SHOW Owner Lock evidence, 4 placeholder posters, 2 zero-phone SHOW events unresolved. Release HOLD. Never invent independent approval, clone Production secrets, weaken Vercel protection, modify canonical Business data, or claim Preview equals Production.
- Continue on PR #867 exact head and check drift before merge.