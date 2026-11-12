# KK Operations Dashboard R23 — identifiable Booking rows with blank status/event require HOLD

Date: 12 Nov 2026 Asia/Bangkok. Parent exact SHA `1f29393dfbc45ba162348107c7fadb3f13c0c3d7`; Draft PR #867, isolated source-only. No Production merge/deployment, Google Sheet edit, Owner Lock/Booking/Stock/Price/X/Secrets/ACL mutation.

## Bounded read of canonical source, PII-safe
Google Sheet `KK Phone rental backend`, tab `00_Master_Booking!A4:D200` (exact header `booking_id,created_at,booking_status,event_id`), read-only. There are **84 nonempty data rows**, including **four rows** at Sheet row numbers **5, 6, 17, 21** with a nonempty **booking-like ID** (length 15, alphanumeric, booking-style prefix) but **both status and event_id blank**. No actual Booking IDs, names, phone numbers, contacts or payment data are reproduced here. These are potentially incomplete Booking records and cannot be presumed to be cancelled or harmless ancillary notes without owner source verification.

## Safety defect (R20/R22 prior implementation)
`admin/operations-dashboard.js` previously considered an orphan row potentially active only if `booking_status` was an active or unrecognized *nonblank* value. A Booking row with a nonempty `booking_id`, empty `booking_status` and no `event_id` bypassed the unassigned booking gate. It could coexist with a positive-stock, otherwise verified event marked READY despite unaccounted Booking identity.

## R23 correction
- Classify an **identified, blank-status** Booking as possibly active until verified; if no valid Core + Web Ready match, set existing global `unassignedActiveBooking` HOLD, suppress all verified booking counts and phone/bundle readiness, preserve audit-only stock values and include explicit Booking QA.
- Preserve no-spurious-HOLD behavior for **fully blank ancillary rows** and unassigned **known completed/cancelled** historical records. Unknown status with valid event_id still fails *local* Booking integrity without an unnecessary global HOLD.
- Replace old unit fixture erroneously treating a nonempty Booking ID with blank status as a harmless ancillary row. Add three cases: real-risk exact pattern, blank/closed positive controls, and event-linked blank status. No new external API or read/write permissions.
- Re-run exact-HEAD full Node suite, 8-width Chromium, PII synthetic integration, CI and Preview checks on new SHA before engineering claim.

## Release
Owner authorized all operations, but human independent reviewer approval and protected real signed Admin positive private-source UAT **have not been observed**; Preview scoped environment does not have the secrets needed for such UAT. The R23 bug is fixed in Draft, **not on Production**. Existing issues 73 SHOW missing Owner Lock evidence, four placeholder posters and two zero-stock SHOW dates remain for authorized source validation. Fail closed and do not misreport a waived or completed gate; document any waiver explicitly if formal owner release policy is changed.
