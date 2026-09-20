# Admin P1 Reservation Window + Hard Collision Guard v2 — 2026-09-14

## Objective
Prevent booking writes from reaching Apps Script when a fresh production snapshot shows that the proposed booking would exceed physical capacity or collide with a manually selected Asset during the reservation window.

## Architecture
Browser `/api/kk-admin` -> Vercel rewrite -> `api/kk-admin-guard.js` -> fresh read-only Apps Script snapshot -> `admin/reservation-guard.js` preflight -> existing `api/kk-admin.js` -> live Apps Script write.

The existing Admin proxy remains unchanged. The wrapper delegates every non-booking action unchanged and only intercepts `createBooking` and `updateBooking`.

## Reservation window policy
- Source date: booking `event_date`.
- **New Booking creation requires an explicit valid `pickup_time` (HH:MM) at the Vercel guard and in the Admin form.**
- Historical rows that predate this rule may still have a missing `pickup_time`; their existing fallback behavior remains unchanged until the operator supplies an authoritative time.
- Start: `pickup_time` when present; historical missing values still fall back to 00:00 Bangkok time.
- Explicit `return_time`: same-day return when later than pickup; next-day return when return clock time is earlier/equal to pickup.
- Missing `return_time`: conservative fallback through 06:00 Bangkok time on the next day.
- `picked_up` with no return evidence: treated as open-ended until workflow status changes.

The current live Admin snapshot does not expose persisted `return_time`; therefore normal Admin-created bookings use the conservative fallback. The guard deliberately does not trust a request-only `return_time` that the current backend may not persist.

## Fail-closed behavior
For `createBooking` and `updateBooking`:
1. Validate Admin PIN before preflight.
2. For `createBooking`, reject missing/invalid `pickup_time` with HTTP 422 **before any upstream read or write**.
3. Fetch a fresh snapshot directly from the configured Apps Script deployment.
3. Run Snapshot Resilience validation and spreadsheet-id match.
4. Resolve the proposed package/event/current booking.
5. Calculate overlapping reservation windows and capacity.
6. Validate any manually supplied Phone/Lens Asset against type, rentable state, and overlapping assignments.
7. If preflight cannot be completed, return `BOOKING_PREFLIGHT_UNAVAILABLE` and do not write.
8. If a collision/capacity violation exists, return `BOOKING_COLLISION` HTTP 409 and do not write.
9. Only a passing request is delegated to the existing Admin write proxy.

## Errors enforced
- `BOOKING_PICKUP_TIME_REQUIRED`
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

Production data audit found 5 active bookings:
- 2 are missing `pickup_time`;
- all 5 are missing `return_time`.

No times were invented or backfilled. The server-side create guard now prevents any **new** booking from adding another missing pickup time. The Admin create form also uses a required `type="time"` input.

`return_time` remains a separate backend limitation: the current live Admin API contract does not prove end-to-end persistence/exposure of return time, so Vercel continues to use the conservative next-day 06:00 fallback rather than trust a request-only value.
