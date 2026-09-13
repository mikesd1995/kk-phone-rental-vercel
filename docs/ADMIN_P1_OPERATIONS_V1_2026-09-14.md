# KK Phone Rental Admin — P1 Operations v1

Date: 2026-09-14
Branch: `admin-p1-operations-v1`
Baseline main: `1fc14001eba587e88846bec9ef33c82ce6df010b`

## Objective
Add an operational layer for Booking Calendar, Smart Availability, and Asset Collision Guard without changing production business truth.

## Live CRM Sheet change
One consolidated tab was created in the existing CRM workbook: `17_Operations_Control`.

### Booking Calendar
Reads `00_Master_Booking` and shows non-final bookings with event date/name, booking ID/customer, package type, assigned phone/lens, booking status, pickup time, and return time. Final statuses `cancelled`, `completed`, and `no_show` are excluded.

### Smart Availability
Reserving statuses are `pending`, `confirmed`, `prepared`, and `picked_up`. For each reserving date the tab calculates active booking count, phone demand/capacity/free, lens demand/capacity/free, bundle free, unassigned required assets, and `OVERBOOK` when physical demand exceeds rentable capacity.

Rentable capacity comes from `02_Assets` where `status=available` and `rentable_now=TRUE`.

### Asset Collision Guard
Assigned phone IDs and lens IDs are grouped by event date and counted. Counts greater than 1 are conditionally highlighted red. Capacity overbooking is highlighted separately in Smart Availability.

## Acceptance readback
After formula repair:
- 2026-09-19: phone free 1/2, lens free 1/2, bundle free 1, OK
- 2026-09-20: phone free 1/2, lens free 1/2, bundle free 1, OK
- 2026-10-24: phone free 1/2, lens free 1/2, bundle free 1, OK
- 2026-10-25: phone free 1/2, lens free 1/2, bundle free 1, OK
- 2026-12-05: 2 active bookings, phone demand 2/2 (free 0), lens demand 1/2 (free 1), bundle free 0, OK

No current assigned asset/date group has a booking count greater than 1.

## Formula repair history
Two issues were caught by exact readback before acceptance:
1. Initial formulas were placed contiguously from A5, causing spill collisions and `#REF!`. The data area was cleared and formulas were re-addressed to the intended blocks.
2. Array `COUNTIFS` criteria returned zero package demand under the workbook locale. Phone/lens demand and unassigned calculations were replaced with `SUMPRODUCT + REGEXMATCH`, after which exact readback matched the real bookings.

Failed intermediate values were not treated as accepted operational truth.

## Repository code
`admin/operations-engine.js` adds pure/testable logic for date normalization, rentable inventory, booking calendar generation, per-date availability, missing/unknown/wrong-type/non-rentable asset detection, duplicate assignment detection, and capacity exceeded detection.

`admin/operations-ui.js` contains the prepared UI renderer. It is not activated in production v1; the live Sheet control surface is the accepted user-facing rollout for this version.

`tests/admin-operations.test.js` covers normal availability, capacity exhaustion, double booking, invalid asset assignments, final-status behavior, date normalization, and calendar sorting.

`npm run check` now includes both new Admin operations JavaScript modules.

## Safety boundaries
- No Apps Script edit or deploy.
- No change to booking/event/customer/pricing/inventory business rows.
- No automatic booking or asset mutation.
- No Scanner/Verifier/Canary/Make changes.
- The new Sheet tab is formula/read-only operational analysis.

## Follow-up
1. Merge only after GitHub Actions syntax/regression tests and Vercel Preview succeed.
2. Observe formulas after future booking changes.
3. Integrate the prepared UI through a safe Admin integration path.
4. Add write blocking on collisions only after dedicated write-path acceptance tests.
