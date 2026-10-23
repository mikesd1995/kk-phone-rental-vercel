# Admin CRM blank dashboard — Booking GViz header inference — 2026-10-24

## Incident evidence (read-only production investigation)

- User observed an authenticated Admin CRM UI that rendered controls but showed empty operation panels with `Apps Script unavailable and direct-Sheet read-only fallback failed`.
- Vercel production deployment `dpl_3GD5ZSdkKcSGxFzQmu4VqoF1UPDM`, source SHA `dba91644c1e132ddd823d5acf515e20f366a5eb2`, was READY but its Admin POST endpoint failed.
- Production runtime logs around 2026-10-24 04:58–05:00 Asia/Bangkok repeatedly showed `KK_ADMIN_DIRECT_SHEET_FALLBACK_FAILED`, `trigger_code=DIRECT_SHEET_PRIMARY`, `fallback_error_code=FALLBACK_SCHEMA_HEADER_MISSING`, `fallback_dataset=bookings` for `snapshot` and `snapshotHealth`. This is a **direct-Sheet primary reader** failure; the user-facing error's mention of Apps Script is a generic legacy fallback string, not proof that Apps Script was attempted for those requests.
- Google Sheets connected metadata confirms `00_Master_Booking` tab exists and its row 4, column A contains exact `booking_id`. The workbook has 39 columns; the Admin reader deliberately reads A4:X, which includes its expected header.
- Vercel production environment names include `GOOGLE_SHEET_ID`, `KK_ADMIN_SCRIPT_URL`, `KK_ADMIN_API_KEY` and `KK_ADMIN_PIN`. Values were not decrypted, copied or logged. No private Core read transport configuration was seen in the list of environment variable names.

## Narrow patch

- The public GViz CSV URL now explicitly includes `headers=1`, which Google's documented visualization data source recommends to prevent automatic header inference, especially with mostly string data. This preserves the row-4 physical header and avoids relying on inferred labels when bookings change.
- The CSV schema parser accepts the required header in the first column, not an arbitrary cell in later rows; a data value `booking_id` in another column cannot masquerade as a schema header.
- New mocked regression tests cover a Booking snapshot, fixed `headers=1` on all required tabs, physical row numbers and a fail-closed malformed-header scenario.
- Change is server-side and read-only. No Booking, event, customer, price, permissions or spreadsheet content was changed; no credentials or runtime environment variables were changed.

## Acceptance / hold points

1. Run `node --test tests/admin-sheet-fallback.test.js tests/admin-sheet-fallback-private-reader.test.js tests/core-sheet-privacy-cutover.test.js tests/snapshot-upstream-error.test.js`, then `npm run check` and full `npm test` when available.
2. Independent diff review must confirm CSV header inference fix and fail-closed behavior, without introducing anonymous reads under strict private mode.
3. Verify exact-head Preview authenticated `snapshot` and `snapshotHealth` return valid data from the intended Sheet without exposing private payloads in logs.
4. Before Production release, satisfy existing release/owner safety gates and verify live readback: Admin dashboard nonempty counts consistent with canonical source and no unintended business writes.
5. If Preview still reports `FALLBACK_SCHEMA_HEADER_MISSING`, investigate actual GViz CSV header shape and source permissions. Do **not** alter Booking data, publish private sheet, or disable identity/schema checks to make it pass.
6. Apps Script write health is separately verified. A healthy read path alone does not authorize booking writes.

## Status

Patch and regression code prepared on a separate branch; full local/CI/Preview/Production acceptance must be reported separately based on actual run evidence. Do not call this incident fixed in Production before successful authenticated readback.
