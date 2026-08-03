# KK Phone Rental — Phase 3.9.5.8 Snapshot Timeout Stability Fix

## Symptom
Admin intermittently displayed:

`Apps Script request timed out for action unknown ... 45000 ms`

## Root causes found
1. The Vercel proxy declared `payload` inside the `try` block, so the timeout handler could not read the action and incorrectly reported `unknown` with the generic 45-second timeout.
2. Apps Script snapshot reads used `Sheet.getLastRow()` for wide ranges. Formula-driven tabs such as `08_Web_Ready` and `09_Web_Packages` may contain formulas far below the visible data, causing thousands of apparently blank rows to be read on every Admin refresh.
3. A transient read-only snapshot timeout was shown immediately instead of being retried safely once.

## Changes
- `apps-script/Code.gs`
  - Added leading-column trimming before wide `getValues()` reads, while preserving rows whose generated ID cell is temporarily blank.
  - Updated Model Master, Web Ready, Web Packages and Customer Stats readers to use trimmed reads.
  - Added `performance.range_mode = trimmed-by-leading-columns`.
- `api/kk-admin.js`
  - Snapshot timeout increased from 50,000 ms to 55,000 ms, within the existing Vercel 60-second function limit.
  - Moved request payload scope outside `try` so timeout messages identify the real action.
  - Returns `error_code`, `action`, and `timeout_ms` for diagnostics.
- `admin/admin.js`
  - Automatically retries `snapshot` once after a timeout.
  - Write actions are never retried, preventing duplicate bookings or duplicate updates.
- `admin/index.html`
  - Cache-bust updated to `3.9.5.8`.

## Safety scope
No changes were made to pricing rules, stock reservation, booking allocation, package visibility, public bilingual UI, or Google Sheet structure.

## Deployment
1. Replace and deploy `apps-script/Code.gs` as a **New version** of the Apps Script Web App.
2. Replace `api/kk-admin.js`, `admin/admin.js`, and `admin/index.html` on Vercel.
3. Redeploy Vercel and hard-refresh `/admin`.

## Validation
- `node --check api/kk-admin.js`: PASS
- `node --check admin/admin.js`: PASS
- Apps Script syntax check via `.js` copy: PASS
- JSON parse checks: PASS
