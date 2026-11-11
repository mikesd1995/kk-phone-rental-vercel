# KK Operations Dashboard R18 — latest-main reconciliation and private transport safety
Date: 2026-11-11 Asia/Bangkok. RELEASE HOLD: no Production merge/deploy, secrets, Google Sheets, Booking, stock, prices, Owner Locks or X writes.

## Exact lineage and scope
- Independent branch: `release/ops-dashboard-v4-main-refresh-r18-20261111`, parent current main `735bbf7c159df7f2fd6b93e5324df131727f91c9`, checked against GitHub main ref before staging.
- PR #860 source exact `1a15ba7e04b0d15cf72814d83af0e1a1f12290d7`: all 19 integration file blobs reused unchanged, except the three intentional R18 edits below. No synthetic fixture from #854.
- Changed paths on main since #860 base are disjoint from integration paths; the refreshed branch inherits current main's repeat-Terms-cookie changes untouched.
- Release PR remains Draft; no writes to Codex-owned original branches.

## Actual defect fixed
The previous dashboard only blocked the literal public-GViz reader. Missing, unknown and mismatched source/reader identities could be displayed as a positive green rentable-phone status if stock was otherwise positive. R18 requires an explicit matching private Service Account or private Owner Apps Script source label. Incomplete or contradictory provenance retains readable aggregate rows but forces phone/bundle readiness to HOLD, with an explicit gate and status message.

## Test / workflow work
- `admin/operations-dashboard.js`: strict private source identity (including direct-sheet fallback variants).
- `tests/operations-dashboard-readonly.test.js`: seven negative scenarios and both known valid private-source positive controls.
- `.github/workflows/admin-ops-release-candidate.yml`: scoped `release/ops-dashboard-v4-*` branch push/PR CI for subsequent release candidates; no secrets, Business writes or Production steps.

## Unmet release gates
1. Native full regression, exact-HEAD CI and Chromium 8-width UX run on this new source.
2. Independent security Reviewer approval.
3. Protected hosted signed Admin Preview with legitimate private readback, negative auth and raw-network PII audit; never copy Production credentials or weaken SSO.
4. R17 live-source issues remain: 52 SHOW events missing matching Owner Lock evidence and 4 missing/placeholder posters; each requires exact-event validation, not automatic reopening.
5. Owner-controlled approved Production release, rollback and exact SHA/route/API readback.

DO NOT MERGE OR DEPLOY PRODUCTION based only on synthetic CI or Preview READY.