# KK Phone Rental Admin — Independent Source Count Cross-Check V3

Date: 2026-09-14
Branch: `admin-source-count-crosscheck-v3`
Baseline main: `b7d35e17c4b8f70627bb79706eaf538b7448762d`
Release identifier: `admin-snapshot-resilience-3`

## Objective

Close the remaining first-load failure mode in Admin Snapshot Resilience without deploying the stale repository Apps Script source and without adding a new public-data dependency.

V2 can reject a correlated non-zero collapse when an in-page Last Known Good baseline exists. It cannot distinguish a legitimate small database from a partial snapshot on the first Admin load because no previous browser state exists.

V3 adds independent source counts calculated inside the existing `10_Admin_Health_Check` sheet and compares them with the snapshot arrays returned by Apps Script. The counts travel through the already-existing `health` field in the snapshot response; no new Apps Script route or deployment is required.

## Live Health Check changes

Three read-only formula rows were added below the existing Notes row in `10_Admin_Health_Check`:

| Row | Check | Formula / source | Initial readback on 2026-09-14 |
| --- | --- | --- | ---: |
| 17 | Source count — Events | nonblank `01_Events!A5:A` event IDs | 57 |
| 18 | Source count — Bookings | nonblank `00_Master_Booking!D5:D1000` event IDs | 26 |
| 19 | Source count — Assets | nonblank `02_Assets!A5:A` asset IDs | 5 |

The first Booking formula attempted to count column A, but exact readback returned 996 because the booking ID column contains prefilled formulas below real bookings. That approach was rejected immediately and row 18 was corrected to count event IDs in column D. The erroneous 996 value was not used as guard authority.

These rows are informational evidence only. They do not change booking/event/asset business truth and do not write to those source tabs.

## Code changes

### `admin/snapshot-health.js`

- Bumps release identifier to `admin-snapshot-resilience-3`.
- Reads independent counts from the existing snapshot `health` array.
- Supports the current Apps Script health-row shape where the sheet Count column is serialized in the object's `status` field; also accepts a future explicit `count` field.
- Cross-checks `events`, `bookings`, and `assets` against independent Health Check counts.
- Rejects a snapshot when an independent source count is nonzero but the snapshot count is zero.
- Rejects a snapshot when source count is at least 4 and the snapshot contains 35% or less of the independently counted rows.
- Warns, but does not hard-fail, when the snapshot is below 75% but above the hard-fail threshold.
- If the Health Check surface exists but source-count rows are missing/incomplete, V3 warns that first-load protection is degraded rather than making Admin unavailable.
- Existing V1/V2 guards remain: required-array contract, ID uniqueness, Last Known Good, nonzero-to-zero rejection, correlated previous-baseline collapse, current-booking consistency, and Bangkok-day handling.

## Why this is safer than direct public-sheet reads

During preflight, Drive permission metadata showed the CRM spreadsheet currently has an `anyone / writer` permission. This is a serious security debt, but changing it in this change could break existing public-feed behavior and was therefore not done without a dedicated migration plan.

A direct Vercel `gviz` source-count implementation was explicitly abandoned. V3 does not make Admin depend on the broad sharing permission and will continue to work when sharing is tightened later.

The long-term security follow-up should separate public web feeds from the private CRM workbook or introduce an authenticated server-side Sheets access path, then remove the broad writer permission after acceptance testing.

## Before vs after

### Before V3

On a fresh Admin page load, a partial Apps Script read could return structurally valid non-empty arrays such as:

- Events 3 even though Sheet has 57
- Bookings 2 even though Sheet has 26
- Assets 1 even though Sheet has 5

With no previous browser baseline, V2 could not prove the response was partial.

### After V3

The same response includes Health Check source counts from independent formulas. The guard compares the two views before replacing Admin state. Large mismatches are rejected as `first-load/source count mismatch`, preserving fail-closed behavior even on the first load.

Normal matching counts pass. Medium mismatches are visible warnings to reduce false positives during legitimate maintenance.

## Safety boundaries

- No deployed Apps Script source was edited or replaced.
- Repository `apps-script/Code.gs` remains older than the reported live 9_5_9 revision and must not be deployed over production.
- No booking, event, customer, pricing, inventory, Scanner, Verifier, Canary, Make, notification, or provider truth was changed.
- The only live Sheet mutation is three informational formulas in `10_Admin_Health_Check`.
- No write retry behavior was introduced.
- No customer data is cached in browser storage.
- Booking source count intentionally uses event ID rather than the prefilled booking-ID formula column.

## Verification performed before PR

- Exact Google Sheets readback confirmed the three Health Check rows and calculated values.
- The invalid Booking count of 996 was detected by exact readback and corrected to 26 before code rollout.
- `node --check` passed for the V3 helper in a focused local verification.
- Focused V3 tests passed for:
  - first-load hard failure against independent counts;
  - healthy matching counts;
  - warning-only medium mismatch;
  - incomplete Health Check count surface.
- Full repository `npm test` remains subject to the repository's available CI/runtime. Vercel deployment success is not treated as proof that Node regression tests ran.

## Rollback

Code rollback: revert the V3 PR/deployment to V2.

Sheet rollback: clear only `10_Admin_Health_Check!A17:D19`. Do not roll back Apps Script or any business-data sheet.

If code is rolled back but the three Health Check rows remain, V2 ignores them except for normal Health Check display; they do not alter business state.

## Follow-up

1. Deploy V3 and perform authenticated `snapshotHealth` verification to confirm snapshot counts match source counts 57 / 26 / 5 or the then-current live values.
2. Verify Admin first-load, refresh, Last Known Good, and write-stale guard behavior.
3. Plan a separate permission-hardening migration for the current `anyone / writer` CRM Sheet permission; do not change sharing until public feed dependencies are mapped and tested.
