# KK Phone Rental — Private Reader Acceptance Attempt

Date: 2026-09-15 (Asia/Bangkok)
Scope: Production Private Reader / CRM & Intelligence acceptance after full 8-dataset Core→CRM sync acceptance.

## Safety boundary

- Core Operations remains the only production source of truth.
- No Booking/Event/Asset/Package/Pricing/Web/Settings/Operations transactional data was modified.
- No Apps Script was modified or deployed.
- No CRM read-model values were rewritten during this acceptance attempt.
- `last_synced_at` was intentionally not advanced by this attempt.
- No private-reader activation or runtime cutover is claimed unless authenticated production health and strict private-read acceptance pass.

## Proven precondition

The CRM & Intelligence manifest was read live before this acceptance attempt and still reports:

- `sync_policy = HOURLY_VERIFIED_FULL_READ_MODEL`
- `auto_sync = CHATGPT_TASK_HOURLY`
- `sync_state = SYNCED`
- `sync_coverage = 00_Rental_Dashboard;11_Customer_Stats;12_Booking_Archive;13_Event_Archive;14_Event_Override_Archive;15_Admin_Audit_Log;16_Admin_Error_Log;_Rental_Dashboard_Data`
- `last_synced_at = 2026-09-15T03:30:09+07:00`
- `private_reader_runtime = PENDING_VERCEL_ENV_ACCESS / SAFE_FALLBACK`
- `private_analytics_acceptance = PENDING_PRIVATE_READER_ENV / BLOCKED_SAFE`

The 8-dataset synchronization proof remains intact and was not altered.

## Repository/runtime inspection

Current repository head inspected: `62b479126c3f63956b033a98004c0b267b96c61d` (`Merge dual-sheet Phase 2D hourly sync freshness alignment`).

The deployed code path contains the required production safety controls:

1. `api/lib/private-google-sheets.js`
   - Service-account authentication only.
   - Scope is `https://www.googleapis.com/auth/spreadsheets.readonly`.
   - Supports `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, or `GOOGLE_SERVICE_ACCOUNT_JSON`.
   - Reads the private CRM Sheet through Google Sheets API; it does not grant write scope.

2. `api/kk-intelligence-health.js`
   - Requires `x-admin-pin` authenticated POST.
   - Refuses to mark private analytics eligible when the reader is not configured.
   - Reads manifest and KPI through the private reader.
   - Requires manifest Sheet IDs to match.
   - Requires freshness acceptance.
   - Reconciles the runtime datasets against Core before setting `private_analytics_eligible=true`.
   - Keeps `runtime_cutover=false` during health validation.

3. `api/kk-rental-dashboard-v6.js`
   - Uses Core fallback when private reader is missing, stale, mismatched, or reconciliation is unavailable.
   - Supports strict acceptance through `KK_CRM_REQUIRE_PRIVATE=1`.
   - In strict mode, any private-reader/freshness/reconciliation failure returns 503 instead of silently falling back.
   - Runtime reconciliation covers `_Rental_Dashboard_Data` and `13_Event_Archive`, the two CRM datasets consumed by Rental Analytics v6.

## Live Vercel access result

The connected Vercel integration returned no accessible Team/Workspace and could not list the known project through the historical workspace slug. Therefore this session cannot safely inspect or modify Production environment variables, deployment secrets, or trigger an authenticated production acceptance using the private reader.

This is an access-path blocker, not a data-sync failure and not evidence of an application-code failure.

## Acceptance decision

**BLOCKED_SAFE — NO CUTOVER**

The acceptance gate is deliberately not advanced.

The following must remain unchanged until a Vercel connection with access to the production project is available:

- `private_reader_runtime` must not be promoted to active.
- `private_analytics_acceptance` must not be marked accepted.
- `runtime_cutover` must remain blocked/pending.
- `last_synced_at` must remain the timestamp of the last proven Core→CRM synchronization, not this Vercel acceptance attempt.

## Exact next acceptance sequence

Once Production Vercel project access is available:

1. Confirm the production project identity and current deployment commit.
2. Inspect environment-variable names without exposing secret values.
3. Confirm `KK_CRM_SHEET_ID` points to the private CRM & Intelligence sheet.
4. Confirm service-account credentials are configured using one supported credential form.
5. Confirm the service account has Viewer/read access only to the CRM & Intelligence Sheet.
6. Keep `KK_CRM_REQUIRE_PRIVATE` disabled for the first health check.
7. POST authenticated `/api/kk-intelligence-health` and require:
   - reader configured,
   - private read succeeds,
   - manifest IDs match,
   - sync is fresh,
   - reconciliation passes,
   - `private_analytics_eligible=true`,
   - status `READY_PRIVATE_READ_RECONCILED`.
8. Run the normal Rental Analytics route and verify `data_source.mode=crm_private` while Core remains authoritative fallback.
9. Perform a controlled strict test with `KK_CRM_REQUIRE_PRIVATE=1` and verify a healthy request succeeds without Core fallback.
10. Restore the intended production strictness setting after the acceptance test.
11. Only after all checks pass, update the CRM manifest acceptance fields with the proven runtime result and timestamp.

## Changes made in this attempt

- Read and verified live CRM & Intelligence manifest state.
- Inspected current repository head and private-reader implementation.
- Tested connected Vercel project discovery; access was unavailable.
- Preserved all fail-safe states and timestamps.
- Added this audit record only; no production runtime, spreadsheet dataset, credential, Apps Script, or transactional-data change was made.
