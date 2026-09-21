# Gate 2 Final Acceptance Checklist — 2026-09-21

Status before final acceptance: **WAITING FOR AUTHENTICATED TIMEZONE READBACK**

## Preconditions already satisfied

- Event logical duplicates = 0.
- event_id/date drift = 0.
- Duplicate booking_id = 0.
- Duplicate asset_id/template_id/event override = 0.
- Booking risk = 0.
- Negative package availability = 0.
- Operations capacity status = OK.
- pickup_time = optional/TBD.
- return_time = optional.
- Unknown pickup uses conservative reservation start at 00:00 on event day.
- Unknown return uses conservative reservation end at 06:00 next day.
- Missing optional times are informational, not data-integrity failures.
- Apps Script recovered backend 9_5_9 is the protected production baseline.

## Required authenticated evidence

Before changing timezone:

1. Open the bound Apps Script project.
2. Read Project Settings → Time zone.
3. Read Triggers and confirm `kkCleanupOldData30DaysAuto` schedule.
4. Do not regenerate keys, rotate PIN, reinstall triggers, or deploy repository `apps-script/Code.gs` just to obtain this evidence.

## Before-migration capture

Capture representative values before any timezone mutation:
- at least 3 `01_Events.event_date` rows;
- at least 3 `00_Master_Booking.created_at` values;
- known `pickup_time` values;
- at least 3 `15_Admin_Audit_Log.timestamp` values;
- IDs whose date segment is expected to match event_date;
- current `17_Operations_Control` event dates/capacity rows.

## Migration decision

### If Apps Script timezone is already Asia/Bangkok

- Create a fresh spreadsheet backup.
- Change Spreadsheet timezone from Etc/GMT to Asia/Bangkok.
- Do not alter Apps Script code or reinstall trigger.
- Re-read every captured value.

### If Apps Script timezone is not Asia/Bangkok

- Do not change Spreadsheet timezone alone.
- Prepare a controlled Apps Script + Spreadsheet timezone alignment.
- Reconfirm trigger semantics before the change.
- Re-read every captured value after the change.

## Acceptance checks after migration

All must pass:

- event dates unchanged;
- event ID date segments unchanged and still match event dates;
- booking created_at values preserve intended local date/time;
- pickup_time values unchanged;
- audit timestamps preserve intended chronology/local time;
- Operations Control dates/capacity remain correct;
- Apps Script timezone = Asia/Bangkok;
- Spreadsheet timezone = Asia/Bangkok;
- cleanup trigger still exists and is scheduled at the intended local hour;
- System Guard returns healthy Apps Script JSON;
- Apps Script version remains 9_5_9;
- configured spreadsheet identity matches backend spreadsheet identity;
- snapshot arrays remain valid;
- event / booking / asset counts remain consistent with source counts;
- no new critical runtime errors.

## Booking policy production acceptance

Test a disposable or safely reversible booking workflow only after authenticated Admin access is available:

1. blank pickup_time / blank return_time is accepted under the optional policy;
2. collision/capacity guard still blocks a genuine conflict;
3. explicit valid pickup_time is honored;
4. malformed non-empty pickup_time is rejected;
5. no historical time is fabricated;
6. refresh/readback preserves the expected booking state.

Do not leave test business data in production. Prefer a known reversible validation path or remove the test record using the normal supported workflow if a test record is created.

## Gate 2 closure record

Only after every check passes, append a final audit record equivalent to:

```
GATE2_FINAL_ACCEPTANCE = PASS
event_identity = PASS
data_integrity = PASS
booking_timing_policy = PASS
collision_capacity_guard = PASS
apps_script_9_5_9 = PASS
timezone_alignment = PASS
production_acceptance = PASS
```

Until then, timezone remains the only explicit Gate 2 blocker.
