# KK Phone Rental Frontend v16.0_PHASE1_STABILIZED

Phase 1 production baseline.

## Deploy to Vercel

Upload/deploy the entire `frontend` folder.

## Required Environment Variables

```text
GOOGLE_SHEET_ID=<same spreadsheet id used by Apps Script>
KK_ADMIN_SCRIPT_URL=<Apps Script Web App /exec URL>
KK_ADMIN_API_KEY=<Apps Script API key>
KK_ADMIN_PIN=<Admin PIN>
KK_SITE_ORIGIN=https://kk-phone-rental.vercel.app
```

## Important changes

- Direct Google Sheets fallback is disabled in `config.js`.
- `/api/kk-data` no longer has a hardcoded Sheet ID fallback.
- `/api/kk-admin` sends `frontendSheetId` and version to Apps Script for health checking.
- Admin > Health Check shows version and Sheet ID mismatch warnings.
- Website CSS and visual layout were not changed.
