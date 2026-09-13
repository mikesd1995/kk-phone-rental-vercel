# KK Phone Rental Admin — Snapshot Resilience V2

Date: 2026-09-14
Branch: `admin-snapshot-resilience-v2`
Baseline main: `fde7c968cf467208f061a7cd762a394abadc7a07`
Release identifier: `admin-snapshot-resilience-2`

## Scope

This change is a narrow Admin read-path hardening follow-up. It does **not** edit or deploy Apps Script, does **not** change Google Sheet data, bookings, events, pricing, inventory, Scanner, Verifier, Canary, Make, notification state, or production business truth.

The previous P0 release (`admin-snapshot-resilience-1`, PR #3) already added snapshot contract validation, in-memory Last Known Good, stale write blocking, snapshot-aware Live Check, Bangkok-day handling, and version diagnostics. This V2 change only closes residual failure modes discovered during the follow-up audit.

## Triggering risk

The V1 guard reliably rejects missing/malformed arrays and a nonzero-to-zero collapse. A partial upstream read could still return syntactically valid non-empty arrays with most records missing, for example `events 40 -> 3` and `bookings 20 -> 2`. V1 could accept that response and replace the Last Known Good state, making the Admin appear to have lost most records even though the underlying Sheet remained intact.

A second residual risk was identity corruption: duplicate or blank `event_id`, `booking_id`, or `asset_id` values could pass the generic object-array contract and then cause misleading counts, joins, or workflow rendering.

## What changed

### `admin/snapshot-health.js`

- Bumped shared Admin/proxy release identifier to `admin-snapshot-resilience-2`.
- Added stable-ID contract checks:
  - `events -> event_id`
  - `bookings -> booking_id`
  - `current_bookings -> booking_id`
  - `assets -> asset_id`
- Rejects snapshots containing blank required IDs.
- Rejects snapshots containing duplicate required IDs.
- Added previous-snapshot count-collapse detection for `events`, `bookings`, and `assets`.
- If **two or more** core arrays with a previous baseline of at least 8 records collapse to 35% or less of their prior count while remaining non-empty, the snapshot is rejected as a correlated partial-read signature.
- If only one core array sharply collapses, V2 emits a warning instead of rejecting the whole snapshot. This avoids overreacting to a legitimate one-table archival/cleanup operation while keeping the anomaly visible.
- Added a warning when `current_bookings` contains a booking ID absent from the authoritative `bookings` array.
- Existing V1 behavior remains: missing/malformed arrays fail, unexpected zero fails against a previous nonzero baseline, `current_bookings` incompleteness is a warning, all-zero first load is uncertain, and open-work rendering derives from `bookings`.

### `tests/snapshot-health.test.js`

Added regression coverage for:
- missing required stable IDs;
- duplicate booking IDs;
- correlated non-zero partial snapshot collapse;
- isolated sharp count drop as warning-only;
- `current_bookings` containing an unknown booking ID;
- UI preservation of the prior Last Known Good when a correlated partial snapshot is rejected.

Existing tests for malformed payloads, zero collapse, auth failure, stale-write blocking, Bangkok-day behavior, proxy snapshot health, sheet mismatch, and timeout/latency remain in place.

## Before vs after

### Before V2

A response such as:

- events: 40 -> 3
- bookings: 20 -> 2
- assets: 10 -> 2

could still be structurally valid because every array was present and non-empty. The UI could replace the good snapshot with the partial result.

Duplicate IDs could also pass the array/object-level contract.

### After V2

The same multi-surface collapse is classified as an invalid snapshot and rejected before UI state replacement. The existing Last Known Good remains visible and writes remain blocked until a valid refresh succeeds.

Identity anomalies are rejected before rendering/business workflow code consumes them.

An isolated sharp drop on one table is surfaced as a warning, not an automatic hard failure, to balance resilience with legitimate maintenance/archive operations.

## Safety and deployment boundaries

- No Apps Script source was edited. The repository `apps-script/Code.gs` remains older than the reported deployed 9_5_9 backend and must not be copied over production.
- No Google Sheet rows/formulas were changed.
- No Scanner/Verifier/Canary task or Machine SOT state was changed.
- No write-action retry behavior was added.
- Last Known Good remains page-memory only; no customer/booking data is persisted into localStorage/sessionStorage.
- The correlated-drop rule requires an existing in-page baseline. A first-load partial snapshot cannot be distinguished from a legitimately small database solely from client history; authenticated live source-count comparison remains a future option.
- The threshold is intentionally conservative: prior count >= 8, current nonzero count <= 35%, and at least two affected core surfaces for hard rejection.

## Verification plan

Required before merge:

1. `node --check admin/snapshot-health.js`
2. Existing Admin/proxy syntax checks remain unchanged.
3. `node --test tests/snapshot-health.test.js`
4. Review PR diff to confirm only helper/tests/audit documentation changed.
5. If CI is available, require the PR workflow result before merge.

Post-deploy smoke check:

- `/admin/snapshot-health.js` should report `admin-snapshot-resilience-2`.
- `/api/kk-admin?action=snapshotHealth` without Admin PIN must remain 401.
- Authenticated Admin refresh should show normal counts with no unexpected identity/collapse warnings.
- Simulated/real upstream failure must preserve Last Known Good and block writes.

## Rollback

Revert the V2 change or restore the previous Vercel deployment. Rollback affects only Admin/proxy validation behavior. Do not roll back Apps Script or Sheet data as part of this change.
