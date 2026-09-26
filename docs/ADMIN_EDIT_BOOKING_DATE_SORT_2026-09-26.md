# Edit Booking chronological selector — 2026-09-26

## Problem

The Admin "เลือก Booking" selector inside Edit Booking appeared visually random by event date.

Root cause: `populateBookingEditForm()` reused the generic `sortedBookings()` helper. That helper intentionally follows the separate Booking report/table sort control and defaults to `created_desc`, so the Edit Booking selector was ordered by Booking creation time instead of event date.

This also meant changing the report sort elsewhere could silently reshuffle the Edit Booking selector.

## Fix

Edit Booking now has its own deterministic sorter:

1. Event date ascending.
2. Event name ascending within the same date.
3. Customer name ascending within the same event/date.
4. Physical Booking row number as the final stable tie-break.

Rows with an invalid/missing event date are pushed to the end instead of appearing above valid dates.

The selector is also grouped by Thai event month using native `<optgroup>`, while retaining the existing Booking label and row-number value used by the update/cancel flow.

## Separation of concerns

`sortedBookings()` remains unchanged for reports/tables where the operator is expected to choose a sort mode.

`populateBookingEditForm()` now uses only `sortedEditableBookings()`, so `#bookingsSort` can no longer influence the Edit Booking selector.

## Safety

This is presentation/selection ordering only.

No Booking rows, dates, status, payment, Asset assignment, price, stock, Event visibility, Package visibility, Google Sheet data, Apps Script settings, secrets, or environment variables are changed by deployment.

The selected Booking value remains the original `row_number`, preserving the existing update/cancel identity contract.
