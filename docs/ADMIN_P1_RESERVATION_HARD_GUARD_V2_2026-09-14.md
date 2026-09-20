# Admin P1 Reservation Window + Hard Collision Guard v2 — 2026-09-14

## Objective
Prevent booking writes from reaching Apps Script when a fresh production snapshot shows that the proposed booking would exceed physical capacity or collide with a manually selected Asset during the reservation window.

## Architecture
Browser `/api/kk-admin` -> Vercel rewrite -> `api/kk-admin-guard.js` -> fresh read-only Apps Script snapshot -> `admin/reservation-guard.js` preflight -> existing `api/kk-admin.js` -> live Apps Script write.

The existing Admin proxy remains unchanged. The wrapper delegates every non-booking action unchanged and only intercepts `createBooking` and `updateBooking`.

## Reservation window policy
- Source date: booking `event_date`.
- `pickup_time` is optional/TBD because customers may not know the exact pickup time when booking.
- Start: explicit `pickup_time` when present; otherwise 00:00 Bangkok time on the event day.
- `return_time` is optional because event end times vary; when absent, reservation remains conservative through 06:00 Bangkok time on the next day.
- Explicit `return_time`: same-day return when later than pickup; next-day return when return clock time is earlier/equal to pickup.
- Missing `return_time`: conservative fallback through 06:00 Bangkok time on the next day.
- `picked_up` with no return evidence: treated as open-ended until workflow status changes.

The current live Admin snapshot does not expose persisted `return_time`; therefore normal Admin-created bookings use the conservative fallback. The guard deliberately does not trust a request-only `return_time` that the current backend may not persist.

## Fail-closed behavior
For `createBooking` and `updateBooking`:
1. Validate Admin PIN before preflight.
2. For `createBooking`, allow blank `pickup_time` as TBD; reject only a non-empty invalid time before any upstream read/write.
3. Fetch a fresh snapshot directly from the configured Apps Script deployment.
3. Run Snapshot Resilience validation and spreadsheet-id match.
4. Resolve the proposed package/event/current booking.
5. Calculate overlapping reservation windows and capacity.
6. Validate any manually supplied Phone/Lens Asset against type, rentable state, and overlapping assignments.
7. If preflight cannot be completed, return `BOOKING_PREFLIGHT_UNAVAILABLE` and do not write.
8. If a collision/capacity violation exists, return `BOOKING_COLLISION` HTTP 409 and do not write.
9. Only a passing request is delegated to the existing Admin write proxy.

## Errors enforced
- `BOOKING_PICKUP_TIME_INVALID`
- `PHONE_CAPACITY_EXCEEDED`
- `LENS_CAPACITY_EXCEEDED`
- `UNKNOWN_ASSET`
- `WRONG_ASSET_TYPE`
- `ASSET_NOT_RENTABLE`
- `ASSET_WINDOW_COLLISION`
- `MISSING_EVENT_DATE`
- `UNKNOWN_PACKAGE_TYPE`

## Safety boundaries
- No Apps Script source edit/deploy.
- No downgrade of live 9_5_9 with repository 9_5_8 source.
- No booking/event/customer/pricing/inventory row mutation during rollout.
- No Scanner/Verifier/Canary/Make mutation.
- No secret retrieval or logging.
- Existing same-day Apps Script lock/validation remains in place.

## Concurrency limitation
The Vercel preflight and Apps Script write are separate network operations. The guard is fail-closed for the snapshot it sees, but cross-day preflight is not an atomic transaction under the Apps Script document lock. Existing Apps Script same-day collision checks remain the final atomic protection for same-day assignments. A future live Apps Script revision can move reservation-window validation inside the document lock once the exact deployed 9_5_9 source is available.

## Rollback
Remove the `/api/kk-admin` rewrite to `/api/kk-admin-guard`, leaving the existing `api/kk-admin.js` route behavior unchanged. No business data migration is required.


## 2026-09-21 timing-hardening follow-up

Operational clarification: customers may not know pickup time when booking, and event end times vary.

Final policy:
- `pickup_time` is optional/TBD;
- `return_time` is optional;
- unknown pickup reserves from 00:00 on the event day;
- unknown return reserves through 06:00 on the next day;
- `picked_up` without return evidence remains open-ended;
- missing optional times are informational, not data-integrity failures.

No historical booking time is invented or backfilled.
