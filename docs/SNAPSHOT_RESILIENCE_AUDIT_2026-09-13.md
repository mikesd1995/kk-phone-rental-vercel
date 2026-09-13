# Admin snapshot resilience — P0/P1 audit

Date: 2026-09-13
Repository baseline: mikesd1995/kk-phone-rental-vercel, main commit 16f20b49ce650e8eb9fc2a98bb35cd11ff80208d.
Release identifier for UI and proxy: admin-snapshot-resilience-1.

## Evidence and scope

The referenced conversation reports deployed Apps Script v16.7.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX. This is reported deployment context, not independently verified live in this task. The pinned repository contains 9_5_8. No Apps Script source was edited or deployed. No Google Sheet records, formulas, configuration, or production deployments were changed by this task.

Code inspection confirmed unchecked assignment of snapshot.data to UI state, Live Check without snapshot validation, a partial current_bookings array hiding open bookings, public visibility filtering internal Overview events, and use of the browser's local day for operations.

## Files changed, reason, and benefit

| File | Change | Benefit |
| --- | --- | --- |
| admin/snapshot-health.js | Shared browser/CommonJS contract, required array validation, counts, zero-evidence checks, workflow and Bangkok-day helpers, separate UI/proxy release and observed backend revision | Both tiers use the same validation and diagnostics without pretending to deploy a backend revision |
| api/kk-admin.js | Authenticated snapshotHealth action mapped only to upstream snapshot; validate snapshot before forwarding; sheet identity guard; real latency through response-body consumption; timeout covers body | Health checks the actual Admin read path; malformed data cannot silently become a successful empty Overview |
| admin/admin.js | Validate before replacing state, in-memory last-known-good fallback, persistent freshness/count/latency warning, write guard while stale, auth failure clears retained data | A failed refresh keeps previous operational context visible and prevents writes based on stale data |
| admin/admin.js | Live Check runs systemHealth and snapshotHealth concurrently as separate HTTP requests; preserve failed health report rows | Failing checks remain inspectable; snapshot request does not consume the same 60-second function budget as other health probes |
| admin/admin.js | Derive current and Today rows from bookings, using existing open workflow statuses; use Bangkok day; include unpublished open upcoming events; calculate event metric before search | Partial derived arrays and public visibility no longer hide operational rows; search does not change the total event metric |
| admin/index.html | Load shared helper before Admin JS, updated title/script cache key, persistent accessible status banner | Correct load order and visible stale/error state even when no first successful snapshot exists |
| package.json | Extend syntax checks and add node:test command | Repeatable verification without new dependencies |
| tests/snapshot-health.test.js | Ten regression tests with mocked browser and proxy | Covers failure/recovery, malformed payloads, auth, counts, dates, workflow, latency, and read-only health routing |
| docs/SNAPSHOT_RESILIENCE_AUDIT_2026-09-13.md | This audit and deployment/rollback guidance | Reviewable record of decisions and limits |

## Guard behavior and limits

- events/bookings/assets unexpectedly dropping from nonzero to zero within the current page session rejects replacement. A zero current_bookings is valid when work is closed. Missing or malformed required arrays reject the snapshot.
- Events zero with booking/public-feed evidence, or assets zero with active asset assignments, fail validation. Partial current_bookings produces a warning; displayed open work is derived from bookings.
- An all-zero first snapshot without independent evidence is explicitly WARN, never represented by Live Check as fully healthy. It is not proof that Sheet data is absent. No speculative recovery writes are performed.
- Last Known Good is deliberately page-memory only: no customer data cache is added to localStorage, sessionStorage, public caches, or server-global memory. It survives failed refresh requests, not page reload, tab closure, or a fresh login. First-load failure displays an explicit failure banner. Reload-persistent fallback remains a separate future design requiring authenticated storage and expiry.
- Successful recovery replaces the old snapshot and unlocks writes. A rejected refresh throws so existing success notices do not overwrite the failure result. The persistent banner remains visible independently of transient notices.
- A 401/403 clears retained data and hides the app panel. Changing the entered PIN also clears retained state.
- All existing open workflow statuses are retained, including overdue returned/uploaded bookings; final completed/cancelled/no_show rows remain historical. Today means bookings for today's event date, not every overdue task. Existing Action Center handles overdue work.
- Open events still exclude historical dates; unpublished upcoming open events are now visible internally. Public site visibility is unchanged.
- Version mismatch is a diagnostic warning, not a claim of incompatibility and not an instruction to downgrade. A future observed backend revision requires inspection, not blind replacement.
- Snapshot latency is the real measured proxy round trip including body; banner latency includes browser request/retry time. These are timings recorded when code runs, not fabricated production measurements.

## Verification

Passed: node --check for script.js, admin/admin.js, api/kk-admin.js, api/kk-data.js, and admin/snapshot-health.js.
Passed: node --test tests/snapshot-health.test.js — 10 tests, 0 failures.
Tests use synthetic records and mocked network calls; they do not access or mutate production Sheets.
No live authenticated production check or real browser visual QA was performed. Production latency, counts, and deployed 9_5_9 source remain to be verified after Vercel deployment.

## Deployment separation

Vercel: review and merge the proposed branch, then deploy UI/helper/proxy together. This task does not merge main or invoke production deployment. Check deployment includes admin/snapshot-health.js in the server function bundle and as a browser asset. Run Live Check and confirm actual counts, latency, sheet identity, and three version values.

Apps Script: NO DEPLOY REQUIRED for this patch. Leave deployed 9_5_9 in place. Repository apps-script/Code.gs remains 9_5_8 and must not be copied over production. Before any later backend change, export the actual deployed 9_5_9 source, compare it, and preserve its price-integrity fixes. The repository's payment work_task mapping also appears to read the amount column; do not patch the older source into production without reconciling the deployed source.

Suggested staging checks: successful refresh; block snapshot request and confirm old rows plus warning; reject malformed/all-zero replacement; successful retry; login/auth failure; unpublished open event; open overdue booking; Thai midnight from a device in another timezone.

## Rollback considerations

Revert this single change commit or restore the prior Vercel deployment as one unit (Admin JS, helper, HTML, proxy). Do not roll back Apps Script or Sheets. Rolling back removes fallback/guards and reintroduces the original empty-snapshot risk. Last Known Good is memory-only and disappears on reload. A legitimate external removal of all events/bookings/assets will trigger the nonzero-to-zero guard in an existing page; independently verify that change, then reload to establish a new baseline.
