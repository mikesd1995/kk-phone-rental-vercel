# Gate 2 Data Integrity / Apps Script Recovery Checkpoint — 2026-09-20

## Scope

Read-only Gate 2 continuation while the exact live Apps Script 9_5_9 source and active Web App deployment remain unavailable.

No Apps Script source/deployment/access mutation, Vercel secret/env mutation, Google Sheet business-row write, booking/event/customer/pricing/inventory mutation, or Scanner/Verifier/Canary/HF activation is authorized by this checkpoint.

## Exact current repository / production baseline

- main: `bbd15ffb1b651d908efb61e16aab2664891d749e`
- Vercel Production: `dpl_Cyo7SbCKq1SLBennN7Jnpfy3JqKv`
- state: READY
- deployment SHA matches main

## Apps Script recovery re-check

Authoritative backend Sheet:

`KK Phone rental backend`

Spreadsheet ID:

`12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU`

Fresh Drive recovery evidence:
- exact MIME search `application/vnd.google-apps.script`: 0 accessible projects
- Drive search for active `script.google.com/macros/s/.../exec`, `9_5_9`, `PRICE_INTEGRITY_FIX`, and `KK_ADMIN_SCRIPT_URL`: 0 authoritative recovery result
- browser opened the bound spreadsheet but remained unauthenticated / View only
- TinyFish vault contained no Google credential
- Extensions > Apps Script / Deploy > Manage deployments therefore remained inaccessible
- no URL/deployment ID was guessed

Classification remains:

`APPS_SCRIPT_9_5_9_SOURCE = UNRECOVERED`

`ACTIVE_WEB_APP_EXEC = UNRECOVERED`

`RECOVERY_GATE = BLOCKED_SAFE / OWNER_GOOGLE_AUTH_REQUIRED`

Repository `apps-script/Code.gs` remains stale relative to observed production 9_5_9 and must not be deployed over production.

## Backend Sheet permission surface

Fresh Drive permission metadata now reports:
- owner user = present
- `anyone` permission = `reader`
- broad `anyone writer` permission = absent

This is materially safer than the earlier broad-write evidence surface. It does not prove historical writers, but current permission metadata no longer exposes anonymous edit capability.

No sharing mutation was performed in this checkpoint.

## Spreadsheet timezone

Spreadsheet metadata still reports:

`Etc/GMT`

Business logic target remains:

`Asia/Bangkok`

No timezone mutation was performed because changing spreadsheet timezone can alter interpretation/display of date-time serials and must not be mixed into an unresolved Apps Script source-integrity recovery.

## Current health evidence

`10_Admin_Health_Check` currently reports:
- Duplicate event_id = 0 / OK
- Event data_health not OK = 0 / OK
- Duplicate booking_id rows = 0 / OK
- Source count — Events = 73
- Source count — Bookings = 26
- Source count — Assets = 5
- Active bookings missing return_time = 5 / CHECK

Current active booking status evidence:
- pending = 0
- confirmed = 5
- prepared = 0
- picked_up = 0

Among the 5 confirmed bookings:
- missing return_time = 5 / 5
- missing pickup_time = 2 / 5
- risk_flag currently reports OK on all 5 rows

The current Sheet health row correctly surfaces missing return_time separately, but booking risk_flag itself does not make time completeness authoritative.

No booking time was invented or written.

## Event identity audit using current Vercel duplicate semantics

The audit used the same identity normalization semantics as `api/kk-admin-guard.js`:
- NFKC text normalization
- trim + lower-case
- punctuation/space collapsing
- normalized event date
- same name + same date
- when both venues are present, venues must also match

Current `01_Events` rows scanned: 73.

### Logical duplicate groups not detected by duplicate event_id formula

2 groups:

1. `LABX GRAND OPENING DEXX THE EXPERIENCE 4TH ANNIVERSARY`
   - 15/09/2026
   - centralwOrld
   - two different event IDs, including a `-2` identity

2. `The 11th Anniversary with MITH`
   - 16/09/2026
   - centralwOrld
   - two different event IDs, including a `-2` identity

Therefore:

`DUPLICATE_EVENT_ID = 0`

does **not** imply:

`LOGICAL_EVENT_DUPLICATE = 0`

### event_id / event_date drift

3 current rows have a date encoded in `event_id` that does not match `event_date`:

1. `EVT-20261025-LYKN-REFLEXION-CONCERT-2`
   - ID date = 2026-10-25
   - event_date = 2026-10-23

2. `EVT-20260904-GEMINI-ART-VENTURE-CONCERT-2`
   - ID date = 2026-09-04
   - event_date = 2026-09-05

3. `EVT-20261026-2026-PLAVE-WORLD-TOUR-KEEP-I`
   - ID date = 2026-10-26
   - event_date = 2026-10-10

The existing `data_health` formula checks missing required fields / allowed status / duplicate exact event_id, but does not detect this identity/date drift.

No event ID or event row was rewritten in this checkpoint.

## Repository observability hardening

This branch extends `admin/snapshot-health.js` with non-mutating event identity signals:

`event_integrity.logical_duplicate_group_count`

`event_integrity.logical_duplicate_groups`

`event_integrity.id_date_drift_count`

`event_integrity.id_date_drift`

Warnings are emitted for:
- logical duplicate identity groups using the same normalization semantics as Admin createEvent preflight
- event_id/date drift

These signals intentionally remain **warnings**, not transport-health failures.

Reason:
- existing data anomalies should become visible;
- Admin snapshot read availability must not be converted into an outage merely because historical data needs reconciliation;
- authoritative business-data repair remains separately gated.

## Safety boundary

This change does not:
- auto-delete duplicate events
- rewrite event IDs
- rewrite event dates
- fill missing pickup/return times
- change Sheet timezone
- deploy Apps Script
- update `KK_ADMIN_SCRIPT_URL`
- update `KK_ADMIN_API_KEY`
- enable Admin business writes
- claim backend atomic duplicate protection is complete

## Gate 2 classification after this checkpoint

`CURRENT_DATA_IDENTITY = CHECK / OBSERVABILITY IMPROVED`

`VERCEL_DUPLICATE_PREFLIGHT = PRESENT`

`BACKEND_DOCUMENTLOCK_DUPLICATE_GUARD = NOT PROVEN`

`BOOKING_TIME_ATOMICITY = NOT PROVEN`

`APPS_SCRIPT_9_5_9_SOURCE = UNRECOVERED`

`ACTIVE_WEB_APP_EXEC = UNRECOVERED`

`GATE_2 = BLOCKED_SAFE / P0 OPEN`

The next authoritative Gate 2 step still requires an owner-authenticated Google Apps Script session to recover and preserve exact live 9_5_9 before any backend patch/deploy.
