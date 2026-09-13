# KK Phone Rental Admin — P0 Regression CI V4

Date: 2026-09-14
Branch: `admin-p0-regression-ci-v4`
Baseline: main after Snapshot Resilience V3

## Objective

Close the remaining verification gap where Vercel deployment success was available but full repository syntax/regression tests were not automatically executed for each pull request.

## What changed

Added `.github/workflows/admin-regression.yml`.

The workflow runs on pull requests targeting `main` and on pushes to `main`, using Node.js 20. It executes:

1. `npm run check`
2. `npm test`

The workflow is read-only (`contents: read`), has a 10-minute job timeout, and uses concurrency cancellation so superseded commits on the same ref do not waste runs.

## Why this improves safety

Vercel deployment success proves that Vercel accepted and deployed a revision, but it is not equivalent to repository regression tests. This workflow separates the two acceptance signals:

- Vercel: deployment/build path
- Admin Regression CI: JavaScript syntax + Node regression suite

Future Admin hardening changes should require both signals before merge whenever available.

## Cache-label finding

`admin/index.html` still contains historical `resilience-1` labels/query keys. Preflight confirmed `vercel.json` already applies `Cache-Control: no-store, no-cache, must-revalidate, max-age=0` to `/admin/(.*)`, so the stale query label is not treated as an active runtime cache blocker. It remains cosmetic/version-label debt and can be cleaned when the large Admin HTML is edited through a safe full-file path.

## Authenticated production acceptance boundary

An authenticated `/api/kk-admin?action=snapshotHealth` call requires `KK_ADMIN_PIN`. The connected tools do not expose that secret and this change does not attempt to recover, infer, log, or store it. Therefore production deployment and repository CI can be verified here, but authenticated snapshotHealth E2E remains a separate acceptance step unless an authorized secret-bearing runtime is available.

## Safety boundaries

- No Apps Script edits or deployment.
- No Google Sheet business-data mutation.
- No Scanner/Verifier/Canary/Make changes.
- No Vercel environment variable changes.
- No secret access or secret logging.
- No production write actions.

## Rollback

Remove `.github/workflows/admin-regression.yml`. This does not affect runtime application behavior or business data.
