# Admin direct-Sheet primary read cutover — 2026-09-22

## Objective

Remove the unstable Apps Script snapshot Web App from the Admin read critical path without weakening write safety.

Production evidence on 2026-09-22 showed the same Apps Script path alternating between HTTP 404 deployment-not-found, ~12s snapshot timeout, and a temporarily healthy lightweight write probe. Waiting for that snapshot before every Admin refresh made the Admin feel intermittently unavailable even though the canonical Google Sheet remained readable.

## Change

`api/kk-admin-snapshot-v5.js`

- adapter version becomes `admin-snapshot-upstream-error-v5.5`;
- default read mode becomes `direct-sheet-primary`;
- Admin `snapshot` and `snapshotHealth` build the validated snapshot directly from the canonical Google Sheet first;
- the 12s Apps Script snapshot request is no longer on the default read path;
- the existing lightweight Apps Script `phase1Health` probe still runs in parallel only to decide whether legacy writes are safe;
- direct reads remain available even when `KK_ADMIN_SCRIPT_URL` or `KK_ADMIN_API_KEY` is missing;
- writes remain fail-closed if the write-path identity/health probe is missing, unhealthy, wrong-version, or points at a different Sheet;
- response telemetry adds `read_mode=direct-sheet-primary` and `X-KK-Admin-Read-Mode`;
- explicit rollback mode remains available with `KK_ADMIN_READ_MODE=apps-script-first`.

This does **not** enable a new Google Sheets write path.

## Expected latency effect

Old degraded path:

`Apps Script snapshot wait (~12s) -> direct Sheet build (~1-4s)`

New default read path:

`direct Sheet build + lightweight write-health probe in parallel`

The new path removes the mandatory 12-second snapshot wait. Exact Production latency is not claimed until observed on the deployed runtime.

## Writer migration boundary

The repository already contains:
- a service-account Google Sheets reader, currently scoped to `spreadsheets.readonly`;
- an Admin Make write-bridge contract with request IDs, before/after hashes, exact action-to-sheet mapping and readback validation.

The Make runtime is quarantined because its free credits are exhausted.

A direct Google Sheets writer must therefore use a separate privileged credential and must **not** silently upgrade the existing reader credential. It also needs a distributed serialization/locking boundary before booking/event multi-step writes can replace Apps Script `DocumentLock`.

Current Supabase static runtime credentials are not proven configured in Vercel, so the existing control-plane lease/fencing code cannot yet be treated as the Admin transaction lock.

## Safety

No:
- Google Sheet business row mutation;
- Apps Script source/deployment/URL mutation;
- Vercel secret/environment mutation;
- timezone/trigger mutation;
- Scanner/Verifier/Canary/HF activation;
- synthetic booking/event/asset/price write.

Backup before this work:
`backup-main-pre-admin-direct-read-primary-20260922`
