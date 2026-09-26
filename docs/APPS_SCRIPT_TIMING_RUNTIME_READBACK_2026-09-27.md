# Apps Script Timing Runtime Readback — 2026-09-27

## Objective

Close as much of the remaining Gate 2 timing uncertainty as possible using a zero-cost, zero-write path that executes inside the existing Vercel Production runtime.

## Why the earlier GitHub probe could not finish

PR #219 proved that the GitHub runner cannot obtain Vercel sensitive Production environment values. The final run reached `vercel env run -e production`, but Vercel intentionally withheld four sensitive values, leaving `KK_ADMIN_SCRIPT_URL` unavailable to the child process. The probe therefore stopped before any Apps Script request.

No setting or secret was changed to bypass that boundary.

## New zero-cost path

The existing `api/kk-intelligence-health.js` Vercel function already runs inside the Production environment and therefore has access to its own server-side configuration.

A narrow public read-only mode is added:

```
GET /api/kk-intelligence-health?mode=apps-script-timing
```

The route:

1. validates that the configured Apps Script URL is a canonical Google `/macros/s/.../exec` URL;
2. sends exactly one `phase1Health` request;
3. compares the returned local `generated_at` timestamp with the Vercel UTC request window;
4. infers the effective UTC offset;
5. verifies that Apps Script and the configured Core spreadsheet agree;
6. returns only coarse diagnostic booleans/offset information;
7. caches the result in-process for five minutes to avoid repeated upstream calls.

It does not return:
- the Apps Script URL or deployment id;
- the Apps Script API key;
- the spreadsheet id;
- customer/Booking/Event rows;
- response bodies containing business data.

## Proven source

The ChatGPT Library contains the recovered production-compatible 9_5_9 source:

`KK_Phone_Rental_Code_9_5_9_RECOVERY.txt`

Materialized bytes:
- size: 118,157 bytes
- SHA-256: `40fffe288d55c1991fda1bd133670b7b41f90822acd834ec887e00c1f0f1b87e`

This exactly matches the documented deployed-recovery source fingerprint in the Gate 2 repair record.

The recovered source confirms:
- `phase1Health` uses `kkPhase1Diagnostics_()`;
- `generated_at` is formatted by the Apps Script runtime;
- date keys/API date-time formatting use `Session.getScriptTimeZone()`;
- the cleanup installer creates `kkCleanupOldData30DaysAuto` daily with `.atHour(3)`.

However, the currently deployed `phase1Health` payload does **not** expose the named Project timezone or installed trigger list. Therefore this runtime probe can prove effective UTC+07 behavior and backend/Sheet identity, but it must leave:
- named Project timezone;
- installed trigger existence/schedule

explicitly UNVERIFIED until owner-authenticated Project Settings / Triggers evidence is available.

## Safety boundary

This change performs zero business writes and zero configuration writes.

It does not mutate:
- Apps Script timezone;
- Spreadsheet timezone;
- installed triggers;
- Apps Script source/deployment;
- Vercel secrets/environment values;
- Booking/customer/payment data;
- price/stock/Asset/Event/Package visibility;
- Google Sheet business rows.

The normal authenticated POST behavior of `/api/kk-intelligence-health` is unchanged.
