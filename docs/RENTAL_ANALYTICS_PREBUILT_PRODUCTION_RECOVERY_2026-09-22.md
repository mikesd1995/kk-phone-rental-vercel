# Rental Analytics — Prebuilt Production Recovery — 2026-09-22

## Objective

Recover Production from the Vercel hosted-build `build-rate-limit` without weakening the existing PR/CI gates and without promoting a Preview deployment that was built with Preview-only environment variables.

The previously merged Rental Analytics route-shadow fix is commit:

`061da369297dbce1042cc4822edf9f93956e3776`

Current hosted Production is older than that fix.

## Why not promote the existing Preview directly

A READY Preview containing the route fix was inspected. Its Admin route returned `Admin access is unavailable`, proving that Preview environment credentials are intentionally different from Production. Pointing Production traffic directly at that Preview would therefore be unsafe.

## Recovery design

Workflow:

`.github/workflows/rental-analytics-prebuilt-production-recovery.yml`

The workflow requires an explicit repository-owner trigger bound to an exact 40-character current-main SHA. It then:

1. checks out that exact SHA and fails if `main` has moved
2. proves the Rental Analytics fix is an ancestor
3. reruns syntax and full regression tests
4. proves the shadowing physical `api/kk-rental-dashboard.js` file is absent and the public rewrite targets v6
5. pulls Production project settings into the ephemeral GitHub runner
6. builds locally with `vercel build --prod`, avoiding Vercel's hosted-build quota
7. creates a Production-target prebuilt deployment with `--skip-domain`, so live traffic is not switched yet
8. validates the candidate: Admin auth GET must be 200 and unauthenticated Rental Analytics GET must be 401 with `error=Unauthorized`
9. rechecks exact-main immediately before mutation
10. promotes the accepted candidate using Vercel's no-rebuild promote API
11. verifies the live Production routes
12. if live verification fails, promotes the previously serving Production deployment back

## Safety boundaries

- Admin PIN is never read or used.
- Admin session secret is never read or used.
- Google Sheet writes: 0.
- Apps Script writes: 0.
- Business writes: 0.
- Scanner / Verifier / Canary mutations: 0.
- Production settings are pulled only into the ephemeral GitHub runner and are not printed or uploaded as artifacts.
- The candidate receives no Production domain before route acceptance.
- A traffic switch is allowed only after exact-main, CI, route-shape, and candidate checks pass.
- Rollback target is captured from the currently serving READY Production immediately before recovery.

## Trigger

Owner-only comment on PR #164:

`/run-rental-analytics-prebuilt <exact-current-main-sha>`

A manual workflow dispatch exists as a backup and requires the explicit confirmation string `RUN_RENTAL_ANALYTICS_PREBUILT_PROD`.

## Protected candidate acceptance

Unaliased Production-target candidates inherit Vercel Authentication. Plain `curl` therefore receives the protection redirect instead of the application response.

Candidate acceptance uses `vercel curl` with the existing secret-scoped Vercel token. This authenticates the verification request while keeping Deployment Protection enabled. The workflow does not disable protection and does not create or publish a shareable bypass URL/token.

This was added after recovery run `35754969450` built exact main successfully and created READY candidate `dpl_EDL12198th8kCcKiraDgERfKhjC5`, but its plain-curl candidate probe returned `Redirecting...` and correctly stopped before promotion.

## Rollback

If the live post-promotion probes fail, the workflow calls Vercel's promote endpoint for the previously serving Production deployment. Because promotion does not rebuild, rollback is not dependent on hosted build capacity.

## Audit evidence

Each run uploads only secret-safe deployment identities, HTTP acceptance payloads, and the final recovery report for 30 days. Pulled Production environment files and Vercel build logs are intentionally excluded.
