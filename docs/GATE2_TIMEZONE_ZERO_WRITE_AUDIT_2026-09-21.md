# Gate 2 Timezone Zero-Write Audit — 2026-09-21

## Executive result

Status: **CHECK / BLOCKED SAFE**

No timezone mutation was performed.

The business target is `Asia/Bangkok`, while the production Google Sheet currently reports:
- locale: `th_TH`
- spreadsheet timezone: `Etc/GMT`

The Apps Script project timezone and installed trigger schedule could not be authenticated/read back through the connected browser session. Because production data contains numeric date/time serials, changing only the spreadsheet timezone without proving the Apps Script timezone would create unnecessary risk of timestamp/date rendering drift.

## Evidence collected

### Google Sheet metadata

Production spreadsheet:
`12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`

Metadata:
- title: `KK Phone rental backend`
- locale: `th_TH`
- timeZone: `Etc/GMT`

### Apps Script project discovery

Google Drive exact MIME search:
`application/vnd.google-apps.script`

Accessible project count: **0**

A browser automation run opened the production spreadsheet but was not authenticated to Google and the browser vault had no Google credential. Therefore:
- bound Apps Script project opened: **false**
- Apps Script project timezone: **not verified**
- installed triggers: **not verified**

No credential, code, deployment, trigger, or project setting was changed.

### Spreadsheet formula exposure

Previously audited critical operational ranges contained:
- `NOW()` / `TODAY()` formula references: **0**

This lowers formula-risk but does not make a timezone mutation safe by itself.

### Numeric date/time serial exposure

The production workbook stores real numeric serials in operational data, including:
- `15_Admin_Audit_Log.timestamp`
- `00_Master_Booking.created_at`
- `00_Master_Booking.pickup_time` when known
- `01_Events.event_date`

Examples observed as unformatted values include fractional timestamp serials and date serials. Therefore timezone changes can affect how Date values created/read by Apps Script are interpreted or rendered even though event date cells appear date-only in the UI.

### Recovered Apps Script timing semantics

The recovered production-compatible 9_5_9 source:
- formats API dates with `Session.getScriptTimeZone()`;
- formats API datetimes with `Session.getScriptTimeZone()`;
- defines an automated cleanup trigger using `.atHour(3)`.

This makes the Apps Script project timezone an authoritative dependency for safe migration.

## Safety decision

Do **not** change Spreadsheet timezone yet.

Required evidence before mutation:
1. authenticate to the bound Apps Script project;
2. read Project Settings timezone;
3. list installed triggers and confirm their functions/schedules;
4. capture representative historical timestamp/date readback before migration;
5. if Apps Script timezone is not already `Asia/Bangkok`, align Apps Script project + spreadsheet in a controlled change;
6. rerun timestamp/date readback and System Guard;
7. verify no event date, booking created_at, pickup time, audit timestamp, or daily trigger has shifted unexpectedly.

## Current Gate 2 state

- Event logical duplicates: **0**
- event_id/date drift: **0**
- Booking pickup time: **OPTIONAL / TBD**
- Booking return time: **OPTIONAL**
- Missing booking times: **INFO**, not data-integrity failures
- Collision fallback: **00:00 event day → 06:00 next day**
- Apps Script backend: **9_5_9 recovered and operational**
- Timezone: **CHECK — only remaining timing-readiness blocker**

## Persistent audit evidence

The production workbook also records `gate2TimezoneZeroWriteAudit` in `15_Admin_Audit_Log`.

No business rows, pricing, booking values, customer data, secrets, Apps Script source/deployment, Scanner, Verifier, Canary, Make workflow, or Machine SOT were changed by this timezone audit.


## Additional authentication evidence

A second read-only browser attempt targeted the production Admin page at `https://kk-phone-rental.vercel.app/admin/`.

Result:
- Admin authenticated session: **false**
- System Guard run: **false**
- Admin PIN was not guessed, entered, or retrieved
- no production write was attempted

Combined with the earlier Google Apps Script browser attempt, both available authenticated read paths are currently unavailable to the connected automation profile:
1. Google account authentication is unavailable for Apps Script Project Settings / Triggers.
2. Admin signed session / PIN is unavailable for System Guard diagnostics.

Therefore timezone migration remains intentionally fail-closed rather than inferring a production configuration and mutating the workbook.
