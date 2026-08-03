# KK Phone Rental — Phase 3.9.5.6 Timeout & Performance Guard

Baseline: Phase 3.9.5.5 Prepared Asset Reservation Fix

## Root cause found

The Vercel admin proxy aborted every Apps Script request after 25 seconds. At the same time, the read-only `snapshot` action forced `SpreadsheetApp.flush()` and could auto-run the lens compatibility repair. When the sheet was recalculating, a normal Admin refresh could exceed the proxy's 25-second limit even though Apps Script itself was still processing.

## Changes

### `apps-script/Code.gs`
- Removed formula repair from the read-only `snapshot` path.
- Removed `SpreadsheetApp.flush()` from normal Admin snapshot refresh.
- Added `performance.snapshot_ms` and `performance.lens_patch_ready` diagnostics.
- Kept all existing booking, stock, price, bilingual, waitlist, and asset assignment logic unchanged.

### `api/kk-admin.js`
- Increased the Apps Script wait time from 25 seconds to action-specific limits:
  - Snapshot: 50 seconds
  - Poster upload: 55 seconds
  - Normal write actions: 45 seconds
  - Health request: 20 seconds
- Added upstream duration and timeout diagnostics to successful responses.
- Improved timeout errors to identify the action that timed out.

### `vercel.json`
- Set `api/kk-admin.js` maximum duration to 60 seconds.

### `admin/admin.js`
- Updated Admin UI/backend/proxy version expectations to Phase 3.9.5.6.

## Safety
- No changes to Google Sheet columns or formulas.
- No changes to booking stock rules.
- No changes to package price or event override logic.
- No automatic retry for write actions, preventing duplicate bookings or duplicate updates.

## Validation
- `node --check api/kk-admin.js`: passed
- `node --check admin/admin.js`: passed
- Apps Script syntax check via temporary `.js` copy: passed
- `vercel.json` validation: passed
