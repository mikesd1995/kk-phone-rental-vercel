# Gate 2 Booking Timing + Timezone Hardening — 2026-09-21

## Outcome

This checkpoint closes the remaining logical event duplicate and prevents future bookings from being created without an explicit pickup time.

Current identity state after production readback:
- Events: 71
- Bookings: 26
- workflow-open bookings: 5
- Assets: 5
- logical duplicate event groups: 0
- event_id/date drift: 0

## MITH duplicate resolution

Backup created before mutation:
`KK Phone rental backend - PRE_MITH_DEDUP_2026-09-21_0030`
(`1ECiflYWHzo63MsN22EFeN2G1K3UuzDyBmdeR09pcAEQ`)

Canonical live event:
`EVT-20260916-THE-11TH-ANNIVERSARY-WITH-MI-2`

Evidence:
- base createEvent occurred earlier and reported `web_ready_action=hide` with two overrides;
- `-2` createEvent occurred later after a new poster upload and reported `web_ready_action=show` with three overrides;
- the `-2` row carries the explicit lens-hide rule;
- no booking, booking archive, rental dashboard or prior event archive referenced either MITH event id.

Archived:
- base event row 44 -> `13_Event_Archive!103`
- base overrides 155:156 -> `14_Event_Override_Archive!254:255`

Generated `09_Web_Packages!H122` and `H124` were restored to formulas so blank rows cannot retain stale MITH prices.

## Booking timing state

Five active bookings were read:
- missing pickup time: 2
  - `BK-20261023-001`
  - `BK-20261025-001`
- missing return time: 5 / 5

No time was invented or written.

## Prevention change

New Booking creation now requires `pickup_time` twice:
1. Admin HTML uses a required `type="time"` field.
2. `api/kk-admin-guard.js` rejects missing or invalid pickup time before any upstream snapshot fetch or Apps Script write.

Error codes:
- `BOOKING_PICKUP_TIME_REQUIRED`
- `BOOKING_PICKUP_TIME_INVALID`

Policy header:
`X-KK-Booking-Timing-Policy: booking-timing-create-pickup-required-1`

Existing historical rows are not silently changed.

## Snapshot observability

`admin/snapshot-health.js` now exposes:
- `booking_timing.active_count`
- `booking_timing.missing_pickup_time_count`
- `booking_timing.missing_return_time_count`

Incomplete active booking timing produces a warning, not a transport-health failure.

## Return-time limitation

The current live backend does not yet prove end-to-end persistence/exposure of submitted `return_time`. The Vercel guard therefore still uses its conservative fallback through 06:00 on the next Bangkok day. This avoids trusting a value that may not be persisted.

## Timezone audit

Spreadsheet timezone remains `Etc/GMT`.

Evidence gathered:
- business timezone target is `Asia/Bangkok`;
- critical Sheet ranges audited on 2026-09-21 contained zero `NOW()`/`TODAY()` formulas;
- recovered Apps Script uses `Session.getScriptTimeZone()` for event date keys and API date/time rendering;
- cleanup trigger installation uses `.atHour(3)`.

Decision: **do not mutate spreadsheet timezone yet**.

Reason: spreadsheet timezone and Apps Script project timezone are separate configuration surfaces. Changing only the spreadsheet could change historical timestamp presentation without proving the script trigger/date-key timezone is aligned. The next safe timezone step must verify the Apps Script project timezone and timestamp readback before and after any change.

## Audit trail

The workbook audit log records:
- MITH pre-change backup
- MITH duplicate archive
- generated-price formula restoration
- clean event identity readback
- booking timing audit
- timezone audit

Audit source:
`manual-gate2-integrity-20260921`
